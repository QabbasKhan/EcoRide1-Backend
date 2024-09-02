require('dotenv').config()
const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../Models/userModel')
const mongoose = require('mongoose')
const nodemailer = require("nodemailer");


//CreatingToken
const createToken = (_id) => {
    return jwt.sign({_id}, process.env.JWT_SECRET, { expiresIn: '30d' });
}; 


// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER, // your email
    pass: process.env.EMAIL_PASS, // your email password
  },
});

const signupUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.signup(name, email, password);
    console.log("Signup Successfuly");

    // Send verification email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Email Verification",
      text: `Your verification code is: ${user.verificationCode}`,
      html: `<b>Your verification code is: ${user.verificationCode}</b>`,
    });

    res.status(200).json({ message: "Verification email sent." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const verifyUser = async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && user.verificationCode === verificationCode) {
        user.isVerified = true;
        user.verificationCode = undefined; // Remove verification code after successful verification
        await user.save();
        user.isVerified = true;
        await user.save();

        const token = createToken(user._id);

        // Send "Successfully Registered" email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Registration Successful",
        text: `Congratulations, ${user.name}! Your registration is complete.`,
        html: `<p>Congratulations, <b>${user.name}</b>! Your registration is complete.</p>`,
      });
        
        // res.status(200).json({  });
        console.log(email, token)
        res.status(200).json({email, token, message: "Email verified successfully!" });
    } else {
        res.status(400).json({ error: "Invalid verification code" });
        }
    

    // if (!user) {
    //   throw Error('User not found');
    // }

    // if (user.verificationCode !== verificationCode) {
    //   throw Error('Invalid verification code');
    // }

    
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const loginUser = async(req,res)=>{
    const { email, password } = req.body

    try{
        const user = await User.login(email, password)
        console.log("Login successfuly")
        const token = createToken(user._id)
        //console.log(token)
        res.status(200).json({email, token})
        console.log( email,"/n",token);

    } catch(error){
        res.status(400).json({error: error.message})
    }
};

// // Verify User
// const verifyUser = async (req, res) => {
//     const { email, verificationCode } = req.body;
//     try {
//         const user = await User.findOne({ email });
//         if (user && user.verificationCode === verificationCode) {
//             user.verified = true;
//             user.verificationCode = undefined; // Remove verification code after successful verification
//             await user.save();
//             res.status(200).json({ message: "Email verified successfully!" });
//         } else {
//             res.status(400).json({ error: "Invalid verification code" });
//         }
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// };

module.exports = {signupUser, loginUser, verifyUser}