let socket = null;
let isOnline = false;
let currentRoom = null;
let isRoomHost = false;
let onlineOpponent = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

const getServerUrl = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }
    // استخدام رابط Render الحقيقي
    return 'https://xo-game-server-rtty.onrender.com';
};

function initializeSocket() {
    const serverUrl = getServerUrl();
    console.log('Connecting to server:', serverUrl);
    
    try {
        socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            upgrade: true,
            timeout: 20000,
            forceNew: false,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            autoConnect: true,
            // إعدادات مهمة لـ Render
            secure: true,
            rejectUnauthorized: false
        });
        
        setupSocketListeners();
        
    } catch (error) {
        console.error('Failed to initialize socket:', error);
        showToast('Failed to connect to server', 'error');
    }
}

function setupSocketListeners() {
    socket.on('connect', () => {
        console.log('Connected to server successfully!');
        showToast('Connected to server', 'success');
        isOnline = true;
        reconnectAttempts = 0;
    });
    
    socket.on('connected', (data) => {
        console.log('Server confirmed connection:', data.message);
    });
    
    socket.on('disconnect', (reason) => {
        console.log('Disconnected from server. Reason:', reason);
        isOnline = false;
        
        // لا تظهر رسالة خطأ إذا كان الانقطاع مقصود
        if (reason !== 'io client disconnect') {
            showToast('Connection lost. Trying to reconnect...', 'warning');
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        handleConnectionError();
    });
    
    // Room events
    socket.on('room_created', (data) => {
        console.log('Room created successfully:', data);
        currentRoom = data.roomId;
        isRoomHost = true;
        
        // حفظ بيانات الغرفة
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', data.roomId);
        localStorage.setItem('xo_is_host', 'true');
        localStorage.setItem('xo_current_player', JSON.stringify(getCurrentPlayerData()));
        
        showToast(`Room ${data.roomId} created! Waiting for players...`, 'success');
        
        // إرسال تأكيد للخادم أن الغرفة تم إنشاؤها بنجاح
        socket.emit('room_created_confirm', { roomId: data.roomId });
        
        // عدم الانتقال مباشرة - البقاء في الصفحة الحالية حتى ينضم لاعب
        setTimeout(() => {
            showToast('Share room code: ' + data.roomId, 'info');
        }, 2000);
        
        // الانتقال فقط عند انضمام لاعب أو بعد مهلة طويلة
        setTimeout(() => {
            if (currentRoom) {
                window.location.href = 'game.html';
            }
        }, 30000); // 30 ثانية انتظار
    });
    
    socket.on('room_joined', (data) => {
        console.log('Room joined successfully:', data);
        currentRoom = data.roomId;
        isRoomHost = false;
        onlineOpponent = data.opponent;
        
        // حفظ بيانات الغرفة
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', data.roomId);
        localStorage.setItem('xo_is_host', 'false');
        localStorage.setItem('xo_current_player', JSON.stringify(getCurrentPlayerData()));
        localStorage.setItem('xo_opponent', JSON.stringify(data.opponent));
        
        showToast(`Joined room ${data.roomId}!`, 'success');
        
        // الانتقال للعبة فوراً
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    });
    
    socket.on('room_error', (data) => {
        console.error('Room error:', data.message);
        showToast(data.message, 'error');
        
        // إعادة محاولة إذا كانت الغرفة غير موجودة
        if (data.message === 'Room not found') {
            showToast('Room may have expired. Try creating a new one.', 'warning');
        }
    });
    
    socket.on('room_full', () => {
        showToast('Room is full! Only 2 players allowed.', 'error');
    });
    
    socket.on('player_joined', (data) => {
        console.log('Player joined room:', data);
        onlineOpponent = data.player;
        showToast(`${data.player.name} joined the room!`, 'success');
        
        // الآن يمكن الانتقال للعبة
        localStorage.setItem('xo_opponent', JSON.stringify(data.player));
        
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 2000);
    });
    
    socket.on('player_left', (data) => {
        console.log('Player left room:', data);
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
    
    socket.on('chat_message', (data) => {
        if (typeof addChatMessage === 'function') {
            addChatMessage(data.message, data.sender, false);
        }
    });
    
    // Test connection
    socket.on('test_response', (data) => {
        console.log('Test response:', data.message);
    });
}

function handleConnectionError() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        showToast(`Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`, 'warning');
        
        setTimeout(() => {
            if (socket && !socket.connected) {
                socket.connect();
            }
        }, 2000 * reconnectAttempts);
    } else {
        showToast('Failed to connect to server. Please refresh the page.', 'error');
    }
}

function createOnlineRoom() {
    if (!socket) {
        console.error('Socket not initialized');
        showToast('Connection not ready. Please try again.', 'error');
        return;
    }
    
    if (!socket.connected) {
        showToast('Not connected to server. Please wait...', 'error');
        
        // محاولة الاتصال مرة أخرى
        socket.connect();
        
        // انتظار الاتصال ثم المحاولة مرة أخرى
        setTimeout(() => {
            if (socket.connected) {
                createOnlineRoom();
            }
        }, 3000);
        return;
    }
    
    const playerData = getCurrentPlayerData();
    if (!playerData.name.trim()) {
        showToast('Please enter your name', 'error');
        return;
    }
    
    console.log('Creating room with player:', playerData);
    
    // إرسال heartbeat للتأكد من الاتصال
    socket.emit('test_connection');
    
    // إرسال طلب إنشاء الغرفة
    socket.emit('create_room', playerData);
    
    showToast('Creating room...', 'info');
}

function joinOnlineRoom(roomId) {
    if (!socket) {
        console.error('Socket not initialized');
        showToast('Connection not ready. Please try again.', 'error');
        return;
    }
    
    if (!socket.connected) {
        showToast('Not connected to server. Please wait...', 'error');
        
        // محاولة الاتصال مرة أخرى
        socket.connect();
        
        // انتظار الاتصال ثم المحاولة مرة أخرى
        setTimeout(() => {
            if (socket.connected) {
                joinOnlineRoom(roomId);
            }
        }, 3000);
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
    
    // إرسال heartbeat للتأكد من الاتصال
    socket.emit('test_connection');
    
    // إرسال طلب الانضمام للغرفة
    socket.emit('join_room', { 
        roomId: roomId.toUpperCase(), 
        player: playerData 
    });
    
    showToast('Joining room...', 'info');
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

function testConnection() {
    if (socket && socket.connected) {
        socket.emit('test_connection');
        showToast('Testing connection...', 'info');
    } else {
        console.log('Socket not connected');
        showToast('Not connected to server', 'error');
    }
}

function keepAlive() {
    if (socket && socket.connected) {
        socket.emit('ping');
    }
}

// إرسال ping كل 20 ثانية للحفاظ على الاتصال
setInterval(keepAlive, 20000);

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

// Export API
window.socketAPI = {
    initializeSocket,
    createOnlineRoom,
    joinOnlineRoom,
    testConnection,
    isConnected: () => socket && socket.connected,
    getCurrentRoom: () => currentRoom,
    isHost: () => isRoomHost,
    getOpponent: () => onlineOpponent
};

console.log('Socket.js loaded successfully');
