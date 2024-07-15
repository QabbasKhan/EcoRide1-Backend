const express = require('express')
const User = require('../Models/userModel');
const Bike = require('../Models/bikeModel');
const Dock = require('../Models/dockModel');
const Station = require('../Models/stationModel');
const Transaction = require('../Models/transactionModel');
const Wallet = require('../Models/walletModel');

// get all stations
const getAllStations = async (req, res) => {
    try {
        const stations = await Station.find().populate('docks');
        res.json(stations);
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

        // Count the number of occupied and empty docks
        const occupiedDocks = await Dock.countDocuments({ station: stationId, status: 'occupied' });
        const emptyDocks = await Dock.countDocuments({ station: stationId, status: 'empty' });

        // Return the availability information
        res.json({
            stationId,
            occupiedDocks,
            emptyDocks
        });
    } catch (error) {
        res.status(500).send('Server error');
    }
}

// Rent a bike
const rentBike = async (req, res) => {
    //changed
    const userId = req.user._id
    const {qrCode} = req.body;
    //orignal
   // const { userId, qrCode } = req.body;
    try{
    const user = await User.findById(userId).populate('wallet');
    //console.log('User:', user.name);
    const dock = await Dock.findOne({ qrCode, status: 'occupied' }).populate('bike');
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

    console.log(bike.name, "is assigned to user:", user.name);

    const transaction = new Transaction({
        user: user._id,
        bike: bike._id,
        dockStationStart: dock.station,
        startTime: new Date()
    });

    await bike.save();
    await dock.save();
    await user.save();
    await transaction.save();

    res.send(transaction);
    } catch (error){
        res.status(500).send("Server error") 
    }
}

// Return a bike
const returnBike = async (req, res) => {
    const userId = req.user._id
    const {qrCode} = req.body;
    //const { userId, qrCode } = req.body;

    try {
        const user = await User.findById(userId).populate('wallet');
        const dock = await Dock.findOne({ qrCode, status: 'empty' });
        const bike = await Bike.findOne({ _id: user.rentedBike, status: 'rented' });

        if (!user || !dock || !bike || dock.status !== 'empty') {
            return res.status(400).send('Invalid data or dock is not empty');
        }

        const transaction = await Transaction.findOne({ user: user._id, bike: bike._id, endTime: null });
        transaction.endTime = new Date();
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

module.exports = {stationAvailability, rentBike, returnBike, getAllStations}