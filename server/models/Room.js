const mongoose = require('mongoose');

// Active Rooms tracking
const roomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    scores: { type: Map, of: Number, default: {} },
    targetScore: { type: Number, required: true },
    timer: { type: Number, required: true }, // Remaining time or end time
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);
