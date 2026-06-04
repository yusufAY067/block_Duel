const { v4: uuidv4 } = require('uuid');
const GameLogic = require('./gameLogic');
const gameController = require('./controllers/gameController');

const GAME_DURATION = 3 * 60 * 1000; // 3 minutes
const TICK_RATE = 1000 / 10; // 10 FPS updates

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = {};
        this.playerRooms = {};
    }

    async createRoom(player1Id, player2Id, targetScore, p1User, p2User, bracketConfig, isRanked = true) {
        const roomId = uuidv4();
        
        const room = {
            id: roomId,
            targetScore,
            startTime: Date.now(),
            endTime: Date.now() + GAME_DURATION,
            bracketConfig,
            isRanked,
            users: {
                [player1Id]: p1User,
                [player2Id]: p2User
            },
            players: {
                [player1Id]: { logic: new GameLogic() },
                [player2Id]: { logic: new GameLogic() }
            },
            interval: null
        };

        this.rooms[roomId] = room;
        this.playerRooms[player1Id] = roomId;
        this.playerRooms[player2Id] = roomId;

        const p1Socket = this.io.sockets.sockets.get(player1Id);
        const p2Socket = this.io.sockets.sockets.get(player2Id);

        if (p1Socket) p1Socket.join(roomId);
        if (p2Socket) p2Socket.join(roomId);

        this.io.to(roomId).emit('matchFound', {
            roomId,
            targetScore,
            duration: GAME_DURATION,
            isRanked: room.isRanked
        });

        // Save to DB
        await gameController.createActiveRoom(roomId, [p1User, p2User], targetScore, GAME_DURATION);

        // Start game loop
        room.interval = setInterval(() => this.updateRoom(roomId), TICK_RATE);
        console.log(`Room ${roomId} created for ${p1User} and ${p2User}`);
    }

    updateRoom(roomId) {
        const room = this.rooms[roomId];
        if (!room) return;

        const timeLeft = Math.max(0, room.endTime - Date.now());
        
        const state = {
            timeLeft,
            players: {}
        };

        let winnerId = null;
        let reason = null;

        for (const [pId, pData] of Object.entries(room.players)) {
            const pState = pData.logic.getState();
            state.players[pId] = pState;

            if (pState.score >= room.targetScore) {
                winnerId = pId;
                reason = 'Target Score Reached';
            }
        }

        this.io.to(roomId).emit('gameState', state);

        if (timeLeft <= 0 && !winnerId) {
            const playerIds = Object.keys(room.players);
            const score1 = state.players[playerIds[0]].score;
            const score2 = state.players[playerIds[1]].score;

            if (score1 > score2) {
                winnerId = playerIds[0];
            } else if (score2 > score1) {
                winnerId = playerIds[1];
            } else {
                winnerId = 'draw';
            }
            reason = 'Time Up';
        }

        if (winnerId) {
            this.endGame(roomId, winnerId, reason);
        }
    }

    handlePlaceBlock(playerId, data) {
        const roomId = this.playerRooms[playerId];
        if (!roomId) return;

        const room = this.rooms[roomId];
        if (!room) return;

        const playerLogic = room.players[playerId].logic;
        const effect = playerLogic.placeBlock(data.x, data.y, data.shapeIndex);
        
        if (effect && (effect.clearedRows.length > 0 || effect.clearedCols.length > 0)) {
            this.io.to(playerId).emit('playEffect', effect);
        }

        if (effect && effect.gameOver) {
            const winnerId = Object.keys(room.players).find(id => id !== playerId);
            this.endGame(roomId, winnerId, 'No Moves Left');
        }
    }

    handleDisconnect(playerId) {
        const roomId = this.playerRooms[playerId];
        if (!roomId) return;

        const room = this.rooms[roomId];
        if (!room) return;

        const winnerId = Object.keys(room.players).find(id => id !== playerId);
        this.endGame(roomId, winnerId, 'Opponent Disconnected');
    }

    async endGame(roomId, winnerId, reason) {
        const room = this.rooms[roomId];
        if (!room) return;

        clearInterval(room.interval);

        const playerIds = Object.keys(room.players);
        
        let winnerUsername = null;
        if (winnerId && winnerId !== 'draw') {
            winnerUsername = room.users[winnerId];
        } else if (winnerId === 'draw') {
            winnerUsername = 'draw';
        }

        // Handle Economy
        if (room.isRanked) {
            if (winnerId && winnerId !== 'draw') {
                const newBal = await gameController.updateBalance(winnerUsername, room.bracketConfig.reward);
                this.io.to(winnerId).emit('balanceUpdate', newBal);
            } else if (winnerId === 'draw') {
                const u1 = room.users[playerIds[0]];
                const u2 = room.users[playerIds[1]];
                const bal1 = await gameController.updateBalance(u1, room.bracketConfig.refund);
                const bal2 = await gameController.updateBalance(u2, room.bracketConfig.refund);
                this.io.to(playerIds[0]).emit('balanceUpdate', bal1);
                this.io.to(playerIds[1]).emit('balanceUpdate', bal2);
            }
        }

        this.io.to(roomId).emit('gameEnd', { 
            winnerId, 
            reason,
            isRanked: room.isRanked,
            reward: room.bracketConfig ? room.bracketConfig.reward : 0,
            refund: room.bracketConfig ? room.bracketConfig.refund : 0
        });

        // Record Match in DB
        const pUsernames = [room.users[playerIds[0]], room.users[playerIds[1]]];
        const playerScores = playerIds.map(id => ({
            username: room.users[id],
            score: room.players[id].logic.getState().score
        }));
        await gameController.recordMatch(pUsernames, winnerUsername, room.targetScore, room.isRanked, playerScores);
        await gameController.endActiveRoom(roomId);

        // Cleanup
        playerIds.forEach(id => {
            delete this.playerRooms[id];
            const socket = this.io.sockets.sockets.get(id);
            if (socket) socket.leave(roomId);
        });

        delete this.rooms[roomId];
        console.log(`Room ${roomId} ended.`);
    }
}

module.exports = RoomManager;
