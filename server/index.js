const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const RoomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

const roomManager = new RoomManager(io);

// Bracket Configuration
const BRACKETS = {
    500: { fee: 100, reward: 175, refund: 100 },
    700: { fee: 150, reward: 260, refund: 150 },
    1000: { fee: 200, reward: 350, refund: 200 },
    2000: { fee: 400, reward: 700, refund: 400 },
    3000: { fee: 500, reward: 850, refund: 500 },
    5000: { fee: 800, reward: 1400, refund: 800 }
};

// Queue system dynamically generated from BRACKETS
const queue = {};
Object.keys(BRACKETS).forEach(score => {
    queue[score] = [];
});

const USERS_FILE = path.join(__dirname, 'users.json');

// Helper to read/write users
function loadUsers() {
    try {
        if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '{}');
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error loading users:", e);
        return {};
    }
}

function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
        console.error("Error saving users:", e);
    }
}

// Global user balances for RoomManager to use (proxy to file)
const playerBalances = {
    get: function(username) {
        const users = loadUsers();
        return users[username] ? users[username].coins : 0;
    },
    set: function(username, amount) {
        const users = loadUsers();
        if (users[username]) {
            users[username].coins = amount;
            saveUsers(users);
        }
    }
};

// Maps
const socketToUser = {};
const userToSocket = {}; // username -> socket.id
// Active challenges: challenger_username -> target_username
const activeChallenges = {};

function generateUniqueTag(users, username) {
    let tag = Math.floor(1000 + Math.random() * 9000).toString();
    // simple collision check could be added here, but 1/9000 is small enough for MVP
    return tag;
}

function migrateUser(user, username, users) {
    let modified = false;
    if (!user.tag) {
        user.tag = generateUniqueTag(users, username);
        user.fullTag = `${username}#${user.tag}`;
        modified = true;
    }
    if (!user.friends) {
        user.friends = [];
        modified = true;
    }
    if (!user.friendRequests) {
        user.friendRequests = [];
        modified = true;
    }
    return modified;
}

function getOnlineFriends(users, username) {
    const user = users[username];
    if (!user || !user.friends) return [];
    
    return user.friends.map(friendUsername => {
        const f = users[friendUsername];
        if (!f) return null;
        return {
            username: friendUsername,
            fullTag: f.fullTag,
            isOnline: !!userToSocket[friendUsername]
        };
    }).filter(f => f !== null);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- Auth Events ---
    socket.on('register', (data) => {
        const { username, password } = data;
        if (!username || !password || username.length < 3) {
            return socket.emit('authError', 'Geçersiz kullanıcı adı veya şifre.');
        }

        const users = loadUsers();
        if (users[username]) {
            return socket.emit('authError', 'Kullanıcı adı zaten var.');
        }

        const tag = generateUniqueTag(users, username);
        users[username] = {
            password: password,
            coins: 1000,
            tag: tag,
            fullTag: `${username}#${tag}`,
            friends: [],
            friendRequests: []
        };
        saveUsers(users);
        
        socketToUser[socket.id] = username;
        userToSocket[username] = socket.id;
        
        socket.emit('authSuccess', { 
            username, 
            fullTag: users[username].fullTag,
            coins: users[username].coins,
            friends: getOnlineFriends(users, username),
            friendRequests: users[username].friendRequests
        });
    });

    socket.on('login', (data) => {
        const { username, password } = data;
        const users = loadUsers();

        if (!users[username] || users[username].password !== password) {
            return socket.emit('authError', 'Hatalı kullanıcı adı veya şifre.');
        }

        // Migrate old users
        if (migrateUser(users[username], username, users)) {
            saveUsers(users);
        }

        socketToUser[socket.id] = username;
        userToSocket[username] = socket.id;

        socket.emit('authSuccess', { 
            username, 
            fullTag: users[username].fullTag,
            coins: users[username].coins,
            friends: getOnlineFriends(users, username),
            friendRequests: users[username].friendRequests
        });

        // Notify friends that this user is online
        users[username].friends.forEach(fUsername => {
            const fSocketId = userToSocket[fUsername];
            if (fSocketId) {
                io.to(fSocketId).emit('friendStatusUpdate', {
                    username: username,
                    isOnline: true
                });
            }
        });
    });

    // --- Social Events ---
    socket.on('addFriend', (targetFullTag) => {
        const myUsername = socketToUser[socket.id];
        if (!myUsername) return;

        const users = loadUsers();
        const me = users[myUsername];

        if (targetFullTag === me.fullTag) {
            return socket.emit('socialError', 'Kendinize istek gönderemezsiniz.');
        }

        // Find target user by fullTag
        let targetUsername = null;
        for (const [uName, uData] of Object.entries(users)) {
            if (uData.fullTag === targetFullTag) {
                targetUsername = uName;
                break;
            }
        }

        if (!targetUsername) {
            return socket.emit('socialError', 'Kullanıcı bulunamadı.');
        }

        const targetUser = users[targetUsername];

        if (me.friends.includes(targetUsername)) {
            return socket.emit('socialError', 'Zaten arkadaşsınız.');
        }

        if (targetUser.friendRequests.some(req => req.username === myUsername)) {
            return socket.emit('socialError', 'Zaten istek gönderilmiş.');
        }

        // Add to target's requests
        targetUser.friendRequests.push({
            username: myUsername,
            fullTag: me.fullTag
        });
        saveUsers(users);

        // Notify target if online
        const targetSocketId = userToSocket[targetUsername];
        if (targetSocketId) {
            io.to(targetSocketId).emit('friendRequestReceived', {
                username: myUsername,
                fullTag: me.fullTag
            });
        }

        socket.emit('socialSuccess', 'Arkadaşlık isteği gönderildi.');
    });

    socket.on('respondFriendRequest', (data) => {
        // data: { requesterUsername, accept: boolean }
        const myUsername = socketToUser[socket.id];
        if (!myUsername) return;

        const users = loadUsers();
        const me = users[myUsername];
        const requesterUsername = data.requesterUsername;
        const requesterUser = users[requesterUsername];

        if (!requesterUser) return;

        // Remove from requests
        me.friendRequests = me.friendRequests.filter(req => req.username !== requesterUsername);

        if (data.accept) {
            if (!me.friends.includes(requesterUsername)) me.friends.push(requesterUsername);
            if (!requesterUser.friends.includes(myUsername)) requesterUser.friends.push(myUsername);
            
            // Notify both to update friends list
            socket.emit('friendListUpdate', getOnlineFriends(users, myUsername));
            
            const reqSocketId = userToSocket[requesterUsername];
            if (reqSocketId) {
                io.to(reqSocketId).emit('friendListUpdate', getOnlineFriends(users, requesterUsername));
                io.to(reqSocketId).emit('socialSuccess', `${me.fullTag} arkadaşlık isteğini kabul etti.`);
            }
        }

        saveUsers(users);
        
        // Return updated requests to me
        socket.emit('friendRequestsUpdate', me.friendRequests);
    });

    // --- Challenge Events ---
    socket.on('sendChallenge', (data) => {
        // data: { targetUsername, targetScore, isRanked }
        const myUsername = socketToUser[socket.id];
        if (!myUsername) return;

        const users = loadUsers();
        const me = users[myUsername];
        const targetSocketId = userToSocket[data.targetUsername];

        if (!targetSocketId) {
            return socket.emit('socialError', 'Kullanıcı çevrimdışı.');
        }

        // If ranked, check balances
        if (data.isRanked) {
            const bracketConfig = BRACKETS[data.targetScore];
            if (!bracketConfig) return;
            if (me.coins < bracketConfig.fee) {
                return socket.emit('errorMsg', 'Bu düello için yetersiz bakiye.');
            }
        }

        activeChallenges[myUsername] = data.targetUsername;

        io.to(targetSocketId).emit('challengeReceived', {
            challengerUsername: myUsername,
            challengerFullTag: me.fullTag,
            targetScore: data.targetScore,
            isRanked: data.isRanked
        });
        
        socket.emit('socialSuccess', 'Düello isteği gönderildi. Bekleniyor...');
    });

    socket.on('respondChallenge', (data) => {
        // data: { challengerUsername, accept: boolean, targetScore, isRanked }
        const myUsername = socketToUser[socket.id];
        if (!myUsername) return;

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
        
        // Deduct fees if ranked
        if (data.isRanked) {
            if (!bracketConfig) return;
            const myCoins = playerBalances.get(myUsername);
            const challengerCoins = playerBalances.get(challengerUsername);
            
            if (myCoins < bracketConfig.fee || challengerCoins < bracketConfig.fee) {
                const msg = 'Bir oyuncunun bakiyesi yetersiz.';
                socket.emit('errorMsg', msg);
                io.to(challengerSocketId).emit('errorMsg', msg);
                return;
            }

            playerBalances.set(myUsername, myCoins - bracketConfig.fee);
            playerBalances.set(challengerUsername, challengerCoins - bracketConfig.fee);

            socket.emit('balanceUpdate', playerBalances.get(myUsername));
            io.to(challengerSocketId).emit('balanceUpdate', playerBalances.get(challengerUsername));
        }

        // Remove from normal queues just in case
        for (const score in queue) {
            queue[score] = queue[score].filter(id => id !== socket.id && id !== challengerSocketId);
        }

        // Create Private Room
        roomManager.createRoom(challengerSocketId, socket.id, data.targetScore, playerBalances, challengerUsername, myUsername, bracketConfig, data.isRanked);
    });

    // --- Queue Events ---
    socket.on('joinQueue', (targetScore) => {
        const username = socketToUser[socket.id];
        if (!username) return socket.emit('errorMsg', 'You must be logged in.');

        targetScore = parseInt(targetScore);
        const bracketConfig = BRACKETS[targetScore];
        
        if (!bracketConfig) return;

        const currentCoins = playerBalances.get(username);
        if (currentCoins < bracketConfig.fee) {
            socket.emit('errorMsg', 'Yetersiz bakiye (Not enough coins).');
            return;
        }

        // Add to queue if not already in one
        if (!queue[targetScore].includes(socket.id)) {
            queue[targetScore].push(socket.id);
            socket.emit('queueStatus', 'Waiting for opponent...');
            console.log(`Player ${username} joined queue for ${targetScore}`);
        }

        // Check for match
        if (queue[targetScore].length >= 2) {
            const player1SocketId = queue[targetScore].shift();
            const player2SocketId = queue[targetScore].shift();

            const p1User = socketToUser[player1SocketId];
            const p2User = socketToUser[player2SocketId];

            // Deduct entry fee
            playerBalances.set(p1User, playerBalances.get(p1User) - bracketConfig.fee);
            playerBalances.set(p2User, playerBalances.get(p2User) - bracketConfig.fee);

            io.to(player1SocketId).emit('balanceUpdate', playerBalances.get(p1User));
            io.to(player2SocketId).emit('balanceUpdate', playerBalances.get(p2User));

            // Normal match is always ranked (isRanked = true)
            roomManager.createRoom(player1SocketId, player2SocketId, targetScore, playerBalances, p1User, p2User, bracketConfig, true);
        }
    });

    socket.on('placeBlock', (data) => {
        roomManager.handlePlaceBlock(socket.id, data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const username = socketToUser[socket.id];
        
        if (username) {
            delete socketToUser[socket.id];
            delete userToSocket[username];
            
            // Cleanup active challenges
            if (activeChallenges[username]) delete activeChallenges[username];

            // Notify friends offline status
            const users = loadUsers();
            if (users[username] && users[username].friends) {
                users[username].friends.forEach(fUsername => {
                    const fSocketId = userToSocket[fUsername];
                    if (fSocketId) {
                        io.to(fSocketId).emit('friendStatusUpdate', {
                            username: username,
                            isOnline: false
                        });
                    }
                });
            }
        }

        // Remove from queues
        for (const score in queue) {
            queue[score] = queue[score].filter(id => id !== socket.id);
        }
        roomManager.handleDisconnect(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
