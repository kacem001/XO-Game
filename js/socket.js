// Socket connection
let socket = null;
let isOnline = false;
let currentRoom = null;
let isRoomHost = false;
let onlineOpponent = null;

// عنوان الخادم الحقيقي
const getServerUrl = () => {
    // ضع هنا رابط الخادم من Render بعد النشر
    if (window.location.hostname === 'localhost') {
        return 'http://localhost:3000';
    }
    return 'https://xo-game-server-rtty.onrender.com'; // سنغيره بعد النشر
};

function initializeSocket() {
    const serverUrl = getServerUrl();
    
    try {
        socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true
        });
        
        setupSocketListeners();
        
    } catch (error) {
        console.error('Failed to connect to server:', error);
        showToast('Failed to connect to server', 'error');
    }
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server');
        showToast('Connected to server', 'success');
        isOnline = true;
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showToast('Disconnected from server', 'error');
        isOnline = false;
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showToast('Cannot connect to server', 'error');
    });
    
    // Room events
    socket.on('room_created', (data) => {
        currentRoom = data.roomId;
        isRoomHost = true;
        console.log('Room created:', data.roomId);
        
        // حفظ بيانات الغرفة
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', data.roomId);
        localStorage.setItem('xo_is_host', 'true');
        localStorage.setItem('xo_current_player', JSON.stringify(getCurrentPlayerData()));
        
        showToast(`Room ${data.roomId} created!`, 'success');
        
        // الانتقال للعبة
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    });
    
    socket.on('room_joined', (data) => {
        currentRoom = data.roomId;
        isRoomHost = false;
        onlineOpponent = data.opponent;
        
        console.log('Joined room:', data.roomId);
        
        // حفظ بيانات الغرفة
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', data.roomId);
        localStorage.setItem('xo_is_host', 'false');
        localStorage.setItem('xo_current_player', JSON.stringify(getCurrentPlayerData()));
        localStorage.setItem('xo_opponent', JSON.stringify(data.opponent));
        
        showToast(`Joined room ${data.roomId}!`, 'success');
        
        // الانتقال للعبة
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    });
    
    socket.on('room_error', (data) => {
        console.error('Room error:', data.message);
        showToast(data.message, 'error');
    });
    
    socket.on('room_full', () => {
        showToast('Room is full! Only 2 players allowed.', 'error');
    });
    
    socket.on('player_joined', (data) => {
        console.log('Player joined:', data.player.name);
        onlineOpponent = data.player;
        showToast(`${data.player.name} joined the room!`, 'success');
        
        // إخفاء شاشة الانتظار إذا كنا في اللعبة
        if (typeof hideWaitingOverlay === 'function') {
            hideWaitingOverlay();
        }
        
        localStorage.setItem('xo_opponent', JSON.stringify(data.player));
    });
    
    socket.on('player_left', (data) => {
        console.log('Player left:', data.player.name);
        showToast(`${data.player.name} left the room`, 'warning');
        onlineOpponent = null;
        localStorage.removeItem('xo_opponent');
    });
    
    // Game events
    socket.on('game_move', (data) => {
        if (typeof handleOnlineMove === 'function') {
            handleOnlineMove(data);
        }
    });
    
    socket.on('game_restart', () => {
        if (typeof handleOnlineRestart === 'function') {
            handleOnlineRestart();
        }
    });
    
    socket.on('chat_message', (data) => {
        if (typeof addChatMessage === 'function') {
            addChatMessage(data.message, data.sender, false);
        }
    });
    
    socket.on('turn_notification', (data) => {
        if (data.isYourTurn) {
            showToast("It's your turn!", 'info');
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('XO Game', {
                    body: "It's your turn!",
                    icon: '/favicon.ico'
                });
            }
        }
    });
}

// دوال إرسال البيانات للخادم
function createOnlineRoom() {
    if (!socket || !socket.connected) {
        showToast('Not connected to server. Please wait...', 'error');
        return;
    }
    
    const playerData = getCurrentPlayerData();
    if (!playerData.name.trim()) {
        showToast('Please enter your name', 'error');
        return;
    }
    
    console.log('Creating room with player:', playerData);
    socket.emit('create_room', playerData);
}

function joinOnlineRoom(roomId) {
    if (!socket || !socket.connected) {
        showToast('Not connected to server. Please wait...', 'error');
        return;
    }
    
    const playerData = getCurrentPlayerData();
    if (!playerData.name.trim()) {
        showToast('Please enter your name', 'error');
        return;
    }
    
    if (!roomId || roomId.length !== 6) {
        showToast('Please enter a valid 6-character room code', 'error');
        return;
    }
    
    console.log('Joining room:', roomId, 'with player:', playerData);
    socket.emit('join_room', { 
        roomId: roomId.toUpperCase(), 
        player: playerData 
    });
}

function getCurrentPlayerData() {
    const nameInput = document.getElementById('onlinePlayerName');
    const savedData = localStorage.getItem('xo_online_player_data');
    
    let playerData = { name: 'Player', avatar: null };
    
    if (savedData) {
        try {
            playerData = JSON.parse(savedData);
        } catch (e) {
            console.error('Error parsing saved player data:', e);
        }
    }
    
    if (nameInput && nameInput.value.trim()) {
        playerData.name = nameInput.value.trim();
    }
    
    return playerData;
}

function sendGameMove(index) {
    if (socket && socket.connected && currentRoom) {
        socket.emit('game_move', {
            roomId: currentRoom,
            index: index,
            player: getCurrentPlayerData()
        });
    }
}

function sendChatMessage(message) {
    if (socket && socket.connected && currentRoom && message.trim()) {
        socket.emit('chat_message', {
            roomId: currentRoom,
            message: message.trim(),
            sender: getCurrentPlayerData().name
        });
        return true;
    }
    return false;
}

function leaveRoom() {
    if (socket && socket.connected && currentRoom) {
        socket.emit('leave_room', {
            roomId: currentRoom,
            player: getCurrentPlayerData()
        });
    }
    
    currentRoom = null;
    isRoomHost = false;
    onlineOpponent = null;
    localStorage.removeItem('xo_room_id');
    localStorage.removeItem('xo_is_host');
    localStorage.removeItem('xo_opponent');
}

function showToast(message, type = 'info') {
    console.log('Toast:', message, type);
    
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    const colors = {
        info: '#667eea',
        success: '#27ae60',
        error: '#e74c3c',
        warning: '#f39c12'
    };
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        z-index: 3000;
        max-width: 300px;
        font-family: 'Poppins', sans-serif;
        font-weight: 500;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// تصدير الدوال للاستخدام في ملفات أخرى
window.socketAPI = {
    initializeSocket,
    createOnlineRoom,
    joinOnlineRoom,
    sendGameMove,
    sendChatMessage,
    leaveRoom,
    isConnected: () => socket && socket.connected,
    getCurrentRoom: () => currentRoom,
    isHost: () => isRoomHost,
    getOpponent: () => onlineOpponent
};
