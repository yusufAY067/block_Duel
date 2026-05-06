const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null means draw
    targetScore: { type: Number, required: true },
    ranked: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
