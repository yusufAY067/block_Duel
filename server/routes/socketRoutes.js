const gameController = require('../controllers/gameController');
const User = require('../models/User');

module.exports = (io, socket, state) => {
    const { 
        socketToUser, 
        userToSocket, 
        activeChallenges, 
        queue, 
        BRACKETS, 
        roomManager,
        getOnlineFriends 
    } = state;

    socket.on('notifyFriendRequest', (data) => {
        const targetSocketId = userToSocket[data.targetUsername];
        if (targetSocketId) {
            io.to(targetSocketId).emit('friendRequestReceived', {
                username: socket.user.username,
                fullTag: data.meFullTag
            });
        }
    });

    socket.on('notifyFriendAccept', (data) => {
        const reqSocketId = userToSocket[data.requesterUsername];
        if (reqSocketId) {
            io.to(reqSocketId).emit('friendListUpdateNeeded'); 
            io.to(reqSocketId).emit('socialSuccess', `${data.myFullTag} arkadaşlık isteğini kabul etti.`);
        }
    });

    socket.on('tellFriendsOnline', async () => {
        try {
            const me = await User.findOne({ username: socket.user.username }).populate('friends').lean();
            if(me && me.friends) {
                me.friends.forEach(f => {
                    const fSocketId = userToSocket[f.username];
                    if (fSocketId) {
                        io.to(fSocketId).emit('friendStatusUpdate', {
                            username: socket.user.username,
                            isOnline: true
                        });
                    }
                });
            }
        } catch(err) {}
    });

    // --- Challenge Events ---
    socket.on('sendChallenge', async (data) => {
        const myUsername = socket.user.username;
        const targetSocketId = userToSocket[data.targetUsername];
        
        if (!targetSocketId) {
            return socket.emit('socialError', 'Kullanıcı çevrimdışı.');
        }

        if (data.isRanked) {
            const bracketConfig = BRACKETS[data.targetScore];
            if (!bracketConfig) return;
            const myCoins = await gameController.getBalance(myUsername);
            if (myCoins < bracketConfig.fee) {
                return socket.emit('errorMsg', 'Bu düello için yetersiz bakiye.');
            }
        }

        activeChallenges[myUsername] = data.targetUsername;

        const me = await User.findOne({ username: myUsername }).lean();

        io.to(targetSocketId).emit('challengeReceived', {
            challengerUsername: myUsername,
            challengerFullTag: me.userId,
            targetScore: data.targetScore,
            isRanked: data.isRanked
        });
        
        socket.emit('socialSuccess', 'Düello isteği gönderildi. Bekleniyor...');
    });

    socket.on('respondChallenge', async (data) => {
        const myUsername = socket.user.username;
        const challengerUsername = data.challengerUsername;
        const challengerSocketId = userToSocket[challengerUsername];

        if (activeChallenges[challengerUsername] !== myUsername) {
            return socket.emit('errorMsg', 'Düello isteği geçersiz veya süresi dolmuş.');
        }

        delete activeChallenges[challengerUsername];

        if (!data.accept) {
            if (challengerSocketId) {
                io.to(challengerSocketId).emit('socialError', `${myUsername} düello isteğini reddetti.`);
            }
            return;
        }

        if (!challengerSocketId) {
            return socket.emit('errorMsg', 'Rakip çevrimdışı oldu.');
        }

        const bracketConfig = BRACKETS[data.targetScore];
        
        if (data.isRanked) {
            if (!bracketConfig) return;
            const myCoins = await gameController.getBalance(myUsername);
            const challengerCoins = await gameController.getBalance(challengerUsername);
            
            if (myCoins < bracketConfig.fee || challengerCoins < bracketConfig.fee) {
                const msg = 'Bir oyuncunun bakiyesi yetersiz.';
                socket.emit('errorMsg', msg);
                io.to(challengerSocketId).emit('errorMsg', msg);
                return;
            }

            const newMyCoins = await gameController.updateBalance(myUsername, -bracketConfig.fee);
            const newChallengerCoins = await gameController.updateBalance(challengerUsername, -bracketConfig.fee);

            socket.emit('balanceUpdate', newMyCoins);
            io.to(challengerSocketId).emit('balanceUpdate', newChallengerCoins);
        }

        for (const score in queue) {
            queue[score] = queue[score].filter(id => id !== socket.id && id !== challengerSocketId);
        }

        roomManager.createRoom(challengerSocketId, socket.id, data.targetScore, challengerUsername, myUsername, bracketConfig, data.isRanked);
    });

    // --- Queue Events ---
    socket.on('joinQueue', async (targetScore) => {
        const username = socket.user.username;
        targetScore = parseInt(targetScore);
        const bracketConfig = BRACKETS[targetScore];
        
        if (!bracketConfig) return;

        const currentCoins = await gameController.getBalance(username);
        if (currentCoins < bracketConfig.fee) {
            socket.emit('errorMsg', 'Yetersiz bakiye (Not enough coins).');
            return;
        }

        if (!queue[targetScore].includes(socket.id)) {
            queue[targetScore].push(socket.id);
            socket.emit('queueStatus', 'Waiting for opponent...');
        }

        if (queue[targetScore].length >= 2) {
            const player1SocketId = queue[targetScore].shift();
            const player2SocketId = queue[targetScore].shift();

            const p1User = socketToUser[player1SocketId];
            const p2User = socketToUser[player2SocketId];

            const newP1Coins = await gameController.updateBalance(p1User, -bracketConfig.fee);
            const newP2Coins = await gameController.updateBalance(p2User, -bracketConfig.fee);

            io.to(player1SocketId).emit('balanceUpdate', newP1Coins);
            io.to(player2SocketId).emit('balanceUpdate', newP2Coins);

            roomManager.createRoom(player1SocketId, player2SocketId, targetScore, p1User, p2User, bracketConfig, true);
        }
    });

    socket.on('placeBlock', (data) => {
        roomManager.handlePlaceBlock(socket.id, data);
    });

    socket.on('disconnect', async () => {
        const username = socket?.user?.username;
        console.log('User disconnected:', username);
        
        if (username) {
            delete socketToUser[socket.id];
            delete userToSocket[username];
            
            if (activeChallenges[username]) delete activeChallenges[username];

            try {
                const User = require('../models/User');
                const me = await User.findOne({ username }).populate('friends').lean();
                if(me && me.friends) {
                    me.friends.forEach(f => {
                        const fSocketId = userToSocket[f.username];
                        if (fSocketId) {
                            io.to(fSocketId).emit('friendStatusUpdate', {
                                username: username,
                                isOnline: false
                            });
                        }
                    });
                }
            } catch (err) {}
        }

        for (const score in queue) {
            queue[score] = queue[score].filter(id => id !== socket.id);
        }
        roomManager.handleDisconnect(socket.id);
    });
};
