const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')
const validator = require('validator')
const Wallet = require('../Models/walletModel')


const Schema = mongoose.Schema

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
        type:String,
        required:true
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
      rideCount: { 
      type: Number, 
      default: 0 
  }
//  rentedBike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', default: null }
}, { timestamps: true });

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
  
    const salt = await bcryptjs.genSalt(10)
    const hash = await bcryptjs.hash(password, salt)

    const wallet = new Wallet();
    await wallet.save();
  
    const user = await this.create({ name, email, password: hash, wallet: wallet._id })

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
  
    const match = await bcryptjs.compare(password, user.password)
    if (!match) {
      throw Error('Incorrect password')
    }
  
    return user
  }

  module.exports = mongoose.model('User', userSchema)