import { CONFIG } from './config.js';
import { Disk } from './entities/disk.js';
import { TrackLoader } from './track/trackLoader.js';
import { Renderer } from './rendering/renderer.js';
import { CollisionDetector } from './physics/collisionDetector.js';
import { Vector } from './utils/vector.js';
import { ParticleSystem } from './effects/particle.js';

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.track = null;
        this.disks = []; // Array of disks for multiplayer
        this.isRunning = false;
        this.lastTime = 0;
        this.particleSystem = new ParticleSystem();

        // Multiplayer state
        this.numPlayers = CONFIG.NUM_PLAYERS;
        this.currentPlayer = 0;
        this.playerLaps = new Array(this.numPlayers).fill(0);
        this.playerTurns = new Array(this.numPlayers).fill(0);
        this.playerCheckpoints = new Array(this.numPlayers).fill(0); // Cumulative count of pieces passed
        this.lastPieceIndex = new Array(this.numPlayers).fill(0);    // Last piece index the disk was in
        this.gameWon = false;
        this.winningPlayer = -1;
        this.turnSwitched = false; // Track if turn has been switched after launch

        // Save states for turn reset
        this.turnStartLaps = [];
        this.turnStartCheckpoints = [];
        this.turnStartLastPiece = [];
        this.playerVisitedPieces = new Array(this.numPlayers).fill(null).map(() => new Set());
        this.turnStartVisitedPieces = [];

        // Launch controls
        this.arrowAngle = 0;
        this.isCharging = false;
        this.chargePower = 0;
        this.launchLocked = false;
        this.lockedAngle = 0;
        this.lastLaunchPositions = [];
        this.turnStartPositions = []; // Positions of all disks at the start of current turn

        // Previous positions for collision detection
        this.prevDiskPositions = [];
    }

    async init() {
        try {
            // Load track
            this.track = await TrackLoader.loadTrack(CONFIG.TRACK_FILE);

            // Create disks for all players at start position (behind the start line)
            const startSetback = CONFIG.START_LINE_SETBACK;
            const startX = this.track.startLine.x - Math.cos(this.track.startLine.angle) * startSetback;
            const startY = this.track.startLine.y - Math.sin(this.track.startLine.angle) * startSetback;

            // Create disks with grid layout for multiplayer (max 2 per row)
            const disksPerRow = Math.min(2, this.numPlayers);
            const spacing = CONFIG.DISK_RADIUS * 2.5;

            for (let i = 0; i < this.numPlayers; i++) {
                // Calculate grid position
                const row = Math.floor(i / disksPerRow);
                const col = i % disksPerRow;

                // Offset perpendicular to track (side to side)
                const sideAngle = this.track.startLine.angle + Math.PI / 2;
                const sideOffset = (col - (disksPerRow - 1) / 2) * spacing;

                // Offset along track direction (forward/backward for rows)
                const forwardAngle = this.track.startLine.angle + Math.PI; // Backward
                const forwardOffset = row * spacing;

                const diskX = startX + Math.cos(sideAngle) * sideOffset + Math.cos(forwardAngle) * forwardOffset;
                const diskY = startY + Math.sin(sideAngle) * sideOffset + Math.sin(forwardAngle) * forwardOffset;

                const disk = new Disk(diskX, diskY, i);
                this.disks.push(disk);
                this.prevDiskPositions.push(disk.position.clone());
                this.lastLaunchPositions.push(disk.position.clone());
                this.turnStartPositions.push(disk.position.clone());
                this.turnStartLaps.push(0);
                this.turnStartCheckpoints.push(0);
                this.turnStartLastPiece.push(0);
                this.turnStartVisitedPieces.push(new Set());
                this.lastPieceIndex[i] = 0;
            }

            // Initial render
            this.render();

            return true;
        } catch (error) {
            console.error('Failed to initialize game:', error);
            return false;
        }
    }

    start() {
        if (this.isRunning) return; // Prevent multiple loops

        this.isRunning = true;
        this.lastTime = performance.now();
        this.turnSwitched = true; // Set to true so first player doesn't get skipped
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
    }

    reset() {
        this.currentPlayer = 0;
        this.playerLaps = new Array(this.numPlayers).fill(0);
        this.playerTurns = new Array(this.numPlayers).fill(0);
        this.playerCheckpoints = new Array(this.numPlayers).fill(0);
        this.lastPieceIndex = new Array(this.numPlayers).fill(0);
        this.gameWon = false;
        this.winningPlayer = -1;
        this.turnSwitched = true; // Set to true so first player doesn't get skipped

        this.turnStartLaps = new Array(this.numPlayers).fill(0);
        this.turnStartCheckpoints = new Array(this.numPlayers).fill(0);
        this.turnStartLastPiece = new Array(this.numPlayers).fill(0);

        // Reset all disks
        for (let i = 0; i < this.disks.length; i++) {
            this.disks[i].reset();
            this.prevDiskPositions[i] = this.disks[i].position.clone();
            this.lastLaunchPositions[i] = this.disks[i].position.clone();
            this.turnStartPositions[i] = this.disks[i].position.clone();
            this.playerVisitedPieces[i].clear();
        }

        this.arrowAngle = 0;
        this.isCharging = false;
        this.chargePower = 0;
        this.launchLocked = false;

        // Resume game if it was stopped (e.g. after win)
        if (!this.isRunning) {
            this.start();
        } else {
            this.render();
        }
    }

    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;

        const deltaTime = Math.min((currentTime - this.lastTime) / 16.67, 2); // Cap at 2x normal speed
        this.lastTime = currentTime;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        const currentDisk = this.disks[this.currentPlayer];

        // Update arrow rotation only when not charging, all disks are stopped, and not locked
        if (!this.isCharging && this.allDisksStopped() && !this.launchLocked) {
            this.arrowAngle += CONFIG.ARROW_ROTATION_SPEED;
        }

        // Update power charge
        if (this.isCharging) {
            this.chargePower += CONFIG.POWER_CHARGE_SPEED;
            if (this.chargePower > 1) {
                this.chargePower = 1;
            }
        }

        // Store previous positions and update all disks
        for (let i = 0; i < this.disks.length; i++) {
            this.prevDiskPositions[i] = this.disks[i].position.clone();
            this.disks[i].update(deltaTime);
        }

        // Update particles
        this.particleSystem.update(deltaTime);

        // Check collisions
        const diskOffTrack = this.checkCollisions();

        // If any disk went off track, reset all disks and switch turn when stopped
        if (diskOffTrack && this.allDisksStopped()) {
            this.resetAllDisksToTurnStart();
            this.switchPlayer();
        }
        // Otherwise, switch turn normally when all disks have stopped
        else if (!this.isCharging && this.allDisksStopped() && !this.turnSwitched) {
            this.switchPlayer();
        }
    }

    checkCollisions() {
        let anyDiskOffTrack = false;

        // Check collisions for all disks
        for (let i = 0; i < this.disks.length; i++) {
            const disk = this.disks[i];

            // Check if disk is off track
            if (!CollisionDetector.isOnTrack(disk, this.track)) {
                // Only create particles if disk just went off track (was visible)
                if (disk.visible) {
                    this.particleSystem.createBurst(disk.position.x, disk.position.y, disk.color, 12);
                }

                anyDiskOffTrack = true;
                // Stop the disk immediately and hide it
                disk.velocity = new Vector(0, 0);
                disk.isMoving = false;
                disk.visible = false;
                continue;
            }

            // Check wall collisions
            const wallNormal = CollisionDetector.checkWallCollision(disk, this.track);
            if (wallNormal) {
                disk.bounce(wallNormal);
            }

            // Check disk-to-disk collisions
            for (let j = i + 1; j < this.disks.length; j++) {
                disk.collideWithDisk(this.disks[j]);
            }

            // Track progress and laps using piece coverage
            const pieceIndex = CollisionDetector.getPieceIndex(disk, this.track);
            const total = this.track.pieces.length;

            if (pieceIndex !== -1) {
                const last = this.lastPieceIndex[i];

                if (pieceIndex !== last) {
                    this.playerVisitedPieces[i].add(pieceIndex);
                    const coverage = (this.playerVisitedPieces[i].size / total * 100).toFixed(0);
                    console.log(`Pelaaja ${i + 1}: Pala ${pieceIndex} (Käyty: ${this.playerVisitedPieces[i].size}/${total} - ${coverage}%)`);
                    this.lastPieceIndex[i] = pieceIndex;
                }
            }

            // Check for finish line crossing
            const startPiece = this.track.pieces.find(p => p.type === 'start');
            const startLine = startPiece ? {
                x: startPiece.x,
                y: startPiece.y,
                angle: startPiece.angle
            } : this.track.startLine;

            const crossing = CollisionDetector.checkStartLineCrossing(
                disk,
                this.prevDiskPositions[i],
                startLine
            );

            if (crossing === 1) { // Forward crossing
                // Require visiting most pieces (90% to be safe against small gaps)
                const visitedCount = this.playerVisitedPieces[i].size;
                const requiredCount = Math.ceil(total * 0.9);

                if (visitedCount >= requiredCount) {
                    this.playerLaps[i]++;
                    console.log(`--- PELAAJA ${i + 1} KIERROS VALMIS! (${visitedCount}/${total} palaa käyty) ---`);

                    // Reset visited pieces for the next lap, but keep the current piece
                    this.playerVisitedPieces[i].clear();
                    if (pieceIndex !== -1) this.playerVisitedPieces[i].add(pieceIndex);

                    if (this.playerLaps[i] >= CONFIG.LAPS_TO_WIN) {
                        console.log(`VOITTAJA: Pelaaja ${i + 1}`);
                        this.gameWon = true;
                        this.winningPlayer = i;
                        this.stop();
                    }
                } else {
                    console.log(`Pelaaja ${i + 1} ylitti maaliviivan, mutta vain ${visitedCount}/${total} palaa käyty. Kierrosta ei lasketa.`);
                }
            }
        }

        return anyDiskOffTrack;
    }

    render() {
        this.renderer.clear();

        // Draw track
        if (this.track) {
            this.renderer.drawTrack(this.track);
        }

        // Draw all visible disks
        for (let i = 0; i < this.disks.length; i++) {
            const disk = this.disks[i];

            // Skip invisible disks (off track)
            if (!disk.visible) continue;

            // Show arrow only on current player's disk when ALL disks are stopped
            const isCurrentPlayer = (i === this.currentPlayer);
            const showArrow = isCurrentPlayer && this.allDisksStopped();
            const angle = this.launchLocked ? this.lockedAngle : this.arrowAngle;
            this.renderer.drawDisk(disk, showArrow ? angle : null);
        }

        // Draw particles on top of everything
        this.renderer.renderParticles(this.particleSystem);
    }

    // Input handlers
    startCharging() {
        const currentDisk = this.disks[this.currentPlayer];
        if (currentDisk && this.allDisksStopped() && !this.gameWon) {
            this.launchLocked = true;
            this.lockedAngle = this.arrowAngle;
            this.isCharging = true;
            this.chargePower = 0;
            return true;
        }
        return false;
    }

    stopCharging() {
        if (this.isCharging) {
            // Save all disk positions and progress at the start of this turn
            for (let i = 0; i < this.disks.length; i++) {
                this.turnStartPositions[i] = this.disks[i].position.clone();
                this.turnStartLaps[i] = this.playerLaps[i];
                this.turnStartCheckpoints[i] = this.playerCheckpoints[i];
                this.turnStartLastPiece[i] = this.lastPieceIndex[i];
                this.turnStartVisitedPieces[i] = new Set(this.playerVisitedPieces[i]);
            }

            this.isCharging = false;
            this.launchDisk();
            this.launchLocked = false;
            this.turnSwitched = false; // Reset flag, turn will switch when disks stop
            return true;
        }
        return false;
    }

    launchDisk() {
        const currentDisk = this.disks[this.currentPlayer];
        if (currentDisk && this.chargePower > 0) {
            this.lastLaunchPositions[this.currentPlayer] = currentDisk.position.clone();
            currentDisk.launch(this.lockedAngle, this.chargePower);
            this.chargePower = 0;
            this.playerTurns[this.currentPlayer]++;
        }
    }

    allDisksStopped() {
        return this.disks.every(disk => disk.isStopped());
    }

    switchPlayer() {
        this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
        this.turnSwitched = true; // Mark that turn has been switched
    }

    resetAllDisksToTurnStart() {
        // Reset all disks to their positions and progress at the start of the current player's turn
        for (let i = 0; i < this.disks.length; i++) {
            this.disks[i].returnToPosition(this.turnStartPositions[i]);
            this.prevDiskPositions[i] = this.disks[i].position.clone();
            this.playerLaps[i] = this.turnStartLaps[i];
            this.playerCheckpoints[i] = this.turnStartCheckpoints[i];
            this.lastPieceIndex[i] = this.turnStartLastPiece[i];
            this.playerVisitedPieces[i] = new Set(this.turnStartVisitedPieces[i]);
        }
    }

    // Getters for UI
    getCurrentLap() {
        return this.playerLaps[this.currentPlayer];
    }

    getMaxLaps() {
        return CONFIG.LAPS_TO_WIN;
    }

    getCurrentSpeed() {
        const currentDisk = this.disks[this.currentPlayer];
        return currentDisk ? currentDisk.getSpeed().toFixed(1) : '0.0';
    }

    getChargePower() {
        return this.chargePower;
    }

    getTurns() {
        return this.playerTurns[this.currentPlayer];
    }

    getCurrentPlayer() {
        return this.currentPlayer;
    }

    getNumPlayers() {
        return this.numPlayers;
    }

    getWinningPlayer() {
        return this.winningPlayer;
    }

    isGameWon() {
        return this.gameWon;
    }

    isDiskMoving() {
        return !this.allDisksStopped();
    }
}
