const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    playerScores: [
        {
            playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            finalScore: { type: Number, default: 0 }
        }
    ],
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    targetScore: { type: Number, required: true },
    ranked: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
