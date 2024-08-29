const mongoose = require('mongoose');

const bikeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    status: { type: String, enum: ['available', 'rented'], default: 'available' },
    currentDock: { type: mongoose.Schema.Types.ObjectId, ref: 'Dock', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null},
    rfidTag: { type: String, unique: true, required: true },
}, { timestamps: true });

const Bike = mongoose.model('Bike', bikeSchema);

module.exports = Bike;