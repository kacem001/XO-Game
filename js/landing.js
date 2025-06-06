// Global variables
let gameMode = null;
let player1Data = { name: 'Player 1', avatar: null };
let player2Data = { name: 'Player 2', avatar: null };
let onlinePlayerData = { name: 'Player', avatar: null };

// Initialize landing page
document.addEventListener('DOMContentLoaded', function () {
    console.log('Landing page loaded');
    initializeImageHandlers();
    loadSavedData();
    applyTheme();
    setupEventListeners();
});

function setupEventListeners() {
    // Make sure the functions are available globally
    window.selectMode = selectMode;
    window.startGame = startGame;
    window.createRoom = createRoom;
    window.joinRoom = joinRoom;
    window.toggleThemeMenu = toggleThemeMenu;

    console.log('Event listeners setup complete');
}

function selectMode(mode) {
    console.log('Mode selected:', mode);
    gameMode = mode;

    // Hide all setup sections
    const playerSetup = document.getElementById('playerSetup');
    const onlineSetup = document.getElementById('onlineSetup');

    if (playerSetup) playerSetup.style.display = 'none';
    if (onlineSetup) onlineSetup.style.display = 'none';

    // Show appropriate setup
    if (mode === 'local') {
        if (playerSetup) {
            playerSetup.style.display = 'block';
            playerSetup.scrollIntoView({ behavior: 'smooth' });
        }
    } else if (mode === 'online') {
        if (onlineSetup) {
            onlineSetup.style.display = 'block';
            onlineSetup.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Add visual feedback
    document.querySelectorAll('.mode-card').forEach(card => {
        card.classList.remove('selected');
    });

    // Find the clicked card and add selected class
    const clickedCard = document.querySelector(`[onclick="selectMode('${mode}')"]`);
    if (clickedCard) {
        clickedCard.classList.add('selected');
    }
}

function startGame() {
    console.log('Starting local game');

    if (gameMode !== 'local') {
        showToast('Please select local play mode first', 'error');
        return;
    }

    // Get player names
    const p1NameInput = document.getElementById('player1Name');
    const p2NameInput = document.getElementById('player2Name');

    const p1Name = p1NameInput ? p1NameInput.value.trim() : '';
    const p2Name = p2NameInput ? p2NameInput.value.trim() : '';

    player1Data.name = p1Name || 'Player 1';
    player2Data.name = p2Name || 'Player 2';

    // Save data
    savePlayerData();
    localStorage.setItem('xo_game_mode', 'local');

    console.log('Navigating to game page');
    // Navigate to game page
    window.location.href = 'game.html';
}

function createRoom() {
    console.log('Creating room');

    const playerNameInput = document.getElementById('onlinePlayerName');
    const playerName = playerNameInput ? playerNameInput.value.trim() : '';

    if (!playerName) {
        showToast('Please enter your name', 'error');
        return;
    }

    onlinePlayerData.name = playerName;
    savePlayerData();

    // Show loading state
    showToast('Creating room...', 'info');

    // For now, simulate room creation (you can enhance this with actual socket connection)
    setTimeout(() => {
        const roomId = generateRoomId();
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', roomId);
        localStorage.setItem('xo_is_host', 'true');
        localStorage.setItem('xo_current_player', JSON.stringify(onlinePlayerData));

        showToast(`Room ${roomId} created!`, 'success');

        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1000);
    }, 1000);
}

function joinRoom() {
    console.log('Joining room');

    const playerNameInput = document.getElementById('onlinePlayerName');
    const roomCodeInput = document.getElementById('roomCode');

    const playerName = playerNameInput ? playerNameInput.value.trim() : '';
    const roomCode = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';

    if (!playerName) {
        showToast('Please enter your name', 'error');
        return;
    }

    if (!roomCode || roomCode.length !== 6) {
        showToast('Please enter a valid 6-character room code', 'error');
        return;
    }

    onlinePlayerData.name = playerName;
    savePlayerData();

    // Show loading state
    showToast('Joining room...', 'info');

    // For now, simulate joining (you can enhance this with actual socket connection)
    setTimeout(() => {
        localStorage.setItem('xo_game_mode', 'online');
        localStorage.setItem('xo_room_id', roomCode);
        localStorage.setItem('xo_is_host', 'false');
        localStorage.setItem('xo_current_player', JSON.stringify(onlinePlayerData));

        showToast(`Joined room ${roomCode}!`, 'success');

        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1000);
    }, 1000);
}

function initializeImageHandlers() {
    // Player 1 image handler
    const player1ImageInput = document.getElementById('player1Image');
    if (player1ImageInput) {
        player1ImageInput.addEventListener('change', function (e) {
            handleImageUpload(e, 'player1Avatar', (dataUrl) => {
                player1Data.avatar = dataUrl;
                savePlayerData();
            });
        });
    }

    // Player 2 image handler
    const player2ImageInput = document.getElementById('player2Image');
    if (player2ImageInput) {
        player2ImageInput.addEventListener('change', function (e) {
            handleImageUpload(e, 'player2Avatar', (dataUrl) => {
                player2Data.avatar = dataUrl;
                savePlayerData();
            });
        });
    }

    // Online player image handler
    const onlinePlayerImageInput = document.getElementById('onlinePlayerImage');
    if (onlinePlayerImageInput) {
        onlinePlayerImageInput.addEventListener('change', function (e) {
            handleImageUpload(e, 'onlinePlayerAvatar', (dataUrl) => {
                onlinePlayerData.avatar = dataUrl;
                savePlayerData();
            });
        });
    }

    // Name input handlers
    const player1NameInput = document.getElementById('player1Name');
    if (player1NameInput) {
        player1NameInput.addEventListener('input', function (e) {
            player1Data.name = e.target.value || 'Player 1';
            savePlayerData();
        });
    }

    const player2NameInput = document.getElementById('player2Name');
    if (player2NameInput) {
        player2NameInput.addEventListener('input', function (e) {
            player2Data.name = e.target.value || 'Player 2';
            savePlayerData();
        });
    }

    const onlinePlayerNameInput = document.getElementById('onlinePlayerName');
    if (onlinePlayerNameInput) {
        onlinePlayerNameInput.addEventListener('input', function (e) {
            onlinePlayerData.name = e.target.value || 'Player';
            savePlayerData();
        });
    }
}

function handleImageUpload(event, avatarElementId, callback) {
    const file = event.target.files[0];
    if (file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image file size should be less than 5MB', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target.result;
            const avatarElement = document.getElementById(avatarElementId);

            if (avatarElement) {
                // Create img element or update existing one
                let imgElement = avatarElement.querySelector('img');
                if (!imgElement) {
                    imgElement = document.createElement('img');
                    avatarElement.appendChild(imgElement);
                }

                imgElement.src = dataUrl;
                imgElement.style.display = 'block';
                imgElement.style.width = '100%';
                imgElement.style.height = '100%';
                imgElement.style.objectFit = 'cover';
                imgElement.style.borderRadius = '50%';

                // Hide the icon
                const iconElement = avatarElement.querySelector('i');
                if (iconElement) iconElement.style.display = 'none';

                callback(dataUrl);
            }
        };
        reader.readAsDataURL(file);
    }
}

function savePlayerData() {
    try {
        localStorage.setItem('xo_player1_data', JSON.stringify(player1Data));
        localStorage.setItem('xo_player2_data', JSON.stringify(player2Data));
        localStorage.setItem('xo_online_player_data', JSON.stringify(onlinePlayerData));
    } catch (error) {
        console.error('Error saving player data:', error);
    }
}

function loadSavedData() {
    try {
        // Load player 1 data
        const savedPlayer1 = localStorage.getItem('xo_player1_data');
        if (savedPlayer1) {
            player1Data = JSON.parse(savedPlayer1);
            const player1NameInput = document.getElementById('player1Name');
            if (player1NameInput && player1Data.name !== 'Player 1') {
                player1NameInput.value = player1Data.name;
            }
            if (player1Data.avatar) {
                setAvatarImage('player1Avatar', player1Data.avatar);
            }
        }

        // Load player 2 data
        const savedPlayer2 = localStorage.getItem('xo_player2_data');
        if (savedPlayer2) {
            player2Data = JSON.parse(savedPlayer2);
            const player2NameInput = document.getElementById('player2Name');
            if (player2NameInput && player2Data.name !== 'Player 2') {
                player2NameInput.value = player2Data.name;
            }
            if (player2Data.avatar) {
                setAvatarImage('player2Avatar', player2Data.avatar);
            }
        }

        // Load online player data
        const savedOnlinePlayer = localStorage.getItem('xo_online_player_data');
        if (savedOnlinePlayer) {
            onlinePlayerData = JSON.parse(savedOnlinePlayer);
            const onlinePlayerNameInput = document.getElementById('onlinePlayerName');
            if (onlinePlayerNameInput && onlinePlayerData.name !== 'Player') {
                onlinePlayerNameInput.value = onlinePlayerData.name;
            }
            if (onlinePlayerData.avatar) {
                setAvatarImage('onlinePlayerAvatar', onlinePlayerData.avatar);
            }
        }
    } catch (error) {
        console.error('Error loading saved data:', error);
    }
}

function setAvatarImage(avatarElementId, dataUrl) {
    const avatarElement = document.getElementById(avatarElementId);
    if (avatarElement) {
        let imgElement = avatarElement.querySelector('img');

        if (!imgElement) {
            imgElement = document.createElement('img');
            avatarElement.appendChild(imgElement);
        }

        imgElement.src = dataUrl;
        imgElement.style.display = 'block';
        imgElement.style.width = '100%';
        imgElement.style.height = '100%';
        imgElement.style.objectFit = 'cover';
        imgElement.style.borderRadius = '50%';

        const iconElement = avatarElement.querySelector('i');
        if (iconElement) iconElement.style.display = 'none';
    }
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showToast(message, type = 'info') {
    console.log('Toast:', message, type);

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

function toggleThemeMenu() {
    const themeMenu = document.getElementById('themeMenu');
    if (themeMenu) {
        themeMenu.classList.toggle('active');
    }
}

function applyTheme() {
    const savedTheme = localStorage.getItem('xo_theme') || 'default';
    document.body.className = `theme-${savedTheme}`;
}

// Room code input formatting
document.addEventListener('DOMContentLoaded', function () {
    const roomCodeInput = document.getElementById('roomCode');
    if (roomCodeInput) {
        roomCodeInput.addEventListener('input', function (e) {
            let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (value.length > 6) value = value.substring(0, 6);
            e.target.value = value;
        });

        roomCodeInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                joinRoom();
            }
        });
    }
});

// Add styles for selected mode card
const style = document.createElement('style');
style.textContent = `
    .mode-card.selected {
        border-color: var(--primary-color) !important;
        background: var(--primary-light) !important;
        transform: translateY(-5px) scale(1.02) !important;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2) !important;
    }
`;
document.head.appendChild(style);

console.log('Landing.js loaded successfully');