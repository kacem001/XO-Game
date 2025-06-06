// Game state variables
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let gameMode = 'local';
let player1 = { name: 'Player 1', avatar: null, score: 0 };
let player2 = { name: 'Player 2', avatar: null, score: 0 };
let isMyTurn = true;
let roomId = null;
let isHost = false;
let unreadMessages = 0;
let isChatOpen = false;
let socket = null;
let onlinePlayerData = { name: 'Player', avatar: null };
let opponentData = { name: 'Opponent', avatar: null };
let connectionStable = false;
let heartbeatInterval = null;
let roomStatusInterval = null;

// Winning combinations
const winningCombinations = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
];

// Initialize game
document.addEventListener('DOMContentLoaded', function () {
    initializeGame();
    setupEventListeners();
    applyTheme();
});

function initializeGame() {
    // Load game data from localStorage
    gameMode = localStorage.getItem('xo_game_mode') || 'local';
    roomId = localStorage.getItem('xo_room_id');
    isHost = localStorage.getItem('xo_is_host') === 'true';

    console.log('🎮 Initializing game:', { gameMode, roomId, isHost });

    // Load player data
    const savedPlayer1 = localStorage.getItem('xo_player1_data');
    const savedPlayer2 = localStorage.getItem('xo_player2_data');
    const currentPlayerData = localStorage.getItem('xo_current_player');
    const opponentDataSaved = localStorage.getItem('xo_opponent');

    if (gameMode === 'local') {
        // Local game setup
        if (savedPlayer1) player1 = { ...player1, ...JSON.parse(savedPlayer1) };
        if (savedPlayer2) player2 = { ...player2, ...JSON.parse(savedPlayer2) };

        document.getElementById('gameModeIndicator').textContent = 'Local Game';
        document.getElementById('chatContainer').style.display = 'none';
        document.getElementById('chatFab').style.display = 'none';
    } else {
        // Online game setup
        console.log('🌐 Setting up online game...');
        
        if (currentPlayerData) {
            onlinePlayerData = JSON.parse(currentPlayerData);
            console.log('👤 Current player data loaded:', onlinePlayerData);
            
            if (isHost) {
                player1 = { ...player1, ...onlinePlayerData };
                if (opponentDataSaved) {
                    opponentData = JSON.parse(opponentDataSaved);
                    player2 = { ...player2, ...opponentData };
                    console.log('👥 Opponent data loaded for host:', opponentData);
                }
            } else {
                player2 = { ...player2, ...onlinePlayerData };
                if (opponentDataSaved) {
                    opponentData = JSON.parse(opponentDataSaved);
                    player1 = { ...player1, ...opponentData };
                    console.log('👥 Host data loaded for guest:', opponentData);
                }
            }
        }

        document.getElementById('gameModeIndicator').textContent = `Online Game - Room: ${roomId}`;
        document.getElementById('roomInfo').style.display = 'flex';
        document.getElementById('roomCodeDisplay').textContent = roomId;
        document.getElementById('chatContainer').style.display = 'none';
        document.getElementById('chatFab').style.display = 'flex';

        // Initialize online features
        initializeOnlineMode();

        // Set turn based on host status
        isMyTurn = isHost;
        if (!isHost) {
            currentPlayer = 'O';
        }

        // Show waiting overlay if no opponent
        if (!localStorage.getItem('xo_opponent')) {
            showWaitingOverlay();
        }
    }

    updatePlayerInfo();
    updateTurnIndicator();
    initializeBoard();
}

function initializeOnlineMode() {
    console.log('🔌 Initializing online mode...');
    
    if (!window.io) {
        console.log('📦 Loading Socket.io...');
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
        script.onload = () => {
            console.log('✅ Socket.io loaded, setting up connection...');
            setupSocketConnection();
        };
        script.onerror = () => {
            console.error('❌ Failed to load Socket.io');
            showToast('Failed to load connection library', 'error');
        };
        document.head.appendChild(script);
    } else {
        console.log('✅ Socket.io already loaded, setting up connection...');
        setupSocketConnection();
    }
}

function setupSocketConnection() {
    const serverUrl = window.location.hostname === 'localhost' ? 
        'http://localhost:3000' : 
        'https://xo-game-server-rtty.onrender.com';
    
    console.log('🔗 Connecting to server:', serverUrl);
    
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 30000,
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 3000,
        forceNew: false,
        autoConnect: true
    });
    
    // إضافة مؤشر الاتصال
    socket.on('connect', () => {
        console.log('✅ Connected to game server. Socket ID:', socket.id);
        connectionStable = true;
        showToast('Connected to server', 'success');
        
        // إيقاف الـ heartbeat القديم
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        
        // فحص حالة الغرفة عند الاتصال
        if (roomId) {
            console.log('🔄 Rejoining room:', roomId);
            socket.emit('rejoin_room', {
                roomId: roomId,
                player: onlinePlayerData
            });
            
            // بدء طلب حالة الغرفة بشكل منتظم
            startRoomStatusFetching();
        }
        
        // بدء الـ heartbeat
        startHeartbeat();
    });
    
    socket.on('disconnect', (reason) => {
        console.log('💔 Disconnected from server. Reason:', reason);
        connectionStable = false;
        showToast('Connection lost. Reconnecting...', 'warning');
        
        // إيقاف الـ intervals
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        if (roomStatusInterval) {
            clearInterval(roomStatusInterval);
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        connectionStable = false;
        showToast('Connection failed. Retrying...', 'error');
    });
    
    socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        connectionStable = true;
        showToast('Reconnected to server', 'success');
        
        if (roomId) {
            socket.emit('rejoin_room', {
                roomId: roomId,
                player: onlinePlayerData
            });
            startRoomStatusFetching();
        }
    });
    
    // Room events
    socket.on('player_joined', (data) => {
        console.log('👥 Player joined:', data);
        updateOpponentInfo(data.player);
        hideWaitingOverlay();
        showToast(`${data.player.name} joined the game!`, 'success');
        localStorage.setItem('xo_opponent', JSON.stringify(data.player));
        
        // تحديث حالة اللعبة
        if (data.gameState) {
            updateGameState(data.gameState);
        }
    });
    
    socket.on('player_left', (data) => {
        console.log('👋 Player left:', data);
        showToast(`${data.player.name} left the game`, 'warning');
        showWaitingOverlay();
        localStorage.removeItem('xo_opponent');
        
        // Reset opponent info
        if (isHost) {
            player2 = { name: 'Player 2', avatar: null, score: 0 };
        } else {
            player1 = { name: 'Player 1', avatar: null, score: 0 };
        }
        updatePlayerInfo();
    });
    
    // Game events
    socket.on('game_move', (data) => {
        console.log('🎯 Received move from server:', data);
        handleOnlineGameMove(data);
    });
    
    socket.on('game_restart', (data) => {
        console.log('🔄 Game restarted by opponent');
        handleOnlineRestart();
    });
    
    socket.on('game_state', (data) => {
        console.log('📊 Received game state:', data);
        if (data.gameState) {
            updateGameState(data.gameState);
        }
        if (data.players && data.players.length > 1) {
            const opponent = data.players.find(p => p.name !== onlinePlayerData.name);
            if (opponent) {
                updateOpponentInfo(opponent);
                hideWaitingOverlay();
            }
        }
    });
    
    // Chat events
    socket.on('chat_message', (data) => {
        console.log('💬 Received chat message:', data);
        const senderName = isHost ? player2.name : player1.name;
        addChatMessage(data.message, senderName, false);
    });
    
    socket.on('turn_notification', (data) => {
        console.log('🔔 Turn notification:', data);
        if (data.isYourTurn) {
            isMyTurn = true;
            updateBoardState();
            showTurnNotification();
            showToast("Your turn!", 'info');
        }
    });

    socket.on('room_error', (data) => {
        console.error('🚫 Room error:', data.message);
        showToast(data.message, 'error');
        if (data.message.includes('not found')) {
            // الغرفة غير موجودة - العودة للقائمة الرئيسية
            setTimeout(() => {
                goBack();
            }, 2000);
        }
    });

    socket.on('move_error', (data) => {
        console.error('🚫 Move error:', data.message);
        showToast(data.message, 'error');
    });

    socket.on('pong', () => {
        console.log('💓 Heartbeat response received');
    });

    // تنظيف عند مغادرة الصفحة
    window.addEventListener('beforeunload', () => {
        cleanup();
    });

    // تنظيف عند إخفاء الصفحة (للموبايل)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('📱 Page hidden - maintaining connection');
        } else {
            console.log('📱 Page visible - checking connection');
            if (socket && !socket.connected) {
                socket.connect();
            }
        }
    });
}

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('ping');
            console.log('💓 Heartbeat sent');
        } else {
            console.log('💔 Socket not connected, stopping heartbeat');
            clearInterval(heartbeatInterval);
        }
    }, 20000); // كل 20 ثانية
}

function startRoomStatusFetching() {
    if (roomStatusInterval) {
        clearInterval(roomStatusInterval);
    }
    
    roomStatusInterval = setInterval(() => {
        if (gameMode === 'online' && roomId && connectionStable) {
            fetchRoomStatus();
        }
    }, 15000); // كل 15 ثانية
}

function cleanup() {
    console.log('🧹 Cleaning up connections...');
    
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    
    if (roomStatusInterval) {
        clearInterval(roomStatusInterval);
        roomStatusInterval = null;
    }
    
    if (socket && socket.connected) {
        socket.emit('leave_room', {
            roomId: roomId,
            player: onlinePlayerData
        });
    }
}

// دالة لطلب حالة الغرفة من الخادم
async function fetchRoomStatus() {
    try {
        const serverUrl = window.location.hostname === 'localhost' ? 
            'http://localhost:3000' : 
            'https://xo-game-server-rtty.onrender.com';
            
        const response = await fetch(`${serverUrl}/rooms`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rooms = await response.json();
        const currentRoom = rooms.find(room => room.id === roomId);
        
        if (currentRoom) {
            console.log('📊 Current room status:', currentRoom);
            
            // تحديث حالة اللعبة إذا تغيرت
            if (currentRoom.board && 
                JSON.stringify(currentRoom.board) !== JSON.stringify(gameBoard)) {
                console.log('🔄 Board updated from server');
                gameBoard = [...currentRoom.board];
                gameActive = currentRoom.active;
                currentPlayer = currentRoom.currentPlayer;
                initializeBoard();
                updateTurnIndicator();
            }
            
            // تحديث معلومات اللاعبين
            if (currentRoom.playerNames && currentRoom.playerNames.length > 1) {
                hideWaitingOverlay();
            } else if (currentRoom.playerNames && currentRoom.playerNames.length === 1) {
                showWaitingOverlay();
            }
            
            // تحديث النقاط
            if (currentRoom.scores) {
                if (isHost) {
                    player1.score = currentRoom.scores[onlinePlayerData.name] || 0;
                    const opponentName = currentRoom.playerNames.find(name => name !== onlinePlayerData.name);
                    if (opponentName) {
                        player2.score = currentRoom.scores[opponentName] || 0;
                    }
                } else {
                    player2.score = currentRoom.scores[onlinePlayerData.name] || 0;
                    const hostName = currentRoom.playerNames.find(name => name !== onlinePlayerData.name);
                    if (hostName) {
                        player1.score = currentRoom.scores[hostName] || 0;
                    }
                }
                updatePlayerInfo();
            }
            
        } else {
            console.log('⚠️ Room not found in server');
            // الغرفة غير موجودة - قد تكون انتهت صلاحيتها
            showToast('Room not found on server', 'warning');
        }
    } catch (error) {
        console.error('❌ Failed to fetch room status:', error);
        // لا تعرض رسالة خطأ للمستخدم لأن هذا يحدث في الخلفية
    }
}

function updateGameState(gameState) {
    console.log('🔄 Updating game state:', gameState);
    
    if (gameState.board) {
        gameBoard = [...gameState.board];
    }
    if (typeof gameState.active !== 'undefined') {
        gameActive = gameState.active;
    }
    if (gameState.currentPlayer) {
        currentPlayer = gameState.currentPlayer;
    }
    if (gameState.scores) {
        if (isHost) {
            player1.score = gameState.scores[onlinePlayerData.name] || 0;
            const opponentName = Object.keys(gameState.scores).find(name => name !== onlinePlayerData.name);
            if (opponentName) {
                player2.score = gameState.scores[opponentName] || 0;
            }
        } else {
            player2.score = gameState.scores[onlinePlayerData.name] || 0;
            const hostName = Object.keys(gameState.scores).find(name => name !== onlinePlayerData.name);
            if (hostName) {
                player1.score = gameState.scores[hostName] || 0;
            }
        }
    }
    
    // تحديث الواجهة
    initializeBoard();
    updateTurnIndicator();
    updatePlayerInfo();
    
    // تحديث حالة الدور
    isMyTurn = (isHost && currentPlayer === 'X') || (!isHost && currentPlayer === 'O');
    updateBoardState();
}

function setupEventListeners() {
    // Board click events
    document.querySelectorAll('.cell').forEach((cell, index) => {
        cell.addEventListener('click', () => handleCellClick(index));
    });

    // Chat functionality
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Enable notifications
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function initializeBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        // تنظيف الخلية
        cell.textContent = '';
        cell.classList.remove('winning', 'disabled', 'x-symbol', 'o-symbol');
        
        // إضافة المحتوى من gameBoard
        const content = gameBoard[index];
        if (content) {
            cell.textContent = content;
            cell.classList.add(content === 'X' ? 'x-symbol' : 'o-symbol');
            console.log(`🎯 Setting cell ${index} to ${content}`);
        }
        
        // إضافة data-index للتسهيل
        cell.setAttribute('data-index', index);

        // تعطيل الخلايا حسب الوضع
        if (gameMode === 'online' && (!isMyTurn || !gameActive)) {
            cell.classList.add('disabled');
        }
    });
    
    console.log('📋 Board updated:', gameBoard);
}

function updatePlayerInfo() {
    // Update player 1 info
    const player1NameEl = document.getElementById('player1Name');
    const player1ScoreEl = document.getElementById('player1Score');
    if (player1NameEl) player1NameEl.textContent = player1.name;
    if (player1ScoreEl) player1ScoreEl.textContent = player1.score;
    if (player1.avatar) {
        setPlayerAvatar('player1Avatar', 'player1Icon', player1.avatar);
    }

    // Update player 2 info
    const player2NameEl = document.getElementById('player2Name');
    const player2ScoreEl = document.getElementById('player2Score');
    if (player2NameEl) player2NameEl.textContent = player2.name;
    if (player2ScoreEl) player2ScoreEl.textContent = player2.score;
    if (player2.avatar) {
        setPlayerAvatar('player2Avatar', 'player2Icon', player2.avatar);
    }
}

function setPlayerAvatar(avatarId, iconId, avatarData) {
    const avatarElement = document.getElementById(avatarId);
    const iconElement = document.getElementById(iconId);

    if (avatarElement && iconElement) {
        if (avatarData) {
            avatarElement.src = avatarData;
            avatarElement.style.display = 'block';
            iconElement.style.display = 'none';
        } else {
            avatarElement.style.display = 'none';
            iconElement.style.display = 'block';
        }
    }
}

function handleCellClick(index) {
    console.log(`🖱️ Cell clicked: ${index}`);
    console.log(`Current state: gameActive=${gameActive}, isMyTurn=${isMyTurn}, cell=${gameBoard[index]}`);
    
    // Check if cell is already filled or game is not active
    if (gameBoard[index] !== '' || !gameActive) {
        console.log('❌ Cell already filled or game not active');
        showToast('Invalid move', 'warning');
        return;
    }

    // Check if it's online game and not player's turn
    if (gameMode === 'online' && !isMyTurn) {
        showToast("It's not your turn!", 'warning');
        console.log('❌ Not your turn');
        return;
    }

    // Check connection for online games
    if (gameMode === 'online' && (!socket || !socket.connected)) {
        showToast("Connection lost. Please wait...", 'error');
        console.log('❌ No connection');
        return;
    }

    console.log('✅ Making move at index:', index, 'Player data:', onlinePlayerData);

    // Make the move locally first for immediate feedback
    const mySymbol = (gameMode === 'online') ? (isHost ? 'X' : 'O') : currentPlayer;
    gameBoard[index] = mySymbol;
    
    // تحديث الواجهة فوراً
    const cell = document.querySelector(`[data-index="${index}"]`);
    if (cell) {
        cell.textContent = mySymbol;
        cell.classList.add(mySymbol === 'X' ? 'x-symbol' : 'o-symbol');
        console.log(`✅ Updated cell ${index} with ${mySymbol}`);
    }

    // Play sound effect
    playSound('move');

    // Send move to server if online game
    if (gameMode === 'online' && socket && socket.connected) {
        console.log('📡 Sending move to server:', {
            roomId: roomId,
            index: index,
            player: onlinePlayerData
        });
        
        socket.emit('game_move', {
            roomId: roomId,
            index: index,
            player: onlinePlayerData
        });
        
        isMyTurn = false;
        updateBoardState();
        showToast("Move sent! Waiting for opponent...", 'info');
    } else if (gameMode === 'local') {
        // Local game logic
        if (checkWin()) {
            endGame('win');
        } else if (checkDraw()) {
            endGame('draw');
        } else {
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            updateTurnIndicator();
        }
    }
}

function handleOnlineGameMove(data) {
    console.log('🎯 Handling online move:', data);
    
    const { index, symbol, gameState, gameEnd, winner, winningCells } = data;
    
    // تحديث اللوحة من الخادم
    if (gameState && gameState.board) {
        console.log('📋 Updating board from server');
        console.log('Old board:', gameBoard);
        console.log('New board:', gameState.board);
        
        gameBoard = [...gameState.board];
        gameActive = gameState.active;
        currentPlayer = gameState.currentPlayer;
        
        // تحديث الواجهة
        initializeBoard();
        
        // Play sound effect for opponent's move (not your own)
        const isMyMove = (isHost && symbol === 'X') || (!isHost && symbol === 'O');
        if (!isMyMove) {
            playSound('move');
            console.log(`🔊 Playing sound for opponent's move: ${symbol}`);
        }
    }
    
    // تحديث النتائج
    if (gameState && gameState.scores) {
        if (isHost) {
            player1.score = gameState.scores[onlinePlayerData.name] || 0;
            const opponentName = Object.keys(gameState.scores).find(name => name !== onlinePlayerData.name);
            if (opponentName) {
                player2.score = gameState.scores[opponentName] || 0;
            }
        } else {
            player2.score = gameState.scores[onlinePlayerData.name] || 0;
            const hostName = Object.keys(gameState.scores).find(name => name !== onlinePlayerData.name);
            if (hostName) {
                player1.score = gameState.scores[hostName] || 0;
            }
        }
        updatePlayerInfo();
    }
    
    // التحقق من انتهاء اللعبة
    if (gameEnd) {
        gameActive = false;
        
        if (gameEnd === 'win') {
            // تحديد الفائز
            const isMyWin = winner === onlinePlayerData.name;
            const message = isMyWin ? 'You win! 🎉' : 'You lose! 😔';
            
            if (winningCells) {
                highlightWinningCells(winningCells);
            }
            
            showGameResult('win', message);
            playSound('win');
            
        } else if (gameEnd === 'draw') {
            showGameResult('draw', "It's a draw! 🤝");
        }
        
    } else {
        // تحديد الدور التالي
        isMyTurn = (isHost && currentPlayer === 'X') || (!isHost && currentPlayer === 'O');
        updateBoardState();
        
        if (isMyTurn) {
            showToast("Your turn! 🎯", 'info');
            showTurnNotification();
        } else {
            showToast("Opponent's turn ⏳", 'info');
        }
    }
}

function checkWin() {
    for (let combination of winningCombinations) {
        const [a, b, c] = combination;
        if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
            highlightWinningCells(combination);
            return true;
        }
    }
    return false;
}

function checkDraw() {
    return gameBoard.every(cell => cell !== '');
}

function highlightWinningCells(combination) {
    combination.forEach(index => {
        const cell = document.querySelector(`[data-index="${index}"]`);
        if (cell) {
            cell.classList.add('winning');
        }
    });
}

function endGame(result) {
    gameActive = false;

    let winner = null;
    let message = '';

    if (result === 'win') {
        if (gameMode === 'local') {
            winner = currentPlayer === 'X' ? player1 : player2;
            winner.score++;
            message = `${winner.name} wins! 🎉`;
        } else {
            return;
        }
        playSound('win');
    } else {
        message = "It's a draw! 🤝";
    }

    updatePlayerInfo();
    showGameResult(result, message);

    if (gameMode === 'online') {
        sendNotification(message);
    }
}

function showGameResult(result, message) {
    const modal = document.getElementById('gameResultModal');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');

    if (modal && resultIcon && resultTitle && resultMessage) {
        if (result === 'win') {
            resultIcon.innerHTML = '<i class="fas fa-trophy"></i>';
            resultIcon.className = 'result-icon win';
            resultTitle.textContent = 'Congratulations!';
        } else {
            resultIcon.innerHTML = '<i class="fas fa-handshake"></i>';
            resultIcon.className = 'result-icon draw';
            resultTitle.textContent = 'Game Over!';
        }

        resultMessage.textContent = message;
        modal.classList.add('active');
    }
}

function updateTurnIndicator() {
    const turnIndicator = document.getElementById('turnIndicator');
    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');

    if (!turnIndicator || !player1Info || !player2Info) return;

    player1Info.classList.remove('current-player');
    player2Info.classList.remove('current-player');

    if (gameMode === 'local') {
        const currentPlayerName = currentPlayer === 'X' ? player1.name : player2.name;
        turnIndicator.textContent = `${currentPlayerName}'s Turn`;

        if (currentPlayer === 'X') {
            player1Info.classList.add('current-player');
        } else {
            player2Info.classList.add('current-player');
        }
    } else {
        if (isMyTurn) {
            turnIndicator.textContent = "Your Turn 🎯";
            if (isHost) {
                player1Info.classList.add('current-player');
            } else {
                player2Info.classList.add('current-player');
            }
        } else {
            turnIndicator.textContent = "Opponent's Turn ⏳";
            if (isHost) {
                player2Info.classList.add('current-player');
            } else {
                player1Info.classList.add('current-player');
            }
        }
    }
}

function updateBoardState() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        if (gameMode === 'online') {
            if (isMyTurn && gameActive && cell.textContent === '') {
                cell.classList.remove('disabled');
            } else {
                cell.classList.add('disabled');
            }
        }
    });
    updateTurnIndicator();
}

function updateOpponentInfo(opponent) {
    console.log('👥 Updating opponent info:', opponent);
    opponentData = opponent;
    
    if (isHost) {
        player2 = { ...player2, ...opponent };
    } else {
        player1 = { ...player1, ...opponent };
    }
    updatePlayerInfo();
}

function handleOnlineRestart() {
    resetGame();
    showToast('Game restarted by opponent 🔄', 'info');
}

function showWaitingOverlay() {
    const overlay = document.getElementById('waitingOverlay');
    const roomCode = document.getElementById('waitingRoomCode');

    if (roomCode && roomId) {
        roomCode.textContent = roomId;
    }

    if (overlay) {
        overlay.style.display = 'flex';
        console.log('👀 Showing waiting overlay');
    }
}

function hideWaitingOverlay() {
    const overlay = document.getElementById('waitingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        console.log('🙈 Hiding waiting overlay');
    }
}

// Game control functions
function restartGame() {
    if (gameMode === 'online' && socket && socket.connected) {
        socket.emit('game_restart', { roomId: roomId });
    }
    resetGame();
}

function resetGame() {
    gameBoard = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;

    if (gameMode === 'online') {
        isMyTurn = isHost;
        if (!isHost) currentPlayer = 'O';
    }

    initializeBoard();
    updateTurnIndicator();

    const modal = document.getElementById('gameResultModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function resetScore() {
    player1.score = 0;
    player2.score = 0;
    updatePlayerInfo();
    showToast('Scores reset! 🔄', 'info');
}

function playAgain() {
    resetGame();
}

function goBack() {
    cleanup();
    
    if (socket) {
        socket.disconnect();
    }

    localStorage.removeItem('xo_game_mode');
    localStorage.removeItem('xo_room_id');
    localStorage.removeItem('xo_is_host');
    localStorage.removeItem('xo_current_player');
    localStorage.removeItem('xo_opponent');

    window.location.href = 'index.html';
}

// Chat functions
function toggleChat() {
    const chatContainer = document.getElementById('chatContainer');
    const chatFab = document.getElementById('chatFab');

    if (!chatContainer || !chatFab) return;

    if (isChatOpen) {
        chatContainer.classList.remove('active');
        chatFab.style.display = 'flex';
        isChatOpen = false;
    } else {
        chatContainer.classList.add('active');
        chatFab.style.display = 'none';
        isChatOpen = true;
        unreadMessages = 0;
        updateChatNotification();
    }
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    const message = input.value.trim();

    if (message && gameMode === 'online' && socket && socket.connected) {
        socket.emit('chat_message', {
            roomId: roomId,
            message: message,
            sender: onlinePlayerData.name || 'Player'
        });
        
        addChatMessage(message, onlinePlayerData.name || 'You', true);
        input.value = '';
    }
}

function addChatMessage(message, sender, isOwn) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    messageElement.innerHTML = `
        <span class="sender">${sender}</span>
        ${message}
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!isChatOpen && !isOwn) {
        unreadMessages++;
        updateChatNotification();
    }
}

function updateChatNotification() {
    const notification = document.getElementById('chatNotification');
    if (!notification) return;
    
    if (unreadMessages > 0) {
        notification.textContent = unreadMessages;
        notification.style.display = 'flex';
    } else {
        notification.style.display = 'none';
    }
}

// Utility functions
function copyRoomCode() {
    if (roomId) {
        navigator.clipboard.writeText(roomId).then(() => {
            showToast('Room code copied! 📋', 'success');
        }).catch(() => {
            showToast('Failed to copy room code', 'error');
        });
    }
}

function showTurnNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('XO Game', {
            body: "It's your turn! 🎯",
            icon: '/favicon.ico'
        });
    }
}

function sendNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('XO Game', {
            body: message,
            icon: '/favicon.ico'
        });
    }
}

function playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'move') {
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        } else if (type === 'win') {
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        }

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + (type === 'win' ? 0.5 : 0.1));
    } catch (error) {
        console.log('Audio not supported');
    }
}

function showToast(message, type = 'info') {
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

function applyTheme() {
    const savedTheme = localStorage.getItem('xo_theme') || 'default';
    document.body.className = `theme-${savedTheme}`;
}

console.log('✅ Game.js loaded successfully');
