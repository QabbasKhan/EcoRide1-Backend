const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', required: true },
    dockStationStart: { type: mongoose.Schema.Types.ObjectId, ref: 'Dock', required: true },
    dockStationEnd: { type: mongoose.Schema.Types.ObjectId, ref: 'Dock' },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    fare: { type: Number, default: 0 },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;