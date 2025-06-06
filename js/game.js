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
        if (window.socketAPI) {
            window.socketAPI.initializeOnlineFeatures();
        }

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
        cell.classList.remove('winning', 'disabled');

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
    if (gameMode === 'online' && window.socketAPI) {
        window.socketAPI.sendGameMove(index);
        isMyTurn = false;
        updateBoardState();
    }
}

function makeMove(index) {
    gameBoard[index] = currentPlayer;
    const cell = document.querySelector(`[data-index="${index}"]`);
    cell.textContent = currentPlayer;
    cell.classList.add(currentPlayer === 'X' ? 'x-symbol' : 'o-symbol');

    // Play sound effect
    playSound('move');

    // Check for win or draw
    if (checkWin()) {
        endGame('win');
    } else if (checkDraw()) {
        endGame('draw');
    } else {
        // Switch player only in local mode
        if (gameMode === 'local') {
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            updateTurnIndicator();
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
            // Online mode - determine winner based on current player
            if ((currentPlayer === 'X' && isHost) || (currentPlayer === 'O' && !isHost)) {
                winner = 'you';
                message = 'You win!';
                if (isHost) player1.score++;
                else player2.score++;
            } else {
                winner = 'opponent';
                message = 'You lose!';
                if (isHost) player2.score++;
                else player1.score++;
            }
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
            if (isMyTurn) {
                cell.classList.remove('disabled');
            } else {
                cell.classList.add('disabled');
            }
        }
    });
    updateTurnIndicator();
}

// Online game functions
function handleOnlineMove(index, player) {
    if (gameBoard[index] === '' && gameActive) {
        gameBoard[index] = player.symbol || (isHost ? 'O' : 'X');
        const cell = document.querySelector(`[data-index="${index}"]`);
        cell.textContent = gameBoard[index];
        cell.classList.add(gameBoard[index] === 'X' ? 'x-symbol' : 'o-symbol');

        currentPlayer = gameBoard[index];

        // Play sound effect
        playSound('move');

        // Check for win or draw
        if (checkWin()) {
            endGame('win');
        } else if (checkDraw()) {
            endGame('draw');
        } else {
            isMyTurn = true;
            updateBoardState();
        }
    }
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
    if (gameMode === 'online' && window.socketAPI) {
        window.socketAPI.sendGameRestart();
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
    if (gameMode === 'online' && window.socketAPI) {
        window.socketAPI.leaveRoom();
        window.socketAPI.cleanupSocket();
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

    if (message && gameMode === 'online' && window.socketAPI) {
        if (window.socketAPI.sendChatMessage(message)) {
            addChatMessage(message, player1.name || player2.name, true);
            input.value = '';
        } else {
            showToast('Failed to send message', 'error');
        }
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
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('active'), 100);

    // Hide toast after 3 seconds
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}