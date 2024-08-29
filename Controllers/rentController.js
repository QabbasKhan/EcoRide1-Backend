const express = require('express');
const User = require('../Models/userModel');
const Bike = require('../Models/bikeModel');
const Dock = require('../Models/dockModel');
const Station = require('../Models/stationModel');
const Transaction = require('../Models/transactionModel');
const Wallet = require('../Models/walletModel');
const mqttClient  = require('../mqttsConnection');

// get all stations
const getAllStations = async (req, res) => {
    try {
        const stations = await Station.find().populate('docks');
        console.log("User entered in home page");
        const stationDetails = stations.map(station => ({
            id: station._id,
            name: station.name,
            area: station.area,
            location: station.location,
            docks: station.docks
        }));
        res.json(stationDetails);
    } catch (error) {
        res.status(500).send('Server error');
    }
}

//get availability
const stationAvailability = async (req, res) => {
    const { stationId } = req.params;

    try {
        // Check if the station exists
        const station = await Station.findById(stationId);
        if (!station) {
            return res.status(404).send('Station not found');
        }
        console.log("user click to a station",station.name);
        // Count the number of occupied and empty docks
        const occupiedDocks = await Dock.countDocuments({ station: stationId, status: 'occupied' });
        const emptyDocks = await Dock.countDocuments({ station: stationId, status: 'empty' });
        // const StationName = station.stationName;
        // console.log(StationName);

        // Return the availability information
        res.json({
            stationId,
            StationArea: station.area,
            occupiedDocks,
            emptyDocks
        });
    } catch (error) {
        res.status(500).send('Server error');
    }
}

//ScannedDock
const scannedDockDetails = async (req, res) => {
    const userId = req.user._id;
    const { qrCode } = req.params;

    try {
        console.log("Scanned a dock")
        const user = await User.findById(userId);

        // Check wallet balance
        if (user.wallet.balance < 50) {
            return res.status(400).send({ message: 'Insufficient balance. You need at least 50 to start a ride.' });
        }

        if(!user){
            return res.status(404).send('User not found')
        }


        const dock = await Dock.findOne({ qrCode }).populate('bike').populate('station');
        console.log(dock.name);
        if (!dock) {
            return res.status(404).send('Dock not found');
        }
                // Check if the user has already rented a bike
        if (user.rentedBike && dock.status === 'occupied') {
            return res.status(400).send('You have already rented a bike. Please return it to an empty dock first.');
        }

        // Check if the user hasn't rented a bike and scans an empty dock
        if (!user.rentedBike && dock.status === 'empty') {
            return res.status(400).send('You have not rented a bike. Please scan an occupied dock to start a ride.');
        }

        const dockDetails = {
            dockId: dock._id,
            status: dock.status,
            stationName: dock.station.area,
            bikeId: dock.bike ? dock.bike.name : null,
        };

        res.json(dockDetails);
    } catch (error) {
        res.status(500).send('Server error');
    }
};


// Rent a bike
const startRide = async (req, res) => {
    //changed
    const userId = req.user._id
    const {dockId} = req.body;
    try{
    const user = await User.findById(userId).populate('wallet');
    //console.log('User:', user.name);
    const dock = await Dock.findById(dockId).populate('bike');
    //console.log('Dock:', dock);

    if (!user || !dock || !dock.bike) {
        return res.status(400).send('User, Dock, or Bike not found');
    }

    const bike = dock.bike;
    bike.status = 'rented';
    bike.currentDock = null;
    bike.userId =  user._id; //added
    dock.status = 'empty';
    dock.bike = null;
    user.rentedBike = bike._id;

         // Send MQTT unlock command
         mqttClient.publish('qabbas/dockId/control', 'UNLOCK', (error) => {
            if (error) {
                console.error('Failed to send unlock command', error);
                return res.status(500).send('Failed to send unlock command');
            } else {
                console.log(`Unlock command sent to dock ${dock._id}`);
                // Respond after MQTT message is sent
            }
        });

    console.log(bike.name, "is assigned to user:", user.name);

    const transaction = new Transaction({
        user: user._id,
        bike: bike._id,
        dockStationStart: dock._id,
        startTime: new Date()
    });

    await bike.save();
    await dock.save();
    await user.save();
    await transaction.save();


    return res.send(transaction);
    } catch (error){
        res.status(500).send("Server error") 
    }
}

// Return a bike
const endRide = async (req, res) => {
    const userId = req.user._id
    const {dockId} = req.body;
    //const { userId, qrCode } = req.body;
    console.log("end req is made");
    
    try {
        const user = await User.findById(userId).populate('wallet');
        // const dock = await Dock.findOne({ qrCode, status: 'empty' });
        const dock = await Dock.findById(dockId);
        const bike = await Bike.findOne({ _id: user.rentedBike, status: 'rented' });

        if (!user || !dock || !bike || dock.status !== 'empty') {
            return res.status(400).send('Invalid data or dock is not empty');
        }
    //     await processTransaction(user, bike, dock, res);

    //     const responseTopic = 'qabbas/dockId/response';

    //     // Subscribe to the response topic
    //     mqttClient.subscribe(responseTopic, (err) => {
    //         if (err) {
    //             console.error('Failed to subscribe to response topic', err);
    //             return res.status(500).send('Failed to subscribe to response topic');
    //         }

    //         // Send MQTT request to ESP to get RFID tag
    //         mqttClient.publish('qabbas/dockId/control', 'getRFID', (error) => {
    //             if (error) {
    //                 console.error('Failed to request RFID', error);
    //                 return res.status(500).send('Failed to request RFID');
    //             }
    //         });

    //     // Listen for the RFID tag response on the response topic
    //     mqttClient.once('message', async (topic, message) => {
    //         if (topic === responseTopic) {
    //             const receivedRFID = message.toString();
    //             console.log(receivedRFID);

    //             // Check if the received RFID matches any bike's RFID
    //             const matchingBike = await Bike.findOne({ rfidTag: receivedRFID });

    //             if (!matchingBike) {
    //                 return res.status(400).send('RFID tag mismatch. Ride cannot be ended.');
    //             }

    //             // Now that RFID is validated, proceed with the transaction
    //             await processTransaction(user, bike, dock, res);
    //         }
    //     });
    // });
        
        const transaction = await Transaction.findOne({ user: user._id, bike: bike._id, endTime: null });
        transaction.endTime = new Date();
        transaction.dockStationEnd = dock._id;
        const duration = (transaction.endTime - transaction.startTime) / 1000 / 60; // in minutes
        const fare = duration * 0.5; // Example fare calculation
        transaction.fare = fare;

        user.wallet.balance -= fare;
        user.wallet.transactions.push({
            amount: fare,
            type: 'debit',
            date: new Date(),
            description: 'Bike rental fare'
        });

        bike.status = 'available';
        bike.currentDock = dock._id;
        bike.userId = null; 
        dock.bike = bike._id;
        dock.status = 'occupied';
        user.rentedBike = null;
        user.totalRideTime += duration; // Update total ride time
        user.rideCount++;

        console.log(user.name, "has return the bike to dock: ", dock.name)

        await bike.save();
        await dock.save();
        await user.save();
        await transaction.save();
        await user.wallet.save();

        res.send(transaction);

    } catch (error) {
        res.status(500).send('Server error');
    }
}

// const processTransaction = async (user, bike, dock, res) => {
//     try {
//         const transaction = await Transaction.findOne({ user: user._id, bike: bike._id, endTime: null });
//         transaction.endTime = new Date();
//         transaction.dockStationEnd = dock._id;
//         const duration = (transaction.endTime - transaction.startTime) / 1000 / 60; // in minutes
//         const fare = duration * 0.5; // Example fare calculation
//         transaction.fare = fare;

//         user.wallet.balance -= fare;
//         user.wallet.transactions.push({
//             amount: fare,
//             type: 'debit',
//             date: new Date(),
//             description: 'Bike rental fare'
//         });

//         bike.status = 'available';
//         bike.currentDock = dock._id;
//         bike.userId = null; 
//         dock.bike = bike._id;
//         dock.status = 'occupied';
//         user.rentedBike = null;
//         user.totalRideTime += duration; // Update total ride time
//         user.rideCount++;

//         console.log(user.name, "has returned the bike to dock: ", dock.name);

//         await bike.save();
//         await dock.save();
//         await user.save();
//         await transaction.save();
//         await user.wallet.save();

//         res.send(transaction);
//     } catch (error) {
//         res.status(500).send('Transaction error');
//     }
// };


// Ride History
const rideHistory = async (req, res) => {
    const userId = req.user._id
    try{
        const transactions = await Transaction.find({user: userId})
            .populate('bike')
            .populate({
                path: 'dockStationStart',
                populate: {path: 'station'}
            })
            .populate({
                path: 'dockStationEnd',
                populate: { path: 'station' }
            });

            if(!transactions || transactions.length === 0){
                return res.status(404).send('No Ride History')
            }

            const rideHistory = transactions.map(transaction => ({
                startPoint: transaction.dockStationStart ? transaction.dockStationStart.station.name : 'Unknown',
                endPoint: transaction.dockStationEnd ? transaction.dockStationEnd.station.name : 'Unknown',
                fare: transaction.fare,
                date: transaction.startTime,
                bikeId: transaction.bike._id
            }));
            res.json(rideHistory);

    } catch (error) {
        console.error('Error fetching ride history:', error);
        res.status(500).send('Server error');
    }
}
module.exports = {stationAvailability, startRide, endRide, getAllStations,scannedDockDetails,rideHistory}