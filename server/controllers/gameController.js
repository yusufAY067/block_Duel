const User = require('../models/User');
const Match = require('../models/Match');
const Room = require('../models/Room');

module.exports = {
    async getBalance(username) {
        const user = await User.findOne({ username }).lean();
        return user ? user.coins : 0;
    },

    async updateBalance(username, change) {
        const user = await User.findOne({ username });
        if (user) {
            user.coins += change;
            await user.save();
            return user.coins;
        }
        return 0;
    },

    async recordMatch(playerUsernames, winnerUsername, targetScore, ranked) {
        try {
            const players = await User.find({ username: { $in: playerUsernames } });
            let winnerId = null;
            if (winnerUsername && winnerUsername !== 'draw') {
                const winner = players.find(p => p.username === winnerUsername);
                if (winner) winnerId = winner._id;
            }

            const match = new Match({
                players: players.map(p => p._id),
                winner: winnerId,
                targetScore,
                ranked
            });
            await match.save();
        } catch (err) {
            console.error("Match recording error:", err);
        }
    },

    async createActiveRoom(roomId, playerUsernames, targetScore, durationMs) {
        try {
            const players = await User.find({ username: { $in: playerUsernames } });
            const room = new Room({
                roomId,
                players: players.map(p => p._id),
                targetScore,
                timer: durationMs,
                status: 'active'
            });
            await room.save();
        } catch (err) {
            console.error("Room creation error:", err);
        }
    },

    async endActiveRoom(roomId) {
        try {
            await Room.findOneAndUpdate({ roomId }, { status: 'completed', timer: 0 });
        } catch (err) {
            console.error("Room end error:", err);
        }
    }
};
