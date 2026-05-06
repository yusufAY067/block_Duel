const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

module.exports = {
    async addFriend(req, res) {
        try {
            const myUsername = req.user.username; // From token
            const { targetFullTag } = req.body;
            
            const me = await User.findOne({ username: myUsername });
            if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

            if (me.userId === targetFullTag) {
                return res.status(400).json({ error: 'Kendinize istek gönderemezsiniz.' });
            }

            const targetUser = await User.findOne({ userId: targetFullTag });
            if (!targetUser) {
                return res.status(404).json({ error: 'Hedef kullanıcı bulunamadı.' });
            }

            if (me.friends.includes(targetUser._id)) {
                return res.status(400).json({ error: 'Zaten arkadaşsınız.' });
            }

            const existingReq = await FriendRequest.findOne({ fromUser: me._id, toUser: targetUser._id, status: 'pending' });
            if (existingReq) {
                return res.status(400).json({ error: 'Zaten istek gönderilmiş.' });
            }

            const reverseReq = await FriendRequest.findOne({ fromUser: targetUser._id, toUser: me._id, status: 'pending' });
            if (reverseReq) {
                return res.status(400).json({ error: 'Karşı taraftan zaten size bir istek var.' });
            }

            const newReq = new FriendRequest({
                fromUser: me._id,
                toUser: targetUser._id
            });
            await newReq.save();
            
            res.json({ message: 'Arkadaşlık isteği gönderildi.', targetUsername: targetUser.username, meFullTag: me.userId });
        } catch (err) {
            res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
        }
    },

    async respondFriendRequest(req, res) {
        try {
            const myUsername = req.user.username;
            const { requesterUsername, accept } = req.body;

            const me = await User.findOne({ username: myUsername });
            const requester = await User.findOne({ username: requesterUsername });

            if (!me || !requester) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

            const reqDoc = await FriendRequest.findOne({ fromUser: requester._id, toUser: me._id, status: 'pending' });
            if (!reqDoc) return res.status(404).json({ error: 'İstek bulunamadı.' });

            reqDoc.status = accept ? 'accepted' : 'rejected';
            await reqDoc.save();

            if (accept) {
                if (!me.friends.includes(requester._id)) me.friends.push(requester._id);
                if (!requester.friends.includes(me._id)) requester.friends.push(me._id);
                await me.save();
                await requester.save();
            }

            const pendingReqs = await FriendRequest.find({ toUser: me._id, status: 'pending' }).populate('fromUser', 'userId username').lean();
            
            res.json({ 
                message: accept ? 'İstek kabul edildi.' : 'İstek reddedildi.',
                meUpdatedRequests: pendingReqs.map(r => ({ username: r.fromUser.username, fullTag: r.fromUser.userId })),
                accept,
                requesterUsername: requester.username,
                myFullTag: me.userId
            });
        } catch (err) {
            res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
        }
    },

    async getFriends(req, res) {
        try {
            const user = await User.findOne({ username: req.user.username }).populate('friends', 'userId username').lean();
            if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
            
            res.json({
                friends: user.friends.map(f => ({
                    username: f.username,
                    fullTag: f.userId
                }))
            });
        } catch (err) {
            res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
        }
    }
};
