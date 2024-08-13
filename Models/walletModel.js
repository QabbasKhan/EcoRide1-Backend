const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    balance: { type: Number, default: 50 },
    transactions: [{
        amount: { type: Number, required: true },
        type: { type: String, enum: ['credit', 'debit'], required: true },
        date: { type: Date, default: Date.now },
        description: { type: String }
    }]
}, { timestamps: true });

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;