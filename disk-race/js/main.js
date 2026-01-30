import { Game } from './game.js';

// DOM elements
const canvas = document.getElementById('game-canvas');
const launchBtn = document.getElementById('launch-btn');
const resetBtn = document.getElementById('reset-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const lapCounter = document.getElementById('lap-counter');
const playerIndicator = document.getElementById('player-indicator');
const turnsCounter = document.getElementById('turns-counter');
const powerMeter = document.getElementById('power-meter');
const powerMeterFill = document.getElementById('power-meter-fill');
const victoryScreen = document.getElementById('victory-screen');

// Game instance
let game = null;

// Initialize game
async function init() {
    game = new Game(canvas);
    const success = await game.init();

    if (success) {
        game.start();
        setupEventListeners();
        startUIUpdateLoop();
    } else {
        console.error('Virhe: Radan lataus epäonnistui');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Launch button - mouse events
    launchBtn.addEventListener('mousedown', handleLaunchStart);
    launchBtn.addEventListener('mouseup', handleLaunchEnd);
    launchBtn.addEventListener('mouseleave', handleLaunchEnd);

    // Launch button - touch events for mobile
    launchBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleLaunchStart();
    });
    launchBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleLaunchEnd();
    });

    // Keyboard controls - spacebar for launch
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
            e.preventDefault();
            handleLaunchStart();
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            handleLaunchEnd();
        }
    });

    // Reset button
    resetBtn.addEventListener('click', handleReset);

    // Play again button
    playAgainBtn.addEventListener('click', () => {
        victoryScreen.classList.add('hidden');
        handleReset();
    });
}

// Handle launch start
function handleLaunchStart() {
    if (game.startCharging()) {
        powerMeter.classList.remove('hidden');
    }
}

// Handle launch end
function handleLaunchEnd() {
    if (game.stopCharging()) {
        powerMeter.classList.add('hidden');
    }
}

// Handle reset
function handleReset() {
    game.reset();
}

// UI update loop
// UI update loop with state tracking to avoid unnecessary DOM updates
function startUIUpdateLoop() {
    let lastState = {
        lap: -1,
        player: -1,
        turns: -1,
        power: -1,
        isMoving: false,
        isWon: false
    };

    function updateUI() {
        const currentLap = game.getCurrentLap();
        const maxLaps = game.getMaxLaps();
        const currentPlayerIdx = game.getCurrentPlayer();
        const currentTurns = game.getTurns();
        const currentPower = game.getChargePower();
        const isMoving = game.isDiskMoving();
        const isWon = game.isGameWon();

        // Update lap counter
        if (lastState.lap !== currentLap) {
            lapCounter.textContent = `Kierros ${currentLap} / ${maxLaps}`;
            lastState.lap = currentLap;
        }

        // Update player indicator and colors
        if (lastState.player !== currentPlayerIdx) {
            playerIndicator.textContent = `Pelaaja ${currentPlayerIdx + 1}`;

            // Get colors from disk defaults if possible, or fallback to config
            const playerColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];
            const playerBorders = ['#1e40af', '#991b1b', '#065f46', '#b45309'];

            playerIndicator.style.background = playerColors[currentPlayerIdx] || '#333';
            playerIndicator.style.borderColor = playerBorders[currentPlayerIdx] || '#000';
            lastState.player = currentPlayerIdx;
        }

        // Update turns counter
        if (lastState.turns !== currentTurns) {
            turnsCounter.textContent = `Vuoroja: ${currentTurns}`;
            lastState.turns = currentTurns;
        }

        // Update power meter
        if (lastState.power !== currentPower) {
            powerMeterFill.style.width = `${currentPower * 100}%`;
            lastState.power = currentPower;
        }

        // Update button state
        const shouldDisable = isMoving || isWon;
        if (lastState.isMoving !== isMoving || lastState.isWon !== isWon) {
            if (shouldDisable) {
                launchBtn.classList.add('disabled');
            } else {
                launchBtn.classList.remove('disabled');
            }

            if (isWon) {
                victoryScreen.classList.remove('hidden');
            } else {
                victoryScreen.classList.add('hidden');
            }

            lastState.isMoving = isMoving;
            lastState.isWon = isWon;
        }

        requestAnimationFrame(updateUI);
    }

    updateUI();
}

// Start the game when page loads
init();
