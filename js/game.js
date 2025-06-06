// Game state variables
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let gameMode = 'local'; // 'local' or 'online'
let player1 = { name: 'Player 1', avatar: null, score: 0 };
let player2 = { name: 'Player 2', avatar: null, score: 0 };
let isMyTurn = true;
let roomId = null;
let isHost = false;
let unreadMessages = 0;
let isChatOpen = false;
let socket = null; // إضافة متغير Socket

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

    console.log('Game mode:', gameMode, 'Room ID:', roomId, 'Is Host:', isHost);

    // Load player data
    const savedPlayer1 = localStorage.getItem('xo_player1_data');
    const savedPlayer2 = localStorage.getItem('xo_player2_data');
    const currentPlayerData = localStorage.getItem('xo_current_player');
    const opponentData = localStorage.getItem('xo_opponent');

    if (gameMode === 'local') {
        // Local game setup
        if (savedPlayer1) player1 = { ...player1, ...JSON.parse(savedPlayer1) };
        if (savedPlayer2) player2 = { ...player2, ...JSON.parse(savedPlayer2) };

        document.getElementById('gameModeIndicator').textContent = 'Local Game';
        document.getElementById('chatContainer').style.display = 'none';
        document.getElementById('chatFab').style.display = 'none';
    } else {
        // Online game setup
        if (currentPlayerData) {
            const currentPlayer = JSON.parse(currentPlayerData);
            if (isHost) {
                player1 = { ...player1, ...currentPlayer };
                if (opponentData) {
                    player2 = { ...player2, ...JSON.parse(opponentData) };
                }
            } else {
                player2 = { ...player2, ...currentPlayer };
                if (opponentData) {
                    player1 = { ...player1, ...JSON.parse(opponentData) };
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
    if (!window.io) {
        // تحميل Socket.io إذا لم يكن محملاً
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
        script.onload = () => {
            setupSocketConnection();
        };
        document.head.appendChild(script);
    } else {
        setupSocketConnection();
    }
}

function setupSocketConnection() {
    const serverUrl = window.location.hostname === 'localhost' ? 
        'http://localhost:3000' : 
        'https://xo-game-server-rtty.onrender.com';
    
    console.log('Connecting to server:', serverUrl);
    
    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    socket.on('connect', () => {
        console.log('Connected to game server');
        showToast('Connected to server', 'success');
        
        if (roomId) {
            // الانضمام للغرفة مرة أخرى
            const currentPlayerData = JSON.parse(localStorage.getItem('xo_current_player') || '{}');
            socket.emit('rejoin_room', {
                roomId: roomId,
                player: currentPlayerData
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showToast('Connection lost', 'error');
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        showToast('Failed to connect to server', 'error');
    });
    
    // Room events
    socket.on('player_joined', (data) => {
        console.log('Player joined:', data);
        updateOpponentInfo(data.player);
        hideWaitingOverlay();
        showToast(`${data.player.name} joined the game!`, 'success');
        localStorage.setItem('xo_opponent', JSON.stringify(data.player));
    });
    
    socket.on('player_left', (data) => {
        console.log('Player left:', data);
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
        console.log('Received move:', data);
        handleOnlineGameMove(data);
    });
    
    socket.on('game_restart', (data) => {
        console.log('Game restarted by opponent');
        handleOnlineRestart();
    });
    
    socket.on('game_state', (data) => {
        console.log('Received game state:', data);
        // تحديث حالة اللعبة من الخادم
        if (data.gameState) {
            gameBoard = data.gameState.board;
            gameActive = data.gameState.active;
            currentPlayer = data.gameState.currentPlayer;
            
            // تحديث الواجهة
            initializeBoard();
            updateTurnIndicator();
        }
    });
    
    // Chat events
    socket.on('chat_message', (data) => {
        console.log('Received chat message:', data);
        const senderName = isHost ? player2.name : player1.name;
        addChatMessage(data.message, senderName, false);
    });
    
    socket.on('turn_notification', (data) => {
        if (data.isYourTurn) {
            isMyTurn = true;
            updateBoardState();
            showTurnNotification();
            showToast("It's your turn!", 'info');
        }
    });
}

function setupEventListeners() {
    // Board click events
    document.querySelectorAll('.cell').forEach((cell, index) => {
        cell.addEventListener('click', () => handleCellClick(index));
    });

    // Chat functionality
    document.getElementById('chatInput').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Enable notifications
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function initializeBoard() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, index) => {
        cell.textContent = gameBoard[index];
        cell.classList.remove('winning', 'disabled', 'x-symbol', 'o-symbol');
        
        // Add symbol class
        if (gameBoard[index] === 'X') {
            cell.classList.add('x-symbol');
        } else if (gameBoard[index] === 'O') {
            cell.classList.add('o-symbol');
        }

        if (gameMode === 'online' && !isMyTurn) {
            cell.classList.add('disabled');
        }
    });
}

function updatePlayerInfo() {
    // Update player 1 info
    document.getElementById('player1Name').textContent = player1.name;
    document.getElementById('player1Score').textContent = player1.score;
    if (player1.avatar) {
        setPlayerAvatar('player1Avatar', 'player1Icon', player1.avatar);
    }

    // Update player 2 info
    document.getElementById('player2Name').textContent = player2.name;
    document.getElementById('player2Score').textContent = player2.score;
    if (player2.avatar) {
        setPlayerAvatar('player2Avatar', 'player2Icon', player2.avatar);
    }
}

function setPlayerAvatar(avatarId, iconId, avatarData) {
    const avatarElement = document.getElementById(avatarId);
    const iconElement = document.getElementById(iconId);

    if (avatarData) {
        avatarElement.src = avatarData;
        avatarElement.style.display = 'block';
        iconElement.style.display = 'none';
    } else {
        avatarElement.style.display = 'none';
        iconElement.style.display = 'block';
    }
}

function handleCellClick(index) {
    // Check if cell is already filled or game is not active
    if (gameBoard[index] !== '' || !gameActive) return;

    // Check if it's online game and not player's turn
    if (gameMode === 'online' && !isMyTurn) {
        showToast("It's not your turn!", 'warning');
        return;
    }

    // Make the move
    makeMove(index);

    // Send move to server if online game
    if (gameMode === 'online' && socket && socket.connected) {
        const currentPlayerData = JSON.parse(localStorage.getItem('xo_current_player') || '{}');
        socket.emit('game_move', {
            roomId: roomId,
            index: index,
            player: currentPlayerData
        });
        
        isMyTurn = false;
        updateBoardState();
        showToast("Waiting for opponent...", 'info');
    }
}

function makeMove(index) {
    gameBoard[index] = currentPlayer;
    const cell = document.querySelector(`[data-index="${index}"]`);
    cell.textContent = currentPlayer;
    cell.classList.add(currentPlayer === 'X' ? 'x-symbol' : 'o-symbol');

    // Play sound effect
    playSound('move');

    // Check for win or draw (only in local mode)
    if (gameMode === 'local') {
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
    const { index, symbol, gameState, gameEnd, winner, winningCells } = data;
    
    // تحديث اللوحة
    gameBoard = gameState.board;
    gameActive = gameState.active;
    currentPlayer = gameState.currentPlayer;
    
    // تحديث الواجهة
    initializeBoard();
    
    // تحديث النتائج
    if (gameState.scores) {
        const scoresArray = Object.values(gameState.scores);
        if (isHost) {
            player1.score = scoresArray[0] || 0;
            player2.score = scoresArray[1] || 0;
        } else {
            player1.score = scoresArray[1] || 0;
            player2.score = scoresArray[0] || 0;
        }
        updatePlayerInfo();
    }
    
    // Play sound effect
    playSound('move');
    
    // التحقق من انتهاء اللعبة
    if (gameEnd) {
        gameActive = false;
        
        if (gameEnd === 'win') {
            // تحديد الفائز
            const isMyWin = (isHost && symbol === 'X') || (!isHost && symbol === 'O');
            const message = isMyWin ? 'You win!' : 'You lose!';
            
            if (winningCells) {
                highlightWinningCells(winningCells);
            }
            
            showGameResult('win', message);
            playSound('win');
            
        } else if (gameEnd === 'draw') {
            showGameResult('draw', "It's a draw!");
        }
        
    } else {
        // تحديد الدور التالي
        isMyTurn = (isHost && currentPlayer === 'X') || (!isHost && currentPlayer === 'O');
        updateBoardState();
        
        if (isMyTurn) {
            showToast("Your turn!", 'info');
            showTurnNotification();
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
        document.querySelector(`[data-index="${index}"]`).classList.add('winning');
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
            message = `${winner.name} wins!`;
        } else {
            // سيتم التعامل مع هذا في handleOnlineGameMove
            return;
        }
        playSound('win');
    } else {
        message = "It's a draw!";
    }

    updatePlayerInfo();
    showGameResult(result, message);

    // Send notification if it's an online game
    if (gameMode === 'online') {
        sendNotification(message);
    }
}

function showGameResult(result, message) {
    const modal = document.getElementById('gameResultModal');
    const resultIcon = document.getElementById('resultIcon');
    const resultTitle = document.getElementById('resultTitle');
    const resultMessage = document.getElementById('resultMessage');

    // Set icon based on result
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

function updateTurnIndicator() {
    const turnIndicator = document.getElementById('turnIndicator');
    const player1Info = document.getElementById('player1Info');
    const player2Info = document.getElementById('player2Info');

    // Remove current player class
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
            turnIndicator.textContent = "Your Turn";
            if (isHost) {
                player1Info.classList.add('current-player');
            } else {
                player2Info.classList.add('current-player');
            }
        } else {
            turnIndicator.textContent = "Opponent's Turn";
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

// Online game functions - Legacy support
function handleOnlineMove(index, player) {
    // هذه الدالة للتوافق مع الكود القديم
    console.log('Legacy handleOnlineMove called');
}

function handleOnlineRestart() {
    resetGame();
    showToast('Game restarted by opponent', 'info');
}

function showWaitingOverlay() {
    const overlay = document.getElementById('waitingOverlay');
    const roomCode = document.getElementById('waitingRoomCode');

    if (roomCode && roomId) {
        roomCode.textContent = roomId;
    }

    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function hideWaitingOverlay() {
    const overlay = document.getElementById('waitingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function updateOpponentInfo(opponent) {
    if (isHost) {
        player2 = { ...player2, ...opponent };
    } else {
        player1 = { ...player1, ...opponent };
    }
    updatePlayerInfo();
}

function resetGameForDisconnection() {
    gameActive = false;
    showToast('Opponent disconnected. Waiting for reconnection...', 'warning');
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

    // Close modal if open
    document.getElementById('gameResultModal').classList.remove('active');
}

function resetScore() {
    player1.score = 0;
    player2.score = 0;
    updatePlayerInfo();
    showToast('Scores reset!', 'info');
}

function playAgain() {
    resetGame();
}

function goBack() {
    // Clean up online connection
    if (gameMode === 'online' && socket) {
        socket.emit('leave_room', {
            roomId: roomId,
            player: JSON.parse(localStorage.getItem('xo_current_player') || '{}')
        });
        socket.disconnect();
    }

    // Clear game data
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
    const message = input.value.trim();

    if (message && gameMode === 'online' && socket && socket.connected) {
        const currentPlayerData = JSON.parse(localStorage.getItem('xo_current_player') || '{}');
        
        socket.emit('chat_message', {
            roomId: roomId,
            message: message,
            sender: currentPlayerData.name || 'Player'
        });
        
        addChatMessage(message, currentPlayerData.name || 'You', true);
        input.value = '';
    }
}

function addChatMessage(message, sender, isOwn) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');

    messageElement.className = `chat-message ${isOwn ? 'own' : 'other'}`;
    messageElement.innerHTML = `
        <span class="sender">${sender}</span>
        ${message}
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Update notification if chat is closed
    if (!isChatOpen && !isOwn) {
        unreadMessages++;
        updateChatNotification();
    }
}

function updateChatNotification() {
    const notification = document.getElementById('chatNotification');
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
            showToast('Room code copied!', 'success');
        }).catch(() => {
            showToast('Failed to copy room code', 'error');
        });
    }
}

function showTurnNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('XO Game', {
            body: "It's your turn!",
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
    // Simple sound feedback using Web Audio API
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
        // Silently fail if audio context is not supported
    }
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
    
    // Style the toast
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
    
    // Show toast
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function applyTheme() {
    const savedTheme = localStorage.getItem('xo_theme') || 'default';
    document.body.className = `theme-${savedTheme}`;
}

console.log('Game.js loaded successfully');
