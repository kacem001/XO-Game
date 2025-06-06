const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Test endpoint
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Server is working!', 
        time: new Date(),
        activeRooms: gameRooms.size,
        activePlayers: playerSockets.size
    });
});

// Game rooms storage
const gameRooms = new Map();
const playerSockets = new Map();

// Room class to manage game state
class GameRoom {
    constructor(roomId, host) {
        this.roomId = roomId;
        this.host = host;
        this.players = [host];
        this.gameBoard = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.scores = { [host.id]: 0 };
        this.chatMessages = [];
        this.createdAt = new Date();
    }

    addPlayer(player) {
        if (this.players.length < 2) {
            this.players.push(player);
            this.scores[player.id] = 0;
            return true;
        }
        return false;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
        delete this.scores[playerId];
    }

    getOpponent(playerId) {
        return this.players.find(p => p.id !== playerId);
    }

    isFull() {
        return this.players.length >= 2;
    }

    isEmpty() {
        return this.players.length === 0;
    }

    resetGame() {
        this.gameBoard = ['', '', '', '', '', '', '', '', ''];
        this.currentPlayer = 'X';
        this.gameActive = true;
    }

    makeMove(index, playerId) {
        if (this.gameBoard[index] === '' && this.gameActive) {
            const player = this.players.find(p => p.id === playerId);
            const symbol = player.id === this.host.id ? 'X' : 'O';

            this.gameBoard[index] = symbol;

            // Check for win or draw
            const winResult = this.checkWin();
            if (winResult.won) {
                this.gameActive = false;
                this.scores[playerId]++;
                return { success: true, gameEnd: 'win', winner: playerId, winningCells: winResult.cells };
            } else if (this.checkDraw()) {
                this.gameActive = false;
                return { success: true, gameEnd: 'draw' };
            }

            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
            return { success: true, gameEnd: null };
        }
        return { success: false };
    }

    checkWin() {
        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        for (let combination of winningCombinations) {
            const [a, b, c] = combination;
            if (this.gameBoard[a] &&
                this.gameBoard[a] === this.gameBoard[b] &&
                this.gameBoard[a] === this.gameBoard[c]) {
                return { won: true, cells: combination };
            }
        }
        return { won: false };
    }

    checkDraw() {
        return this.gameBoard.every(cell => cell !== '');
    }

    addChatMessage(message, senderId, senderName) {
        const chatMessage = {
            id: Date.now(),
            message,
            senderId,
            senderName,
            timestamp: new Date()
        };
        this.chatMessages.push(chatMessage);

        // Keep only last 50 messages
        if (this.chatMessages.length > 50) {
            this.chatMessages = this.chatMessages.slice(-50);
        }

        return chatMessage;
    }
}

// Utility functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function cleanupEmptyRooms() {
    for (let [roomId, room] of gameRooms) {
        if (room.isEmpty() || (Date.now() - room.createdAt.getTime()) > 24 * 60 * 60 * 1000) {
            gameRooms.delete(roomId);
            console.log(`Cleaned up room: ${roomId}`);
        }
    }
}

// Clean up empty rooms every hour
setInterval(cleanupEmptyRooms, 60 * 60 * 1000);

// Socket connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Store socket reference
    playerSockets.set(socket.id, socket);
    
    // Send connection confirmation
    socket.emit('connected', { message: 'Connected successfully!' });

    // أضف هذين السطرين الجديدين:
    socket.on('room_created_confirm', (data) => {
        console.log(`Room creation confirmed for: ${data.roomId}`);
    });

    socket.on('ping', () => {
        socket.emit('pong');
    });

    socket.on('create_room', (playerData) => {
        try {
            const roomId = generateRoomId();
            const host = {
                id: socket.id,
                ...playerData,
                socketId: socket.id
            };

            const room = new GameRoom(roomId, host);
            gameRooms.set(roomId, room);

            socket.join(roomId);
            socket.roomId = roomId;

            console.log(`Room created: ${roomId} by ${host.name}`);

            socket.emit('room_created', {
                roomId,
                host: host,
                message: 'Room created successfully!'
            });

        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('room_error', { message: 'Failed to create room: ' + error.message });
        }
    });

    socket.on('join_room', (data) => {
        try {
            const { roomId, player } = data;
            const room = gameRooms.get(roomId);

            if (!room) {
                console.log(`Room ${roomId} not found`);
                socket.emit('room_error', { message: 'Room not found' });
                return;
            }

            if (room.isFull()) {
                console.log(`Room ${roomId} is full`);
                socket.emit('room_full');
                return;
            }

            const playerWithId = {
                id: socket.id,
                ...player,
                socketId: socket.id
            };

            room.addPlayer(playerWithId);
            socket.join(roomId);
            socket.roomId = roomId;

            console.log(`${player.name} joined room: ${roomId}`);

            // Notify the player that joined
            socket.emit('room_joined', {
                roomId,
                opponent: room.host,
                gameState: {
                    board: room.gameBoard,
                    currentPlayer: room.currentPlayer,
                    scores: room.scores
                },
                message: 'Successfully joined room!'
            });

            // Notify the host that someone joined
            socket.to(roomId).emit('player_joined', {
                player: playerWithId,
                gameState: {
                    board: room.gameBoard,
                    currentPlayer: room.currentPlayer,
                    scores: room.scores
                },
                message: `${player.name} joined the room!`
            });

        } catch (error) {
            console.error('Error joining room:', error);
            socket.emit('room_error', { message: 'Failed to join room: ' + error.message });
        }
    });

    socket.on('leave_room', (data) => {
        try {
            const roomId = socket.roomId || data?.roomId;
            if (!roomId) return;

            const room = gameRooms.get(roomId);
            if (!room) return;

            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                room.removePlayer(socket.id);
                socket.leave(roomId);
                delete socket.roomId;

                console.log(`${player.name} left room: ${roomId}`);

                // Notify other players
                socket.to(roomId).emit('player_left', { 
                    player,
                    message: `${player.name} left the room`
                });

                // Clean up empty room
                if (room.isEmpty()) {
                    gameRooms.delete(roomId);
                    console.log(`Room ${roomId} deleted - empty`);
                }
            }
        } catch (error) {
            console.error('Error leaving room:', error);
        }
    });

    socket.on('game_move', (data) => {
        try {
            const { roomId, index, player } = data;
            const room = gameRooms.get(roomId);

            if (!room) {
                socket.emit('room_error', { message: 'Room not found' });
                return;
            }

            const moveResult = room.makeMove(index, socket.id);

            if (moveResult.success) {
                // Broadcast move to all players in room
                io.to(roomId).emit('game_move', {
                    index,
                    player: player,
                    symbol: room.gameBoard[index],
                    gameState: {
                        board: room.gameBoard,
                        currentPlayer: room.currentPlayer,
                        active: room.gameActive,
                        scores: room.scores
                    },
                    gameEnd: moveResult.gameEnd,
                    winner: moveResult.winner,
                    winningCells: moveResult.winningCells
                });

                // Send turn notification to next player
                if (room.gameActive) {
                    const nextPlayer = room.getOpponent(socket.id);
                    if (nextPlayer) {
                        io.to(nextPlayer.socketId).emit('turn_notification', {
                            isYourTurn: true,
                            message: "It's your turn!"
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error handling game move:', error);
        }
    });

    socket.on('game_restart', (data) => {
        try {
            const { roomId } = data;
            const room = gameRooms.get(roomId);

            if (!room) return;

            room.resetGame();

            // Notify all players in room
            io.to(roomId).emit('game_restart', {
                gameState: {
                    board: room.gameBoard,
                    currentPlayer: room.currentPlayer,
                    active: room.gameActive,
                    scores: room.scores
                }
            });

            console.log(`Game restarted in room: ${roomId}`);

        } catch (error) {
            console.error('Error restarting game:', error);
        }
    });

    socket.on('chat_message', (data) => {
        try {
            const { roomId, message, sender } = data;
            const room = gameRooms.get(roomId);

            if (!room) return;

            const chatMessage = room.addChatMessage(message, socket.id, sender);

            // Broadcast message to other players in room (not sender)
            socket.to(roomId).emit('chat_message', {
                message: chatMessage.message,
                sender: chatMessage.senderName,
                timestamp: chatMessage.timestamp
            });

        } catch (error) {
            console.error('Error handling chat message:', error);
        }
    });

    // Test connection
    socket.on('test_connection', () => {
        socket.emit('test_response', { message: 'Connection working!' });
    });

    socket.on('disconnect', (reason) => {
        try {
            console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

            const roomId = socket.roomId;
            if (roomId) {
                const room = gameRooms.get(roomId);
                if (room) {
                    const player = room.players.find(p => p.id === socket.id);
                    if (player) {
                        room.removePlayer(socket.id);

                        // Notify other players
                        socket.to(roomId).emit('player_left', { 
                            player,
                            message: `${player.name} left the room`
                        });

                        // Clean up empty room
                        if (room.isEmpty()) {
                            gameRooms.delete(roomId);
                            console.log(`Room ${roomId} deleted - empty after disconnect`);
                        }
                    }
                }
            }

            playerSockets.delete(socket.id);

        } catch (error) {
            console.error('Error handling disconnect:', error);
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        activeRooms: gameRooms.size,
        activePlayers: playerSockets.size,
        timestamp: new Date().toISOString()
    });
});

// Get room info endpoint (for debugging)
app.get('/rooms', (req, res) => {
    const roomsInfo = Array.from(gameRooms.entries()).map(([id, room]) => ({
        id,
        players: room.players.length,
        active: room.gameActive,
        created: room.createdAt
    }));

    res.json(roomsInfo);
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
    console.log(`XO Game server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
