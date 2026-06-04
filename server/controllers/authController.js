const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

const generateTag = async (username) => {
    let isUnique = false;
    let tag, userId;
    while (!isUnique) {
        tag = Math.floor(1000 + Math.random() * 9000).toString();
        userId = `${username}#${tag}`;
        const existing = await User.findOne({ userId });
        if (!existing) isUnique = true;
    }
    return userId;
};

const getPopulatedUser = async (user) => {
    const populated = await User.findById(user._id).populate('friends', 'userId username').lean();
    const requests = await FriendRequest.find({ toUser: user._id, status: 'pending' }).populate('fromUser', 'userId username').lean();
    
    return {
        _id: populated._id.toString(),
        username: populated.username,
        fullTag: populated.userId,
        coins: populated.coins,
        friends: populated.friends.map(f => ({
            username: f.username,
            fullTag: f.userId
        })),
        friendRequests: requests.map(req => ({
            username: req.fromUser.username,
            fullTag: req.fromUser.userId
        }))
    };
};

const generateToken = (userId, username) => {
    return jwt.sign({ userId, username }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

module.exports = {
    async register(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password || username.length < 3) {
                return res.status(400).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
            }

            const existing = await User.findOne({ username });
            if (existing) {
                return res.status(400).json({ error: 'Kullanıcı adı zaten var.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const userId = await generateTag(username);

            const newUser = new User({
                userId,
                username,
                password: hashedPassword,
                coins: 1000,
                wins: 0,
                losses: 0,
                highestScore: 0,
                rankPoints: 0,
                currentStreak: 0,
                bestStreak: 0,
                achievements: [],
                ownedThemes: ['classic'],
                selectedTheme: 'classic',
                ownedEffects: ['normal'],
                selectedEffect: 'normal',
                ownedFrames: ['bronze'],
                selectedFrame: 'bronze',
                ownedBadges: [],
                selectedBadge: null
            });

            await newUser.save();
            const userData = await getPopulatedUser(newUser);
            const token = generateToken(newUser._id, newUser.username);

            res.status(201).json({ user: userData, token });
        } catch (error) {
            res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
        }
    },

    async login(req, res) {
        try {
            const { username, password } = req.body;
            const user = await User.findOne({ username });
            if (!user) {
                return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Hatalı kullanıcı adı veya şifre.' });
            }

            const userData = await getPopulatedUser(user);
            const token = generateToken(user._id, user.username);

            res.json({ user: userData, token });
        } catch (error) {
            res.status(500).json({ error: 'Sunucu hatası: ' + error.message });
        }
    }
};
