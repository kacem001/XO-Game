// Socket connection and online game functionality
let socket = null;
let isOnline = false;
let currentRoom = null;
let isRoomHost = false;
let onlineOpponent = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

// Initialize socket connection
function initializeSocket() {
    // Use the deployed server URL or localhost for development
    const serverUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : window.location.origin;

    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
    });

    setupSocketListeners();
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
        reconnectAttempts = 0;
        showToast('Connected to server', 'success');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showToast('Disconnected from server', 'error');
        handleDisconnection();
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        handleConnectionError();
    });

    // Room events
    socket.on('room_created', (data) => {
        currentRoom = data.roomId;
        isRoomHost = true;
        showToast(`Room ${data.roomId} created!`, 'success');

        // Navigate to game page with room info
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', data.roomId);
        localStorage.setItem('xo_is_host', 'true');
        localStorage.setItem('xo_current_player', JSON.stringify(onlinePlayerData));

        window.location.href = 'game.html';
    });

    socket.on('room_joined', (data) => {
        currentRoom = data.roomId;
        isRoomHost = false;
        onlineOpponent = data.opponent;
        showToast(`Joined room ${data.roomId}!`, 'success');

        // Navigate to game page
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', data.roomId);
        localStorage.setItem('xo_is_host', 'false');
        localStorage.setItem('xo_current_player', JSON.stringify(onlinePlayerData));
        localStorage.setItem('xo_opponent', JSON.stringify(data.opponent));

        window.location.href = 'game.html';
    });

    socket.on('room_error', (data) => {
        showToast(data.message, 'error');
        console.error('Room error:', data.message);
    });

    socket.on('player_joined', (data) => {
        onlineOpponent = data.player;
        showToast(`${data.player.name} joined the room!`, 'success');

        // Hide waiting overlay and start game
        if (typeof hideWaitingOverlay === 'function') {
            hideWaitingOverlay();
        }

        // Update opponent info in game
        if (typeof updateOpponentInfo === 'function') {
            updateOpponentInfo(data.player);
        }

        // Store opponent data
        localStorage.setItem('xo_opponent', JSON.stringify(data.player));
    });

    socket.on('player_left', (data) => {
        showToast(`${data.player.name} left the room`, 'warning');
        onlineOpponent = null;

        // Show waiting overlay if in game
        if (typeof showWaitingOverlay === 'function') {
            showWaitingOverlay();
        }

        // Reset game if in progress
        if (typeof resetGameForDisconnection === 'function') {
            resetGameForDisconnection();
        }
    });

    // Game events
    socket.on('game_move', (data) => {
        if (typeof handleOnlineMove === 'function') {
            handleOnlineMove(data.index, data.player);
        }
    });

    socket.on('game_state', (data) => {
        if (typeof updateGameState === 'function') {
            updateGameState(data);
        }
    });

    socket.on('game_restart', (data) => {
        if (typeof handleOnlineRestart === 'function') {
            handleOnlineRestart();
        }
        showToast('Game restarted by opponent', 'info');
    });

    socket.on('turn_notification', (data) => {
        if (data.isYourTurn) {
            showToast("It's your turn!", 'info');
            if (typeof showTurnNotification === 'function') {
                showTurnNotification();
            }
        }
    });

    // Chat events
    socket.on('chat_message', (data) => {
        if (typeof addChatMessage === 'function') {
            addChatMessage(data.message, data.sender, false);
        }
    });

    socket.on('room_full', () => {
        showToast('Room is full! Only 2 players allowed.', 'error');
    });
}

function handleConnectionError() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        showToast(`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`, 'warning');

        setTimeout(() => {
            if (socket) {
                socket.connect();
            }
        }, 2000 * reconnectAttempts);
    } else {
        showToast('Failed to connect to server. Please refresh the page.', 'error');
    }
}

function handleDisconnection() {
    isOnline = false;
    if (currentRoom && typeof showWaitingOverlay === 'function') {
        showWaitingOverlay();
    }
}

// Online game functions
function createOnlineRoom() {
    if (!socket || !socket.connected) {
        showToast('Not connected to server', 'error');
        return;
    }

    const playerName = document.getElementById('onlinePlayerName').value.trim();
    if (!playerName) {
        showToast('Please enter your name', 'error');
        return;
    }

    onlinePlayerData.name = playerName;
    savePlayerData();

    socket.emit('create_room', onlinePlayerData);
}

function joinOnlineRoom(roomId) {
    if (!socket || !socket.connected) {
        showToast('Not connected to server', 'error');
        return;
    }

    const playerName = document.getElementById('onlinePlayerName').value.trim();
    if (!playerName) {
        showToast('Please enter your name', 'error');
        return;
    }

    if (!roomId || roomId.length !== 6) {
        showToast('Please enter a valid room code', 'error');
        return;
    }

    onlinePlayerData.name = playerName;
    savePlayerData();

    socket.emit('join_room', { roomId: roomId.toUpperCase(), player: onlinePlayerData });
}

function sendGameMove(index) {
    if (socket && socket.connected && currentRoom) {
        socket.emit('game_move', {
            roomId: currentRoom,
            index: index,
            player: onlinePlayerData
        });
    }
}

function sendGameRestart() {
    if (socket && socket.connected && currentRoom) {
        socket.emit('game_restart', {
            roomId: currentRoom,
            player: onlinePlayerData
        });
    }
}

function sendChatMessage(message) {
    if (socket && socket.connected && currentRoom && message.trim()) {
        socket.emit('chat_message', {
            roomId: currentRoom,
            message: message.trim(),
            sender: onlinePlayerData.name
        });
        return true;
    }
    return false;
}

function leaveRoom() {
    if (socket && socket.connected && currentRoom) {
        socket.emit('leave_room', {
            roomId: currentRoom,
            player: onlinePlayerData
        });
    }

    currentRoom = null;
    isRoomHost = false;
    onlineOpponent = null;
    localStorage.removeItem('xo_room_id');
    localStorage.removeItem('xo_is_host');
    localStorage.removeItem('xo_opponent');
}

// Utility functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('active'), 100);

    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initialize socket when online features are needed
function initializeOnlineFeatures() {
    if (!socket) {
        initializeSocket();
    }
    isOnline = true;
}

// Cleanup socket connection
function cleanupSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    isOnline = false;
    currentRoom = null;
    isRoomHost = false;
    onlineOpponent = null;
}

// Export functions for use in other files
window.socketAPI = {
    initializeOnlineFeatures,
    createOnlineRoom,
    joinOnlineRoom,
    sendGameMove,
    sendGameRestart,
    sendChatMessage,
    leaveRoom,
    cleanupSocket,
    isConnected: () => socket && socket.connected,
    getCurrentRoom: () => currentRoom,
    isHost: () => isRoomHost,
    getOpponent: () => onlineOpponent
};