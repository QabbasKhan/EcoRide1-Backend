const mongoose = require('mongoose');

const dockSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    qrCode: { type: String, required: true, unique: true }, // QR code string
    qrCodeData: { type: String }, // QR code image data
    station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    bike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', default: null },
    status: { type: String, enum: ['empty', 'occupied'], default: 'empty' }
}, { timestamps: true });

const Dock = mongoose.model('Dock', dockSchema);

module.exports = Dock;