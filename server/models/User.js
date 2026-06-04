const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema({
    id: String,
    name: String,
    description: String,
    unlockedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true, minlength: 3 },
    password: { type: String, required: true },
    coins: { type: Number, default: 1000 },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    
    // Profile Stats
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    rankPoints: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    
    // Achievements
    achievements: [achievementSchema],
    
    // Cosmetics - Themes
    ownedThemes: { type: [String], default: ['classic'] },
    selectedTheme: { type: String, default: 'classic' },
    
    // Cosmetics - Effects
    ownedEffects: { type: [String], default: ['normal'] },
    selectedEffect: { type: String, default: 'normal' },
    
    // Cosmetics - Frames
    ownedFrames: { type: [String], default: ['bronze'] },
    selectedFrame: { type: String, default: 'bronze' },
    
    // Cosmetics - Badges
    ownedBadges: { type: [String], default: [] },
    selectedBadge: { type: String, default: null }
});

module.exports = mongoose.model('User', userSchema);
