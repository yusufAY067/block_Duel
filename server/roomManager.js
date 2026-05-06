const { v4: uuidv4 } = require('uuid');
const GameLogic = require('./gameLogic');

const GAME_DURATION = 3 * 60 * 1000; // 3 minutes
const TICK_RATE = 1000 / 10; // 10 FPS updates

class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = {};
        this.playerRooms = {}; // Map socketId to roomId
    }

    createRoom(player1Id, player2Id, targetScore, playerBalances, p1User, p2User, bracketConfig, isRanked = true) {
        const roomId = uuidv4();
        
        const room = {
            id: roomId,
            targetScore,
            startTime: Date.now(),
            endTime: Date.now() + GAME_DURATION,
            playerBalances, // Reference to global balances helper
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
            duration: GAME_DURATION
        });

        // Start game loop
        room.interval = setInterval(() => this.updateRoom(roomId), TICK_RATE);
        console.log(`Room ${roomId} created for ${p1User} and ${p2User}`);
    }

    updateRoom(roomId) {
        const room = this.rooms[roomId];
        if (!room) return;

        const timeLeft = Math.max(0, room.endTime - Date.now());
        
        // Prepare state payload
        const state = {
            timeLeft,
            players: {}
        };

        let winnerId = null;
        let reason = null;

        for (const [pId, pData] of Object.entries(room.players)) {
            const pState = pData.logic.getState();
            state.players[pId] = pState;

            // Check win by target score
            if (pState.score >= room.targetScore) {
                winnerId = pId;
                reason = 'Target Score Reached';
            }
        }

        // Send state to room
        this.io.to(roomId).emit('gameState', state);

        // Check win by time
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
            // Emit visual effect trigger to the specific player
            this.io.to(playerId).emit('playEffect', effect);
        }

        if (effect && effect.gameOver) {
            // This player has no moves left, they lose
            const winnerId = Object.keys(room.players).find(id => id !== playerId);
            this.endGame(roomId, winnerId, 'No Moves Left');
        }
    }

    handleDisconnect(playerId) {
        const roomId = this.playerRooms[playerId];
        if (!roomId) return;

        const room = this.rooms[roomId];
        if (!room) return;

        // The remaining player wins
        const winnerId = Object.keys(room.players).find(id => id !== playerId);
        this.endGame(roomId, winnerId, 'Opponent Disconnected');
    }

    endGame(roomId, winnerId, reason) {
        const room = this.rooms[roomId];
        if (!room) return;

        clearInterval(room.interval);

        const playerIds = Object.keys(room.players);
        
        // Handle Economy
        if (room.isRanked) {
            if (winnerId && winnerId !== 'draw') {
                const winnerUser = room.users[winnerId];
                room.playerBalances.set(winnerUser, room.playerBalances.get(winnerUser) + room.bracketConfig.reward);
                this.io.to(winnerId).emit('balanceUpdate', room.playerBalances.get(winnerUser));
            } else if (winnerId === 'draw') {
                // Refund
                const u1 = room.users[playerIds[0]];
                const u2 = room.users[playerIds[1]];
                room.playerBalances.set(u1, room.playerBalances.get(u1) + room.bracketConfig.refund);
                room.playerBalances.set(u2, room.playerBalances.get(u2) + room.bracketConfig.refund);
                this.io.to(playerIds[0]).emit('balanceUpdate', room.playerBalances.get(u1));
                this.io.to(playerIds[1]).emit('balanceUpdate', room.playerBalances.get(u2));
            }
        }

        this.io.to(roomId).emit('gameEnd', { 
            winnerId, 
            reason,
            reward: room.bracketConfig.reward,
            refund: room.bracketConfig.refund
        });

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
