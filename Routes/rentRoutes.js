const express = require('express')
const router = express.Router()
const {stationAvailability,startRide,endRide, getAllStations,scannedDockDetails, rideHistory}=require('../Controllers/rentController')
const requireAuth = require('../Middlewares/requireAuth')

router.use(requireAuth)
//router.use(requireAuth.initialize());

router.post('/ride/start',startRide)
router.post('/ride/end',endRide)
router.get('/map/:stationId',stationAvailability)
router.get('/map',getAllStations)
router.get('/dock/:qrCode', scannedDockDetails);
router.get('/history',rideHistory)
module.exports = router