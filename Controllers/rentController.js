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
            //location: station.location,
            //docks: station.docks
        }));
        res.json(stationDetails);
    } catch (error) {
        res.status(500).send('Server error');
    }
}

const getProfile = async (req, res) => {
    const userId = req.params.id; // Assuming you are passing the user ID as a parameter in the URL

    try {
        const user = await User.findById(userId)
            .populate('wallet') // Populate the wallet details
            .populate('rentedBike') // Populate the rented bike details if needed
            .exec();

        if (!user) {
            return res.status(404).send('User not found');
        }

        res.status(200).json({
            name: user.name,
            email: user.email,
            wallet: user.wallet,
            rentedBike: user.rentedBike,
            totalRideTime: user.totalRideTime,
            totalRideCount: user.totalRideCount,
            loyaltyPoints: user.loyaltyPoints,
            rewards: user.rewards,
            consecutiveRideDays: user.consecutiveRideDays,
            rideDates: user.rideDates,
            isVerified: user.isVerified,
            rewardApplied: user.rewardApplied,
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).send('Server error');
    }
};

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
        const user = await User.findById(userId).populate('wallet');

        // Check wallet balance
        if (user.wallet.balance < 50) {
            return res.status(400).send({ message: 'Insufficient balance. You need at least 50 to start a ride.' });
        }

        if(!user){
            return res.status(404).send('User not found')
        }


        const dock = await Dock.findOne({ qrCode }).populate('bike').populate('station');
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
            stationName: dock.station.name,
            bikeId: dock.bike ? dock.bike._id : null,
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
    //orignal
   // const { userId, qrCode } = req.body;

   try{
    const user = await User.findById(userId).populate('wallet');
    //console.log('User:', user.name);
    // const dock = await Dock.findOne({ qrCode, status: 'occupied' }).populate('bike');
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

    // let appliedReward = null;
    // console.log(rewardId)

    // if (rewardId) {
    //     const reward = user.rewards.find(r => r._id.toString() === rewardId);
    //     console.log("reward.name in startRide")

    //     if (reward && reward.isUnlocked && !reward.inUse) {
    //         reward.inUse = true; // Mark the reward as in use
    //         appliedReward = rewardId;
    //     }
    // }


    console.log(bike.name, "is assigned to user:", user.name);

    const transaction = new Transaction({
        user: user._id,
        bike: bike._id,
        dockStationStart: dock._id,
        startTime: new Date(),
        // rewardApplied: appliedReward 
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
const endRide = async (req, res) => {
    const userId = req.user._id
    const {dockId} = req.body;
    //const { userId, qrCode } = req.body;

    try {
        const user = await User.findById(userId).populate('wallet');
        // const dock = await Dock.findOne({ qrCode, status: 'empty' });
        const dock = await Dock.findById(dockId);
        const bike = await Bike.findOne({ _id: user.rentedBike, status: 'rented' });

        if (!user || !dock || !bike || dock.status !== 'empty') {
            return res.status(400).send('Invalid data or dock is not empty');
        }

    //     await processTransaction(user, bike, dock, res);

        const responseTopic = 'qabbas/dockId/response';

        // Subscribe to the response topic
        mqttClient.subscribe(responseTopic, async (err) => {
            if (err) {
                console.error('Failed to subscribe to response topic', err);
                return res.status(500).send('Failed to subscribe to response topic');
            }
        
        
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
            // // Send MQTT request to ESP to get RFID tag
            // mqttClient.publish('qabbas/dockId/control', 'getRFID', (error) => {
            //     if (error) {
            //         console.error('Failed to request RFID', error);
            //         return res.status(500).send('Failed to request RFID');
            //     }
            // });

            await processTransaction(user, bike, dock, res);

        // Listen for the RFID tag response on the response topic
        // mqttClient.once('message', async (topic, message) => {
        //     if (topic === responseTopic) {
        //         const receivedRFID = message.toString();
        //         console.log(receivedRFID);

        //         // Check if the received RFID matches any bike's RFID
        //         const matchingBike = await Bike.findOne({ rfidTag: receivedRFID });

        //         if (!matchingBike) {
        //             return res.status(400).send('RFID tag mismatch. Ride cannot be ended.');
        //         }

        //         // Now that RFID is validated, proceed with the transaction
        //         await processTransaction(user, bike, dock, res);
        //     }
        // });
        });

        // const transaction = await Transaction.findOne({ user: user._id, bike: bike._id, endTime: null });
        // transaction.endTime = new Date();
        // transaction.dockStationEnd = dock._id;

        // const duration = (transaction.endTime - transaction.startTime) / 1000 / 60; // in minutes
        // console.log("Duration: ",duration)
        // const loyaltyPointsEarned = Math.floor(duration / 2); // Example: 1 point for every 10 minutes
        // user.loyaltyPoints += loyaltyPointsEarned;
        // console.log("Loyalty Points Earned:",loyaltyPointsEarned)

        // let fare;
        // if (isPeakHour()) {
        //     fare = calculateDemandBasedFare(duration);
        //     console.log("---calculateDemandBasedFare Applid---")

        // } else {
        //     fare = calculateTimeBasedFare(duration);
        //     console.log("---calculateTimeBasedFare----")
        // }

        // // let fare = duration * 1; // Example fare calculation

        // console.log(`Initial fare before reward application: ${fare}`);
        // transaction.fare = fare;
        
        // fare = await applyReward(user, transaction);

        // // Debug log
        // console.log(`Final fare after reward application: ${fare}`);

        // transaction.fare = fare;

        // user.wallet.balance -= fare;
        // user.wallet.transactions.push({
        //     amount: fare,
        //     type: 'debit',
        //     date: new Date(),
        //     description: 'Bike rental fare'
        // });

        // bike.status = 'available';
        // bike.currentDock = dock._id;
        // bike.userId = null; 
        // dock.bike = bike._id;
        // dock.status = 'occupied';
        // user.rentedBike = null;
        // user.totalRideTime += duration; // Update total ride time
        // user.recordRideTime += duration;
        // user.totalRideCount++;
        // user.recordRideCount++;
        // user.rideDates.push(new Date())

        // updateConsecutiveRideDays(user);
        
        // console.log(user.name, "has return the bike to dock: ", dock.name)
        
        // //Change
        // const rewardMessage = await checkAndUnlockRewards(user);

        // await bike.save();
        // await dock.save();
        // await user.save();
        // await transaction.save();
        // await user.wallet.save();

        // res.status(200).send({ transaction,duration, message: rewardMessage });
    } catch (error) {
        console.error('Error ending ride:', error);
        res.status(500).send('Server error');
    }
}

//Ride History
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

const processTransaction = async (user, bike, dock, res) => {
    try {
        const transaction = await Transaction.findOne({ user: user._id, bike: bike._id, endTime: null });
    transaction.endTime = new Date();
    transaction.dockStationEnd = dock._id;

    const duration = (transaction.endTime - transaction.startTime) / 1000 / 60; // in minutes
    console.log("Duration: ",duration)
    const loyaltyPointsEarned = Math.floor(duration / 2); // Example: 1 point for every 10 minutes
    user.loyaltyPoints += loyaltyPointsEarned;
    console.log("Loyalty Points Earned:",loyaltyPointsEarned)

    let fare;
    if (isPeakHour()) {
        fare = calculateDemandBasedFare(duration);
        console.log("---calculateDemandBasedFare Applid---")

    } else {
        fare = calculateTimeBasedFare(duration);
        console.log("---calculateTimeBasedFare----")
    }

    // let fare = duration * 1; // Example fare calculation

    console.log(`Initial fare before reward application: ${fare}`);
    transaction.fare = fare;
    
    fare = await applyReward(user, transaction);

    // Debug log
    console.log(`Final fare after reward application: ${fare}`);

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
    user.recordRideTime += duration;
    user.totalRideCount++;
    user.recordRideCount++;
    user.rideDates.push(new Date())

    updateConsecutiveRideDays(user);
    
    console.log(user.name, "has return the bike to dock: ", dock.name)
    
    //Change
    const rewardMessage = await checkAndUnlockRewards(user);

    await bike.save();
    await dock.save();
    await user.save();
    await transaction.save();
    await user.wallet.save();

    res.status(200).send({ transaction,duration, message: rewardMessage });
    } catch (error) {
        res.status(500).send('Transaction error');
    }
};

const checkAndUnlockRewards = async (user) => {
    let rewardsUnlocked = false;
    let unlockedRewards = []

    // Check and unlock the 500MinutesRide reward
    if (user.recordRideTime >= 100 && !user.rewards.find(r => r.name === '100MinutesRide').isUnlocked) {
        const reward = user.rewards.find(r => r.name === '100MinutesRide');
        reward.isUnlocked = true;
        reward.unlockDate = new Date();
        rewardsUnlocked = true;
        unlockedRewards.push(reward.name);
    }

    // Check and unlock the 5ConsecutiveDays reward
    if (user.consecutiveRideDays >= 5 && !user.rewards.find(r => r.name === '5ConsecutiveDays').isUnlocked) {
        const reward = user.rewards.find(r => r.name === '5ConsecutiveDays');
        reward.isUnlocked = true;
        reward.unlockDate = new Date();
        rewardsUnlocked = true;
        unlockedRewards.push(reward.name);
    }

    // Check and unlock the 10Rides reward
    if (user.recordRideCount >= 10 && !user.rewards.find(r => r.name === '10Rides').isUnlocked) {
        const reward = user.rewards.find(r => r.name === '10Rides');
        reward.isUnlocked = true;
        reward.unlockDate = new Date();
        rewardsUnlocked = true;
        unlockedRewards.push(reward.name);
    }

    if (user.loyaltyPoints >= 50 && !user.rewards.find(r => r.name === '50LoyaltyPoints').isUnlocked) {
        const reward = user.rewards.find(r => r.name === '50LoyaltyPoints');
        reward.isUnlocked = true;
        reward.unlockDate = new Date();
        rewardsUnlocked = true;
        unlockedRewards.push(reward.name);
    }

    if (rewardsUnlocked) {
        await user.save();
        console.log("New Reward unlocked")
        // return `New rewards unlocked: ${unlockedRewards.join(', ')}.`;
        return "New rewards unlocked";
    } else {
        console.log("No new reward")
        return "No new rewards unlocked.";
    }
};

const updateConsecutiveRideDays = (user) => {
    const lastRideDate = user.rideDates.length > 0 ? new Date(user.rideDates[user.rideDates.length - 1]) : null;
    const currentDate = new Date();

    // Remove time components from the date for accurate day-to-day comparison
    lastRideDate?.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    if (lastRideDate) {
        const diffDays = (currentDate - lastRideDate) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
            user.consecutiveRideDays += 1;
        } else if (diffDays > 1) {
            user.consecutiveRideDays = 1; // Reset if more than one day has passed
        }
    } else {
            user.consecutiveRideDays = 1; // First ride case
    }
};


const applyReward = async (user, transaction) => {
    let fare = transaction.fare;

    // Debug log
    console.log("Checking if a reward should be applied...");

    if (user.rewardApplied) {
        const reward = user.rewards.find(r => r._id.toString() === user.rewardApplied.toString());
        
        // Debug log
        console.log(`Attempting to apply reward: ${reward.name}`);

        if (reward && reward.inUse) {
            switch (reward.name) {
                case '100MinutesRide':
                    fare = 0; // Apply a free ride reward
                    user.recordRideTime -= 100;
                    break;
                case '10Rides':
                    fare = fare * 0.5; // Apply a free ride reward
                    user.recordRideCount -= 10;
                    break;
                    // user.wallet.balance += 20; // Add 20 units to the wallet
                    // break;
                case '5ConsecutiveDays':
                    fare = 0; // Apply a 50% discount on the fare
                    user.consecutiveRideDays = 0;
                    break;
                case '50LoyaltyPoints':
                    fare = 0; // Apply a 50% discount on the fare
                    user.loyaltyPoints -= 50;
                    break;
                // case '100KMClub':
                //     fare = fare * 0.5; // Apply a 50% discount on the fare
                //     break;
                // case 'NightRider':
                //     fare = fare * 0.8; // Apply a 20% discount on the fare
                //     break;
                // case 'WeekendWarrior':
                //     fare = fare * 0.7; // Apply a 30% discount on the fare
                //     break;
                // Add logic for other rewards here as needed
                default:
                    console.log(`No specific logic found for reward: ${reward.name}`);
                    break;
            }
            reward.inUse = false; // Mark the reward as no longer in use
            user.rewardApplied = null; // Clear the applied reward
            reward.isUnlocked = false;
        } else {
            console.log(`Reward is either locked or already in use: ${reward.name}`);
        }
    } else {
        console.log('No reward applied for this transaction.');
    }

    return fare;
};

// const applyReward = async (user, transaction) => {
//     let fare = transaction.fare;
//     console.log("apply reward or not")
//     if (transaction.rewardApplied) {
//         const reward = user.rewards.find(r => r._id.toString() === transaction.rewardApplied);
//         console.log(`Applying reward: ${reward.name}`);
        
//         if (reward && reward.inUse) {
//             switch (reward.name) {
//                 case '5kMinutesRide':
//                     fare = 0; // Apply the free ride reward
//                     break;
//                 case '10Rides':
//                     user.wallet.balance += 20; // Add 20 to wallet
//                     break;
//                 case '5ConsecutiveDays':
//                     fare = 0; // Apply the free ride reward
//                     break;
//                 // // Add logic for other rewards here
//             }
//             reward.inUse = false; // Mark the reward as no longer in use
//         }
//     }   
//     return fare;
// };

const claimReward = async (req, res) => {
    const userId = req.user._id
    const { rewardId } = req.body;
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).send('User not found');
      }

      // Find the reward in the user's rewards array
      const reward = user.rewards.find(r => r._id.toString() === rewardId);
      if (!reward) {
        // throw new Error('Reward not found');
        return res.status(404).send('Reward not found');
      }

      // Check if the reward is unlocked and not already in use
      if (reward.isUnlocked && !reward.inUse) {
        reward.inUse = true; // Mark the reward as in use
        user.rewardApplied = rewardId; // Update the rewardApplied field
        await user.save();
        console.log(`Reward ${reward.name} applied and marked as in use for user ${user.name}`);
        return res.status(200).send(`Reward ${reward.name} successfully applied.`);
      } else {
        console.log(`Reward ${reward.name} is either locked or already in use for user ${user.name}`);
        return res.status(400).send(`Reward ${reward.name} is either locked or already in use.`);
    }
    } catch (error) {
      console.error('Error updating rewardApplied:', error);
      return res.status(500).send('Server error');
    }
  }

const checkRewards = async (req, res) => {
    const userId = req.user._id
    try {
        // Find the user by ID and populate the rewards array
        const user = await User.findById(userId).populate('rewards');
        
        if (!user) {
            throw new Error('User not found');
        }
        
        // Extract the rewards and their unlocked status
        const rewardsWithStatus = user.rewards.map(reward => ({
            id: reward._id,
            name: reward.name,
            unlockCondition: reward.unlockCondition,
            isUnlocked: reward.isUnlocked,
            benefits: reward.benefits,
            inUse: reward.inUse,
        }));
        
        // Send the rewardsWithStatus as a response
        res.status(200).json(rewardsWithStatus);
    } catch (error) {
        console.error('Error retrieving user rewards:', error);
        res.status(500).send('Server error');
    }
};

// Time-Based Fare with Tiered Pricing (Idea 1)
const calculateTimeBasedFare = (duration) => {
    let fare = 0;

    if (duration <= 10) {
        fare = 0; // Free if duration is 10 minutes or less
    } else if (duration <= 20) {
        fare = duration * 2; // Charge for entire duration if more than 10 minutes
    } else if (duration <= 30) {
        fare = (30 * 3) + ((duration - 30) * 0.5); // Tiered pricing
    } else {
        fare = (30 * 3) + (30 * 0.15) + ((duration - 60) * 0.20); // Tiered pricing for over 60 minutes
    }

    return fare;
};

// Demand-Based Fare (Surge Pricing) (Idea 5)
const calculateDemandBasedFare = (duration) => {
    const baseRate = 1; // $0.10/min as base rate
    const peakHourMultiplier = 2; // 50% increase during peak hours

    let fare = 0;

    if (duration <= 10) {
        fare = 0; // Free if duration is 10 minutes or less
    } else {
        fare = duration * baseRate * peakHourMultiplier; // Charge for entire duration if more than 10 minutes
    }

    return fare;
};

// Determine if it's Peak Hour
const isPeakHour = () => {
    const currentHour = new Date().getHours();
    
    // Example: Peak hours from 7-9 AM and 5-7 PM
    return (currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19);
};



module.exports = {stationAvailability, startRide, endRide, getAllStations,scannedDockDetails,rideHistory,claimReward, checkRewards, getProfile}