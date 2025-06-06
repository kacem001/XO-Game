// Theme management
let currentTheme = 'default';
const themes = ['default', 'dark', 'ocean', 'sunset', 'forest', 'neon'];

// Initialize theme system
document.addEventListener('DOMContentLoaded', function () {
    loadSavedTheme();
    setupThemeListeners();
});

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('xo_theme');
    if (savedTheme && themes.includes(savedTheme)) {
        currentTheme = savedTheme;
    }
    applyTheme();
}

function setupThemeListeners() {
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function () {
            const theme = this.getAttribute('data-theme');
            if (themes.includes(theme)) {
                setTheme(theme);
            }
        });
    });

    // Close theme menu when clicking outside
    document.addEventListener('click', function (event) {
        const themeSelector = document.querySelector('.theme-selector');
        const themeMenu = document.querySelector('.theme-menu');

        if (themeSelector && !themeSelector.contains(event.target)) {
            themeMenu?.classList.remove('active');
        }
    });
}

function toggleThemeMenu() {
    const themeMenu = document.getElementById('themeMenu');
    if (themeMenu) {
        themeMenu.classList.toggle('active');
    }
}

function setTheme(theme) {
    if (themes.includes(theme)) {
        currentTheme = theme;
        applyTheme();
        saveTheme();

        // Close theme menu
        const themeMenu = document.getElementById('themeMenu');
        if (themeMenu) {
            themeMenu.classList.remove('active');
        }

        // Show toast notification
        if (typeof showToast === 'function') {
            showToast(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme applied!`, 'success');
        }
    }
}

function applyTheme() {
    // Remove all theme classes
    themes.forEach(theme => {
        document.body.classList.remove(`theme-${theme}`);
    });

    // Apply current theme
    document.body.classList.add(`theme-${currentTheme}`);

    // Update theme option indicators
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-theme') === currentTheme) {
            option.classList.add('active');
        }
    });

    // Apply special theme effects
    applyThemeEffects();
}

function applyThemeEffects() {
    switch (currentTheme) {
        case 'neon':
            addNeonEffects();
            break;
        case 'dark':
            addDarkEffects();
            break;
        default:
            removeSpecialEffects();
    }
}

function addNeonEffects() {
    // Add glowing animation to buttons and interactive elements
    const style = document.getElementById('neon-effects') || document.createElement('style');
    style.id = 'neon-effects';
    style.textContent = `
        .theme-neon .mode-card:hover,
        .theme-neon .start-btn:hover,
        .theme-neon .online-btn:hover,
        .theme-neon .control-btn:hover {
            box-shadow: 0 0 20px rgba(255, 0, 128, 0.5), 0 0 40px rgba(255, 0, 128, 0.3);
            animation: neonPulse 2s infinite alternate;
        }
        
        @keyframes neonPulse {
            from { box-shadow: 0 0 20px rgba(255, 0, 128, 0.5), 0 0 40px rgba(255, 0, 128, 0.3); }
            to { box-shadow: 0 0 30px rgba(255, 0, 128, 0.8), 0 0 60px rgba(255, 0, 128, 0.5); }
        }
        
        .theme-neon .game-title {
            animation: neonTextGlow 3s infinite alternate;
        }
        
        @keyframes neonTextGlow {
            from { text-shadow: 0 0 10px rgba(255, 0, 128, 0.5); }
            to { text-shadow: 0 0 20px rgba(255, 0, 128, 0.8), 0 0 30px rgba(0, 255, 128, 0.5); }
        }
    `;

    if (!document.getElementById('neon-effects')) {
        document.head.appendChild(style);
    }
}

function addDarkEffects() {
    // Add subtle animations for dark theme
    const style = document.getElementById('dark-effects') || document.createElement('style');
    style.id = 'dark-effects';
    style.textContent = `
        .theme-dark .mode-card:hover {
            transform: translateY(-10px) scale(1.02);
        }
        
        .theme-dark .cell:hover {
            box-shadow: 0 0 15px rgba(187, 134, 252, 0.3);
        }
        
        .theme-dark .game-board {
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
    `;

    if (!document.getElementById('dark-effects')) {
        document.head.appendChild(style);
    }
}

function removeSpecialEffects() {
    const neonEffects = document.getElementById('neon-effects');
    const darkEffects = document.getElementById('dark-effects');

    if (neonEffects) neonEffects.remove();
    if (darkEffects) darkEffects.remove();
}

function saveTheme() {
    localStorage.setItem('xo_theme', currentTheme);
}

function getTheme() {
    return currentTheme;
}

function getAvailableThemes() {
    return themes;
}

// Theme-specific color utilities
function getThemeColors() {
    const themeColors = {
        default: {
            primary: '#667eea',
            secondary: '#764ba2',
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12'
        },
        dark: {
            primary: '#bb86fc',
            secondary: '#03dac6',
            success: '#4caf50',
            error: '#f44336',
            warning: '#ff9800'
        },
        ocean: {
            primary: '#0077be',
            secondary: '#20b2aa',
            success: '#00c851',
            error: '#ff4444',
            warning: '#ffbb33'
        },
        sunset: {
            primary: '#ff6b6b',
            secondary: '#feca57',
            success: '#ff9ff3',
            error: '#ff3838',
            warning: '#ff9f43'
        },
        forest: {
            primary: '#27ae60',
            secondary: '#2ecc71',
            success: '#2ecc71',
            error: '#e74c3c',
            warning: '#f39c12'
        },
        neon: {
            primary: '#ff0080',
            secondary: '#00ff80',
            success: '#00ff80',
            error: '#ff0040',
            warning: '#ffff00'
        }
    };

    return themeColors[currentTheme] || themeColors.default;
}

// Export theme functions
window.themeAPI = {
    setTheme,
    getTheme,
    getAvailableThemes,
    getThemeColors,
    toggleThemeMenu
};