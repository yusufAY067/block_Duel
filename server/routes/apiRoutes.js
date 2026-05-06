const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const socialController = require('../controllers/socialController');
const authMiddleware = require('../middleware/authMiddleware');

// Auth Routes
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Social Routes (Protected)
router.post('/social/add-friend', authMiddleware, socialController.addFriend);
router.post('/social/respond-request', authMiddleware, socialController.respondFriendRequest);
router.get('/social/friends', authMiddleware, socialController.getFriends);

module.exports = router;
