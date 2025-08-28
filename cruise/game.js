class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.setupConstants();
        this.setupEventListeners();
        this.loadAssets();

        this.gameState = 'startScreen';
        this.animationFrameId = null;
        this.lastTime = 0;
        this.showStartText = false;

        this.ui = new UI(this);
        this.handleResize();
        this.gameLoop(0);
    }

    setupConstants() {
        this.BASE_WIDTH = 400;
        this.BASE_HEIGHT = 600;
        this.ASPECT_RATIO = this.BASE_WIDTH / this.BASE_HEIGHT;

        this.ROAD_WIDTH_RATIO = 0.6;
        this.ROAD_LANE_COUNT = 3;
        this.MIN_OBSTACLE_GAP_Y = 130;
        this.ROAD_LINE_WIDTH = 5;
        this.CAR_WIDTH = 44;
        this.CAR_HEIGHT = 74;
        this.PLAYER_Y_OFFSET = 120;

        this.ROAD_SPEED_ZERO = 0;
        this.ROAD_SPEED_FIFTY = 50 * 5;
        this.ROAD_SPEED_HUNDRED = 100 * 5;
        this.INITIAL_ROAD_SPEED = 10 * 5;
        this.MAX_ROAD_SPEED = 100 * 5;
        this.ROAD_SPEED_INCREASE_RATE = 35;
        this.MAX_PLAYER_SPEED = 240;
        this.PLAYER_ACCELERATION = 3000;
        this.OBSTACLE_MIN_SPEED = 45;
        this.PIXELS_PER_METER = 18;
        this.ODOMETER_CHECK_INTERVAL_METERS = 500;
        this.ROAD_STATE_CHANGE_INTERVAL = 3;
        this.START_TEXT_DELAY = 4000;
        this.CENTER_BIAS_PROBABILITY = 0.4;

        this.PLAYER_CAR_BODY = '#0099ff';
        this.PLAYER_CAR_ROOF = '#66ccff';
        this.OBSTACLE_COLORS = [
            { body: '#d4ac0d', roof: '#f5cba7' },
            { body: '#5cb85c', roof: '#98d198' },
            { body: '#ff4444', roof: '#ff8888' }
        ];
        this.TAIL_LIGHTS_COLOR = '#B71C1C';
    }

    setupEventListeners() {
        this.input = new InputHandler(this);
        window.addEventListener('resize', () => this.handleResize());
    }

    loadAssets() {
        this.coverImg = new Image();
        this.isCoverImageLoaded = false;
        this.coverImg.onload = () => {
            this.isCoverImageLoaded = true;
            setTimeout(() => {
                this.showStartText = true;
            }, this.START_TEXT_DELAY);
        };
        this.coverImg.src = 'cover.jpg';
    }

    handleResize() {
        if (this.isMobile()) {
            const windowAspectRatio = window.innerWidth / window.innerHeight;
            if (windowAspectRatio > this.ASPECT_RATIO) {
                this.canvas.height = window.innerHeight;
                this.canvas.width = this.canvas.height * this.ASPECT_RATIO;
            } else {
                this.canvas.width = window.innerWidth;
                this.canvas.height = this.canvas.width / this.ASPECT_RATIO;
            }
        } else {
            this.canvas.height = window.innerHeight * 0.8;
            this.canvas.width = this.canvas.height * this.ASPECT_RATIO;
        }

        this.scaleW = this.canvas.width / this.BASE_WIDTH;
        this.scaleH = this.canvas.height / this.BASE_HEIGHT;

        if (this.ui) {
            this.ui.setScale(this.scaleW, this.scaleH);
        }
    }

    isMobile() {
        return window.innerWidth <= 768;
    }

    startGame() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.input.reset();
        this.gameState = 'playing';

        this.ROAD_WIDTH = this.BASE_WIDTH * this.ROAD_WIDTH_RATIO;
        this.ROAD_X = (this.BASE_WIDTH - this.ROAD_WIDTH) / 2;
        this.LANE_WIDTH = this.ROAD_WIDTH / this.ROAD_LANE_COUNT;

        this.odometer = 0;
        this.roadSpeed = this.ROAD_SPEED_ZERO;
        this.targetRoadSpeed = this.ROAD_SPEED_FIFTY;
        this.points = 0;
        this.currentTraficSign = 'speed_50';

        this.player = new Player(this);
        this.road = new Road(this);

        this.obstacles = [];
        this.scenery = new Scenery(this);

        this.lastTime = 0;
        this.gameLoop(0);
    }

    gameOver() {
        this.gameState = 'gameOver';
    }

    gameLoop(currentTime) {
        if (this.gameState === 'gameOver') {
            this.draw();
            this.ui.drawGameOver();
            this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
            return;
        }

        if (this.gameState === 'startScreen') {
            this.ui.drawStartScreen();
        } else if (this.gameState === 'playing') {
            if (this.lastTime === 0) this.lastTime = currentTime;
            const dt = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;

            this.update(dt);
            this.draw();
        }

        this.animationFrameId = requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(dt) {
        this.player.update(dt, this.input.keys);
        
        this.scenery.update(dt, this.roadSpeed);
        this.road.update(dt, this.roadSpeed);

        this.spawnObstacles();
        this.updateObstacles(dt);

        this.updateOdometer(dt);
        this.updateRoadSpeed(dt);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.scenery.draw();
        this.road.draw();
        this.ui.drawTraficSigns();
        this.player.draw();
        this.obstacles.forEach(obs => obs.draw());
        this.ui.drawDigitalDashboard();
    }

    spawnObstacles() {
        const obstaclesMinY = Math.min(...this.obstacles.map(obs => obs.y), this.BASE_HEIGHT);
        const spawnProbability = obstaclesMinY > this.MIN_OBSTACLE_GAP_Y ? this.acceleratingProbability(obstaclesMinY - this.MIN_OBSTACLE_GAP_Y, this.BASE_HEIGHT, 2) : 0;

        if (Math.random() < spawnProbability) {
            this.obstacles.push(new Obstacle(this));
        }
    }

    updateObstacles(dt) {
        this.obstacles.forEach(obstacle => {
            obstacle.update(dt, this.roadSpeed);

            if (obstacle.y > this.BASE_HEIGHT - this.PLAYER_Y_OFFSET + this.CAR_HEIGHT && !obstacle.scored) {
                this.points++;
                obstacle.scored = true;
            }

            if (this.checkCollision(this.player, obstacle)) {
                this.gameOver();
            }
        });
        this.obstacles = this.obstacles.filter(obstacle => obstacle.y < this.BASE_HEIGHT);
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    updateOdometer(dt) {
        const nextOdometer = this.odometer + this.roadSpeed * dt;
        const roundedOdometerAsMeters = Math.floor(this.pixelsToMeters(this.odometer) / this.ODOMETER_CHECK_INTERVAL_METERS);
        const roundedNextOdometerAsMeters = Math.floor(this.pixelsToMeters(nextOdometer) / this.ODOMETER_CHECK_INTERVAL_METERS);

        if (roundedOdometerAsMeters !== roundedNextOdometerAsMeters) {
            const result = roundedNextOdometerAsMeters % this.ROAD_STATE_CHANGE_INTERVAL;
            if (result === 0) this.setRoadState('speed_50');
            if (result === 1) this.setRoadState('speed_100');
        }
        this.odometer = nextOdometer;
    }

    updateRoadSpeed(dt) {
        if (this.roadSpeed < this.targetRoadSpeed) {
            this.roadSpeed = Math.min(this.roadSpeed + this.ROAD_SPEED_INCREASE_RATE * dt, this.targetRoadSpeed);
        } else if (this.roadSpeed > this.targetRoadSpeed) {
            this.roadSpeed = Math.max(this.roadSpeed - this.ROAD_SPEED_INCREASE_RATE * dt, this.targetRoadSpeed);
        }
    }

    setRoadState(state) {
        if (state === 'speed_50') {
            this.targetRoadSpeed = this.ROAD_SPEED_FIFTY;
            this.currentTraficSign = 'speed_50';
        } else if (state === 'speed_100') {
            this.targetRoadSpeed = this.ROAD_SPEED_HUNDRED;
            this.currentTraficSign = 'speed_100';
        }
    }

    pixelsToMeters(pixels) {
        return pixels / this.PIXELS_PER_METER;
    }

    acceleratingProbability(min, max, alpha = 2) {
        const t = Math.min(min, max);
        return Math.pow(t / max, alpha);
    }

    centerBiasedRandom() {
        return Math.random() < this.CENTER_BIAS_PROBABILITY ? (Math.random() + Math.random()) / 2 : Math.random();
    }
}

class InputHandler {
    constructor(game) {
        this.game = game;
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            if ((this.game.gameState === 'startScreen' || this.game.gameState === 'gameOver') && e.key === 'Enter') {
                this.game.startGame();
            } else if (this.game.gameState === 'playing') {
                this.keys[e.key] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.game.gameState === 'playing') {
                this.keys[e.key] = false;
            }
        });

        window.addEventListener('touchstart', (e) => {
            if (this.game.gameState === 'startScreen' || this.game.gameState === 'gameOver') {
                this.game.startGame();
                return;
            }
            if (this.game.gameState === 'playing') {
                e.preventDefault();
                const touchX = e.touches[0].clientX;
                if (touchX < window.innerWidth / 2) {
                    this.keys['ArrowLeft'] = true;
                    this.keys['ArrowRight'] = false;
                } else {
                    this.keys['ArrowRight'] = true;
                    this.keys['ArrowLeft'] = false;
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', (e) => {
            if (this.game.gameState === 'playing') {
                e.preventDefault();
                this.keys['ArrowLeft'] = false;
                this.keys['ArrowRight'] = false;
            }
        });
    }

    reset() {
        this.keys = {};
    }
}

class Car {
    constructor(game) {
        this.game = game;
        this.width = game.CAR_WIDTH;
        this.height = game.CAR_HEIGHT;
    }

    draw(bodyColor, roofColor) {
        const sx = this.x * this.game.scaleW;
        const sy = this.y * this.game.scaleH;
        const sw = this.width * this.game.scaleW;
        const sh = this.height * this.game.scaleH;
        const ctx = this.game.ctx;

        ctx.fillStyle = bodyColor;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = roofColor;
        ctx.fillRect(sx + sw * 0.15, sy + sh * 0.30, sw * 0.7, sh * 0.45);
        ctx.fillStyle = this.game.TAIL_LIGHTS_COLOR;
        ctx.fillRect(sx + 4 * this.game.scaleW, sy + sh - 12 * this.game.scaleH, 8 * this.game.scaleW, 6 * this.game.scaleH);
        ctx.fillRect(sx + sw - 12 * this.game.scaleW, sy + sh - 12 * this.game.scaleH, 8 * this.game.scaleW, 6 * this.game.scaleH);
    }
}

class Player extends Car {
    constructor(game) {
        super(game);
        this.x = game.ROAD_X + game.LANE_WIDTH + (game.LANE_WIDTH / 2) - (this.width / 2);
        this.y = game.BASE_HEIGHT - game.PLAYER_Y_OFFSET;
        this.speed = 0;
    }

    update(dt, keys) {
        let targetSpeed = 0;
        if (keys['ArrowLeft'] || keys['a']) targetSpeed = -this.game.MAX_PLAYER_SPEED;
        else if (keys['ArrowRight'] || keys['d']) targetSpeed = this.game.MAX_PLAYER_SPEED;

        if (this.speed < targetSpeed) this.speed = Math.min(this.speed + this.game.PLAYER_ACCELERATION * dt, targetSpeed);
        else if (this.speed > targetSpeed) this.speed = Math.max(this.speed - this.game.PLAYER_ACCELERATION * dt, targetSpeed);
        
        this.x += this.speed * dt;
        this.x = Math.max(this.game.ROAD_X + this.game.ROAD_LINE_WIDTH, this.x);
        this.x = Math.min(this.game.ROAD_X + this.game.ROAD_WIDTH - this.width - this.game.ROAD_LINE_WIDTH, this.x);
    }

    draw() {
        super.draw(this.game.PLAYER_CAR_BODY, this.game.PLAYER_CAR_ROOF);
    }
}

class Obstacle extends Car {
    constructor(game) {
        super(game);
        const centerBiasedRandomValue = game.centerBiasedRandom();
        this.lane = Math.floor(centerBiasedRandomValue * game.ROAD_LANE_COUNT);
        
        const obstacleInSameLane = game.obstacles.filter(o => o.lane === this.lane).sort((a, b) => b.speed - a.speed)?.[0];
        const minSpeed = obstacleInSameLane?.speed ?? game.OBSTACLE_MIN_SPEED;
        const maxSpeed = game.targetRoadSpeed * 0.6;
        
        this.speed = minSpeed + (Math.random() * (maxSpeed - minSpeed));
        this.x = game.ROAD_X + (this.lane * game.LANE_WIDTH) + (game.LANE_WIDTH / 2) - (this.width / 2);
        this.y = -this.height;
        this.color = game.OBSTACLE_COLORS[Math.floor(Math.random() * game.OBSTACLE_COLORS.length)];
        this.scored = false;
    }

    update(dt, roadSpeed) {
        this.y += (roadSpeed - this.speed) * dt;
    }

    draw() {
        super.draw(this.color.body, this.color.roof);
    }
}

class SceneryObject {
    constructor(game, yPos = -30) {
        this.game = game;
        this.radius = Math.random() * 15 + 10;
        this.trunkWidth = 8;
        this.y = yPos;
        const roadSideWidth = this.game.ROAD_X - 40;
        this.x = Math.random() < 0.5 ? Math.random() * roadSideWidth + 20 : this.game.ROAD_X + this.game.ROAD_WIDTH + Math.random() * roadSideWidth + 20;
    }

    reset() {
        this.y = -this.radius * 2;
        const roadSideWidth = this.game.ROAD_X - 40;
        this.x = Math.random() < 0.5 ? Math.random() * roadSideWidth + 20 : this.game.ROAD_X + this.game.ROAD_WIDTH + Math.random() * roadSideWidth + 20;
    }

    update(dt, roadSpeed) {
        this.y += roadSpeed * dt;
        if (this.y > this.game.BASE_HEIGHT + this.radius) {
            this.reset();
        }
    }

    draw() {
        const sx = this.x * this.game.scaleW;
        const sy = this.y * this.game.scaleH;
        const sRadius = this.radius * this.game.scaleH;
        const sTrunkWidth = this.trunkWidth * this.game.scaleW;
        const ctx = this.game.ctx;

        ctx.fillStyle = '#5D4037'; // Trunk
        ctx.fillRect(sx - sTrunkWidth / 2, sy, sTrunkWidth, sRadius * 2);
        ctx.fillStyle = '#388E3C'; // Leaves
        ctx.beginPath();
        ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Scenery {
    constructor(game) {
        this.game = game;
        this.sceneryObjects = [];
        for (let i = 0; i < 10; i++) {
            this.sceneryObjects.push(new SceneryObject(this.game, i * (this.game.BASE_HEIGHT / 10)));
        }
    }

    update(dt, roadSpeed) {
        this.sceneryObjects.forEach(obj => obj.update(dt, roadSpeed));
    }

    draw() {
        this.drawGround();
        this.sceneryObjects.forEach(obj => obj.draw());
    }

    drawGround() {
        this.game.ctx.fillStyle = '#4CAF50';
        this.game.ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
    }
}

class Road {
    constructor(game) {
        this.game = game;
        this.lineDashOffset = 0;
    }

    update(dt, roadSpeed) {
        this.lineDashOffset = (this.lineDashOffset - roadSpeed * dt) % 60;
    }

    draw() {
        const { ctx, ROAD_X, ROAD_WIDTH, ROAD_LANE_COUNT, LANE_WIDTH, ROAD_LINE_WIDTH, scaleW, scaleH, canvas } = this.game;

        ctx.fillStyle = '#666';
        ctx.fillRect(ROAD_X * scaleW, 0, ROAD_WIDTH * scaleW, canvas.height);
        
        ctx.strokeStyle = 'white';
        ctx.setLineDash([25 * scaleH, 35 * scaleH]);
        ctx.lineDashOffset = this.lineDashOffset * scaleH;
        ctx.lineWidth = ROAD_LINE_WIDTH * scaleW;

        for (let i = 1; i < ROAD_LANE_COUNT; i++) {
            const x = (ROAD_X + i * LANE_WIDTH) * scaleW;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        ctx.setLineDash([]);
        ctx.fillStyle = 'white';
        ctx.fillRect(ROAD_X * scaleW, 0, ROAD_LINE_WIDTH * scaleW, canvas.height);
        ctx.fillRect((ROAD_X + ROAD_WIDTH - ROAD_LINE_WIDTH) * scaleW, 0, ROAD_LINE_WIDTH * scaleW, canvas.height);
    }
}

class UI {
    constructor(game) {
        this.game = game;
        this.ctx = game.ctx;
        this.scaleW = game.scaleW;
        this.scaleH = game.scaleH;
    }

    setScale(scaleW, scaleH) {
        this.scaleW = scaleW;
        this.scaleH = scaleH;
    }

    drawStartScreen() {
        if (this.game.isCoverImageLoaded) {
            this.ctx.drawImage(this.game.coverImg, 0, 0, this.game.canvas.width, this.game.canvas.height);
            if (this.game.showStartText) {
                this.ctx.fillStyle = 'white';
                this.ctx.textAlign = 'center';
                this.ctx.font = `bold ${16 * this.scaleH}px Segoe UI`;
                const actionText = this.game.isMobile() ? 'Kosketa näyttöä' : 'Paina Enter';
                this.ctx.fillText(`${actionText} aloittaaksesi`, this.game.canvas.width / 2, this.game.canvas.height - 60 * this.scaleH);
            }
        } else {
            this.ctx.fillStyle = '#2c2c2c';
            this.ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.font = `bold ${32 * this.scaleH}px Segoe UI`;
            this.ctx.fillText('Ladataan...', this.game.canvas.width / 2, this.game.canvas.height / 2);
        }
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.font = `bold ${48 * this.scaleH}px Segoe UI`;
        this.ctx.fillText('PELI OHI', this.game.canvas.width / 2, this.game.canvas.height / 2 - 40 * this.scaleH);
        this.ctx.font = `${24 * this.scaleH}px Segoe UI`;
        this.ctx.fillText(`Lopulliset pisteet: ${this.game.points}`, this.game.canvas.width / 2, this.game.canvas.height / 2 + 10 * this.scaleH);
        this.ctx.font = `${20 * this.scaleH}px Segoe UI`;
        const actionText = this.game.isMobile() ? 'Kosketa näyttöä' : 'Paina Enter';
        this.ctx.fillText(`${actionText} aloittaaksesi uudelleen`, this.game.canvas.width / 2, this.game.canvas.height / 2 + 60 * this.scaleH);
    }

    drawDigitalDashboard() {
        const margin = 10 * this.scaleW;
        const width = this.game.ROAD_X * this.scaleW - (2 * margin);
        const height = width * 0.85;
        const x = margin;
        const y = this.game.canvas.height - height - margin;

        this.ctx.save();
        this.ctx.fillStyle = '#111';
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1.5 * this.scaleW;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 6 * this.scaleW);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const textColor = '#f0f0f0';
        const fontSize = height * 0.4;

        const pointsY = y + height * 0.36;
        const pointsText = this.game.points.toString().padStart(4, '0').replaceAll('0', 'O');
        this.ctx.font = `bold ${fontSize}px monospace`;
        this.ctx.fillStyle = textColor;
        this.ctx.fillText(pointsText, x + width / 2, pointsY);

        const odoY = y + height * 0.7;
        const km = (Math.floor(this.game.pixelsToMeters(this.game.odometer) / 100) / 10).toFixed(1);
        const odometerText = km.padStart(4, '0').replaceAll('0', 'O');
        this.ctx.font = `bold ${fontSize}px monospace`;
        this.ctx.fillStyle = textColor;
        this.ctx.fillText(odometerText, x + width / 2, odoY);

        this.ctx.restore();
    }

    drawTraficSigns() {
        if (this.game.currentTraficSign) {
            this.drawSpeedSign(this.game.currentTraficSign);
        }
    }

    drawSpeedSign(type) {
        const centerX = this.game.ROAD_X + this.game.ROAD_WIDTH + (this.game.ROAD_X * 0.5);
        const centerY = 560;
        const colorYellow = "#ffcd00";
        const colorRed = "#e5002b";

        this.ctx.fillStyle = colorYellow;
        this.ctx.beginPath();
        this.ctx.arc(centerX * this.scaleW, centerY * this.scaleH, 30 * this.scaleW, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = colorRed;
        this.ctx.beginPath();
        this.ctx.arc(centerX * this.scaleW, centerY * this.scaleH, 28 * this.scaleW, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = colorYellow;
        this.ctx.beginPath();
        this.ctx.arc(centerX * this.scaleW, centerY * this.scaleH, 21 * this.scaleW, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.fillStyle = '#202020';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (type === 'speed_50') {
            this.ctx.font = `bold ${26 * this.scaleH}px Segoe UI`;
            this.ctx.fillText(`50`, centerX * this.scaleW, (centerY + 2) * this.scaleH);
        } else if (type === 'speed_100') {
            this.ctx.font = `bold ${25 * this.scaleH}px Segoe UI`;
            this.ctx.fillText(`1`, (centerX - 14) * this.scaleW, (centerY + 2) * this.scaleH);
            this.ctx.fillText(`0`, (centerX - 3) * this.scaleW, (centerY + 2) * this.scaleH);
            this.ctx.fillText(`0`, (centerX + 11) * this.scaleW, (centerY + 2) * this.scaleH);
        }
    }
}

window.addEventListener('load', () => {
    new Game('gameCanvas');
});
