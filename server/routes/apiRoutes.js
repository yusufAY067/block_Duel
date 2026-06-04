const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const socialController = require('../controllers/socialController');
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middleware/authMiddleware');

// Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Social Routes (Protected)
router.post('/social/add-friend', authMiddleware, socialController.addFriend);
router.post('/social/respond-request', authMiddleware, socialController.respondFriendRequest);
router.post('/social/remove-friend', authMiddleware, socialController.removeFriend);
router.get('/social/friends', authMiddleware, socialController.getFriends);

// Profile Routes
router.get('/profile/:username', async (req, res) => {
    try {
        const user = await gameController.getProfileStats(req.params.username);
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        res.json({
            userId: user.userId,
            username: user.username,
            coins: user.coins,
            wins: user.wins,
            losses: user.losses,
            highestScore: user.highestScore,
            rankPoints: user.rankPoints,
            currentStreak: user.currentStreak,
            bestStreak: user.bestStreak,
            achievements: user.achievements || [],
            selectedTheme: user.selectedTheme,
            selectedEffect: user.selectedEffect,
            selectedFrame: user.selectedFrame,
            selectedBadge: user.selectedBadge
        });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// Leaderboard Route
router.get('/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const users = await gameController.getLeaderboard(limit);
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// Shop Route (Protected)
router.get('/shop', authMiddleware, async (req, res) => {
    try {
        const username = req.user.username;
        const shop = await gameController.getShop(username);
        if (!shop) return res.status(404).json({ error: 'Mağaza yüklenemedi.' });
        res.json(shop);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// Buy Cosmetic Route (Protected)
router.post('/shop/buy', authMiddleware, async (req, res) => {
    try {
        const { type, itemId } = req.body;
        const username = req.user.username;

        if (!type || !itemId) {
            return res.status(400).json({ error: 'Tür ve ürün ID gerekli.' });
        }

        const result = await gameController.buyCosmeticItem(username, type, itemId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// Select Cosmetic Route (Protected)
router.post('/shop/select', authMiddleware, async (req, res) => {
    try {
        const { type, itemId } = req.body;
        const username = req.user.username;

        if (!type || !itemId) {
            return res.status(400).json({ error: 'Tür ve ürün ID gerekli.' });
        }

        const result = await gameController.selectCosmeticItem(username, type, itemId);
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
