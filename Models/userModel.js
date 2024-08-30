const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const validator = require('validator')
const Wallet = require('../Models/walletModel')


const Schema = mongoose.Schema

// const rewardSchema = new Schema({
//   unlocked: { type: Boolean, default: false },
//   used: { type: Boolean, default: false }
// }, { _id: false });

const userSchema = new Schema({
      name: {
          type: String,
          required: true,
          unique: true
      },
      email: {
          type: String,
          required: true,
          unique: true
      },
      password: {
          type: String,
          required: true
      },
      wallet: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Wallet' 
      },
      rentedBike: { 
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Bike',
          default: null
      },
      totalRideTime: { 
          type: Number, 
          default: 0 
      },
      recordRideTime: { 
        type: Number, 
        default: 0 
    },
      totalRideCount: { 
          type: Number, 
          default: 0 
      },
      recordRideCount: { 
        type: Number, 
        default: 0 
    },
      loyaltyPoints: { // New field for loyalty points
      type: Number,
      default: 0
    },
      rewards: [{
          name: { type: String, required: true },
          unlockCondition: { type: String, required: true },
          isUnlocked: { type: Boolean, default: false },
          benefits: { type: String },
          inUse: { type: Boolean, default: false } // Add this property
      }],
      rideDates: [
        { type: Date }
      ],
      consecutiveRideDays: { 
        type: Number, 
        default: 0 
      },
      rewardApplied: {
        type: String,
        default: null,
    },
  }, { timestamps: true });
  //  // Available rewards
  //  rewards: [
  //   { type: mongoose.Schema.Types.ObjectId, ref: 'Reward' }
  // ],
  // // Rewards user has unlocked
  // unlockedRewards: [
  //   { type: mongoose.Schema.Types.ObjectId, ref: 'Reward' }
  // ], 
//  rentedBike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', default: null }


userSchema.statics.signup = async function(name, email, password) {

    // validation
    if (!name || !email || !password) {
      throw Error('All fields must be filled')
    }
    if (!validator.isEmail(email)) {
      throw Error('Email not valid')
    }
    if (!validator.isStrongPassword(password)) {
      throw Error('Password not strong enough')
    }
  
    const exists = await this.findOne({ email })
  
    if (exists) {
      throw Error('Email already in use')
    }
  
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    
    const wallet = new Wallet();
    await wallet.save();

    const defaultRewards = [
      { name: '100MinutesRide', unlockCondition: 'Make your total ride time 100 min', benefits: 'Free ride', isUnlocked: false, inUse: false },
      { name: '5ConsecutiveDays', unlockCondition: 'Ride for five consecutive days', benefits: 'Free ride', isUnlocked: false, inUse: false },
      {name: '10Rides', unlockCondition: 'rideCount>=5', benefits: '50% discount on a ride', isUnlocked: false, inUse: false},
      {name: '50LoyaltyPoints', unlockCondition: 'Collect 50 loyal points', benefits: 'Free ride', isUnlocked: false, inUse: false}
  ];
  
    const user = await this.create({ name, email, password: hash, wallet: wallet._id, verificationCode, rewards: defaultRewards })

    return user
  }
// static login method, 
userSchema.statics.login = async function(email, password) {

    if (!email || !password) {
      throw Error('All fields must be filled')
    }
  
    const user = await this.findOne({ email })
    if (!user) {
      throw Error('Incorrect email')
    }
  
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      throw Error('Incorrect password')
    }
  
    return user
  }

  module.exports = mongoose.model('User', userSchema)