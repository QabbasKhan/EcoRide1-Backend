const express = require ('express')
const nodemailer = require("nodemailer");

const router = express.Router()


const {loginUser,signupUser, verifyUser}=require('../Controllers/userController')



router.post('/login', loginUser)
router.post('/signup', signupUser)
router.post('/verify', verifyUser)

module.exports = router