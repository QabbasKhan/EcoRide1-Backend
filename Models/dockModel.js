const mongoose = require('mongoose');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const dockSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    qrCode: { type: String, required: true, unique: true }, // QR code string
    qrCodeData: { type: String }, // QR code image data
    station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
    bike: { type: mongoose.Schema.Types.ObjectId, ref: 'Bike', default: null },
    status: { type: String, enum: ['empty', 'occupied'], default: 'empty' }
}, { timestamps: true });

// Pre-save middleware to generate and save the QR code
dockSchema.pre('save', async function(next) {
    if (this.isNew || this.isModified('qrCode')) {
        try {
            const qrCodeString = this.qrCode //|| `QR-${Math.random().toString(36).substring(2, 12).toUpperCase()}`;
            this.qrCode = qrCodeString;

            const qrCodeImageData = await QRCode.toDataURL(qrCodeString);

            // Change the directory path here
            const qrCodeDir = path.join(__dirname, 'qr_codess'); // Modify this path
            if (!fs.existsSync(qrCodeDir)) {
                fs.mkdirSync(qrCodeDir);
            }

            // Save QR code image
            const fileName = `${qrCodeString}.png`;
            const filePath = path.join(qrCodeDir, fileName);
            const base64Data = qrCodeImageData.replace(/^data:image\/png;base64,/, '');

            fs.writeFileSync(filePath, base64Data, 'base64');
            this.qrCodeImagePath = filePath;

            next();
        } catch (err) {
            next(err);
        }
    } else {
        next();
    }
});

const Dock = mongoose.model('Dock', dockSchema);

module.exports = Dock;
