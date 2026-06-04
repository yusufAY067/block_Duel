require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/db');
const RoomManager = require('./roomManager');
const apiRoutes = require('./routes/apiRoutes');
const socketRoutes = require('./routes/socketRoutes');

// Connect Database
connectDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// REST API Routes
app.use('/api', apiRoutes);

const roomManager = new RoomManager(io);

const BRACKETS = {
    500: { fee: 100, reward: 175, refund: 100 },
    700: { fee: 150, reward: 260, refund: 150 },
    1000: { fee: 200, reward: 350, refund: 200 },
    2000: { fee: 400, reward: 700, refund: 400 },
    3000: { fee: 500, reward: 850, refund: 500 },
    5000: { fee: 800, reward: 1400, refund: 800 }
};

const queue = {};
Object.keys(BRACKETS).forEach(score => {
    queue[score] = [];
});

const socketToUser = {};
const userToSockets = {};
const activeChallenges = {};

function addSocketForUser(username, socketId) {
    if (!userToSockets[username]) {
        userToSockets[username] = new Set();
    }
    userToSockets[username].add(socketId);
    return userToSockets[username].size === 1;
}

function removeSocketForUser(username, socketId) {
    const sockets = userToSockets[username];
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
        delete userToSockets[username];
        return true;
    }
    return false;
}

function getAnySocketId(username) {
    const sockets = userToSockets[username];
    return sockets ? sockets.values().next().value : undefined;
}

function isUserOnline(username) {
    return !!userToSockets[username] && userToSockets[username].size > 0;
}

function getOnlineFriends(friendsArray, userToSocketsMap) {
    if (!friendsArray) return [];
    return friendsArray.map(f => ({
        username: f.username,
        fullTag: f.fullTag,
        isOnline: !!(userToSocketsMap[f.username] && userToSocketsMap[f.username].size)
    }));
}

// Socket.IO JWT Auth Middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded; // { userId, username }
        next();
    } catch (err) {
        return next(new Error('Authentication error: Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log('User connected via Socket:', socket.user.username);
    
    socketToUser[socket.id] = socket.user.username;
    const firstConnection = addSocketForUser(socket.user.username, socket.id);

    const state = {
        socketToUser,
        userToSockets,
        activeChallenges,
        queue,
        BRACKETS,
        roomManager,
        getOnlineFriends,
        getAnySocketId,
        removeSocketForUser,
        isUserOnline
    };

    socketRoutes(io, socket, state);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
