const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // e.g., Username#1903
    username: { type: String, required: true, unique: true, minlength: 3 },
    password: { type: String, required: true },
    coins: { type: Number, default: 1000 },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
