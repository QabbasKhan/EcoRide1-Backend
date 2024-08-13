const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../Models/userModel')

//CreatingToken
const createToken = (_id) => {
    return jwt.sign({_id}, process.env.JWT_SECRET, { expiresIn: '30d' });
}; 

//User Signing
const signupUser = async (req,res) => {
    const {name,email,password} = req.body;
    try{
        const user = await User.signup(name, email, password);
        console.log("Signup Successfuly");
        const token = createToken(user._id);
        res.status(200).json({email,token});
        console.log(email,"\n",token);
    } catch (error){
        res.status(400).json({error: error.message});
    }
}

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
}

module.exports = {signupUser, loginUser}