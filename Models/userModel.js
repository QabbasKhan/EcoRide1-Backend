const mongoose = require('mongoose')
const bcryptjs = require('bcryptjs')
const validator = require('validator')
const Wallet = require('../Models/walletModel')
const nodemailer = require("nodemailer");


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
  },
    verificationCode: { 
      type: String },
    isVerified: {
       type: Boolean,
        default: false },
//  rentedBike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', default: null }
}, { timestamps: true });

//ORG
// userSchema.statics.signup = async function(name, email, password) {

//     // validation
//     if (!name || !email || !password) {
//       throw Error('All fields must be filled')
//     }
//     if (!validator.isEmail(email)) {
//       throw Error('Email not valid')
//     }
//     if (!validator.isStrongPassword(password)) {
//       throw Error('Password not strong enough')
//     }
  
//     const exists = await this.findOne({ email })
  
//     if (exists) {
//       throw Error('Email already in use')
//     }
  
//     const salt = await bcryptjs.genSalt(10)
//     const hash = await bcryptjs.hash(password, salt)

//     const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

//     const wallet = new Wallet();
//     await wallet.save();
  
//     const user = await this.create({ name, email, password: hash, wallet: wallet._id })

//     return user
//   }

//edited
userSchema.statics.signup = async function(name, email, password) {
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

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

  const wallet = new Wallet();
  await wallet.save();

  const user = await this.create({ 
    name, 
    email, 
    password: hash, 
    wallet: wallet._id, 
    verificationCode 
  })

  // Send email (we'll define the mailer function below)
  // await mailer(user.email, verificationCode);

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

//   // nodemailer function
// async function mailer(recieveremail, code) {
//   let transporter = nodemailer.createTransport({
//       host: "smtp.gmail.com",
//       port: 587,
//       secure: false,
//       requireTLS: true,
//       auth: {
//           user: process.env.EMAIL_USER,
//           pass: process.env.EMAIL_PASS,
//       },
//   });

//   let info = await transporter.sendMail({
//       from: process.env.EMAIL_USER, // sender address
//       to: recieveremail, // receiver email
//       subject: "Signup Verification", // Subject line
//       text: `Your Verification Code is ${code}`, // plain text body
//       html: `<b>Your Verification Code is ${code}</b>`, // html body
//   });

//   console.log("Message sent: %s", info.messageId);
// }


  module.exports = mongoose.model('User', userSchema)