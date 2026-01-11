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
        this.MAX_TILT_ANGLE = Math.PI / 18; // n. 10 astetta
        this.SCENERY_COUNT = 14;

        this.PLAYER_CAR_BODY = '#0091ff';
        this.PLAYER_CAR_ROOF = '#5ac2ff';

        this.OBSTACLE_COLORS = [
            { body: '#d4ac0d', roof: '#f5cba7' },
            { body: '#5cb85c', roof: '#98d198' },
            { body: '#ff4444', roof: '#ff8888' }
        ];
        this.TAIL_LIGHTS_COLOR = '#B71C1C';

        // UI Vakiot
        this.UI_COLOR_YELLOW = "#ffcd00";
        this.UI_COLOR_RED = "#e5002b";
        this.UI_COLOR_DARK = "#202020";
        this.UI_DASHBOARD_BG = "#111";
        this.UI_DASHBOARD_BORDER = "#333";
        this.UI_DASHBOARD_TEXT = "#f0f0f0";
        this.UI_FONT_PRIMARY = "Segoe UI";
        this.UI_FONT_MONO = "monospace";
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

        this.dashboard = new Dashboard(this);

        this.player = new Player(this);
        this.road = new Road(this);

        this.obstacleManager = new ObstacleManager(this);
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

        this.obstacleManager.update(dt, this.roadSpeed);

        this.updateOdometer(dt);
        this.updateRoadSpeed(dt);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.scenery.draw();
        this.road.draw();
        this.ui.drawTraficSigns();
        this.player.draw();
        this.obstacleManager.draw();
        this.dashboard.draw();
    }


    checkCollision(rect1, rect2) {
        const boxes2 = rect2.getHitboxes ? rect2.getHitboxes() : [rect2];
        const boxes1 = rect1.getHitboxes ? rect1.getHitboxes() : [rect1];

        for (const b1 of boxes1) {
            for (const b2 of boxes2) {
                if (b1.x < b2.x + b2.width &&
                    b1.x + b1.width > b2.x &&
                    b1.y < b2.y + b2.height &&
                    b1.y + b1.height > b2.y) {
                    return true;
                }
            }
        }
        return false;
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

class GameObject {
    constructor(game) {
        this.game = game;
        this.width = game.CAR_WIDTH;
        this.height = game.CAR_HEIGHT;
    }

    getHitboxes() {
        return [{ x: this.x, y: this.y, width: this.width, height: this.height }];
    }

    static renderCar(game, x, y, width, height, bodyColor, roofColor, rotation = 0) {
        const sw = width * game.scaleW;
        const sh = height * game.scaleH;
        const cx = (x + width / 2) * game.scaleW;
        const cy = (y + height / 2) * game.scaleH;
        const ctx = game.ctx;
        const radius = 8 * game.scaleW;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);

        // Piirretään suhteessa keskipisteeseen (0,0)
        const rx = -sw / 2;
        const ry = -sh / 2;

        // Varjo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.roundRect(rx + 5 * game.scaleW, ry + 5 * game.scaleH, sw, sh, radius);
        ctx.fill();

        // Auton runko
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(rx, ry, sw, sh, radius);
        ctx.fill();

        // Katto
        const roofW = sw * 0.76;
        const roofH = sh * 0.45;
        const roofX = rx + sw * 0.12;
        const roofY = ry + sh * 0.31;
        const roofRadius = radius / 2;

        // Pieni varjo katon alle tuomaan korkeuden tuntua
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.beginPath();
        ctx.roundRect(roofX + 2 * game.scaleW, roofY + 2 * game.scaleH, roofW, roofH, roofRadius);
        ctx.fill();

        // Varsinainen katto
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.roundRect(roofX, roofY, roofW, roofH, roofRadius);
        ctx.fill();

        // Takavalot hehkulla
        ctx.fillStyle = game.TAIL_LIGHTS_COLOR;
        ctx.shadowBlur = 12 * game.scaleW;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(rx + 4 * game.scaleW, ry + sh - 10 * game.scaleH, 10 * game.scaleW, 5 * game.scaleW);
        ctx.fillRect(rx + sw - 14 * game.scaleW, ry + sh - 10 * game.scaleH, 10 * game.scaleW, 5 * game.scaleW);

        ctx.restore();
    }
}

class Player extends GameObject {
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

        const { minX, maxX } = this.getBoundaries();

        // Jos ollaan jo reunassa ja yritetään liikkua vielä ulommas, asetetaan tavoitenopeus nollaan.
        if ((this.x <= minX && targetSpeed < 0) || (this.x >= maxX && targetSpeed > 0)) {
            targetSpeed = 0;
        }

        if (this.speed < targetSpeed) this.speed = Math.min(this.speed + this.game.PLAYER_ACCELERATION * dt, targetSpeed);
        else if (this.speed > targetSpeed) this.speed = Math.max(this.speed - this.game.PLAYER_ACCELERATION * dt, targetSpeed);

        this.x += this.speed * dt;
        this.x = Math.max(minX, Math.min(maxX, this.x));
    }

    getBoundaries() {
        return {
            minX: this.game.ROAD_X + this.game.ROAD_LINE_WIDTH,
            maxX: this.game.ROAD_X + this.game.ROAD_WIDTH - this.width - this.game.ROAD_LINE_WIDTH
        };
    }

    draw() {
        const rotation = (this.speed / this.game.MAX_PLAYER_SPEED) * this.game.MAX_TILT_ANGLE;
        GameObject.renderCar(this.game, this.x, this.y, this.width, this.height, this.game.PLAYER_CAR_BODY, this.game.PLAYER_CAR_ROOF, rotation);
    }
}


class BaseObstacle extends GameObject {
    constructor(game, lane, yPos) {
        super(game);
        this.lane = lane;
        this.x = game.ROAD_X + (this.lane * game.LANE_WIDTH) + (game.LANE_WIDTH / 2) - (this.width / 2);
        this.y = yPos ?? -this.height;
        this.scored = false;
        this.speed = 0;
    }

    update(dt, roadSpeed) {
        this.y += (roadSpeed - this.speed) * dt;
    }

    draw(bodyColor, roofColor) {
        GameObject.renderCar(this.game, this.x, this.y, this.width, this.height, bodyColor, roofColor);
    }
}

class MovingCar extends BaseObstacle {
    constructor(game, lane) {
        super(game, lane);

        // Lasketaan sopiva nopeus muiden autojen mukaan
        const otherCars = game.obstacleManager.obstacles.filter(o => o.lane === this.lane && o instanceof MovingCar);
        const obstacleInSameLane = otherCars.sort((a, b) => b.speed - a.speed)?.[0];
        const minSpeed = obstacleInSameLane?.speed ?? game.OBSTACLE_MIN_SPEED;
        const maxSpeed = game.targetRoadSpeed * 0.6;

        this.speed = minSpeed + (Math.random() * (maxSpeed - minSpeed));
        this.color = game.OBSTACLE_COLORS[Math.floor(Math.random() * game.OBSTACLE_COLORS.length)];
    }

    update(dt, roadSpeed) {
        // AI-autojen hidastus rajoituksen muuttuessa
        const maxAllowedSpeed = this.game.targetRoadSpeed * 0.8;
        if (this.speed > maxAllowedSpeed) {
            this.speed = Math.max(this.speed - 250 * dt, maxAllowedSpeed);
        }

        // Varmistetaan, ettei auto karkaa eteenpäin
        const effectiveSpeed = Math.min(this.speed, roadSpeed * 0.9);
        this.y += (roadSpeed - effectiveSpeed) * dt;
    }

    draw() {
        GameObject.renderCar(this.game, this.x, this.y, this.width, this.height, this.color.body, this.color.roof);
    }
}

class RoadBlock extends BaseObstacle {
    constructor(game, lane) {
        super(game, lane);
        this.speed = 0;
        this.width = game.LANE_WIDTH * 0.85;
        this.height = 30;
        this.barHeight = 12;
        // Päivitetään x, koska leveys vaihtui
        this.x = game.ROAD_X + (this.lane * game.LANE_WIDTH) + (game.LANE_WIDTH / 2) - (this.width / 2);
    }

    getHitboxes() {
        return [
            { x: this.x, y: this.y, width: this.width, height: this.barHeight },
            { x: this.x + 10, y: this.y, width: 6, height: this.height },
            { x: this.x + this.width - 16, y: this.y, width: 6, height: this.height }
        ];
    }

    draw() {
        const sx = this.x * this.game.scaleW;
        const sy = this.y * this.game.scaleH;
        const sw = this.width * this.game.scaleW;
        const sh = this.barHeight * this.game.scaleH;
        const ctx = this.game.ctx;

        ctx.save();
        // Jalat
        ctx.fillStyle = '#444';
        const legW = 6 * this.game.scaleW;
        const legH = this.height * this.game.scaleH;
        ctx.fillRect(sx + 10 * this.game.scaleW, sy, legW, legH);
        ctx.fillRect(sx + sw - 10 * this.game.scaleW - legW, sy, legW, legH);

        // Puomi
        const radius = 4 * this.game.scaleW;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, radius);
        ctx.save();
        ctx.clip();
        const stripeCount = 6;
        const stripeW = sw / stripeCount;
        for (let i = 0; i < stripeCount; i++) {
            ctx.fillStyle = (i % 2 === 0) ? '#ffcd00' : '#e5002b';
            ctx.fillRect(sx + i * stripeW, sy, stripeW, sh);
        }
        ctx.restore();
        ctx.restore();
    }
}

class Pothole extends BaseObstacle {
    constructor(game, lane, yPos) {
        super(game, lane, yPos);
        this.speed = 0;
        this.width = game.LANE_WIDTH * 0.82;
        this.height = 42;
        this.x = game.ROAD_X + (this.lane * game.LANE_WIDTH) + (game.LANE_WIDTH / 2) - (this.width / 2);

        this.points = [];
        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            const variance = 0.65 + Math.random() * 0.32;
            this.points.push({
                x: Math.cos(angle) * (this.width / 2) * variance,
                y: Math.sin(angle) * (this.height / 2) * variance
            });
        }

        this.debris = [];
        for (let i = 0; i < 12; i++) {
            this.debris.push({
                x: (Math.random() - 0.5) * this.width * 0.6,
                y: (Math.random() - 0.5) * this.height * 0.6,
                size: Math.random() * 3 + 1,
                color: Math.random() > 0.5 ? '#1a1108' : '#3d2b1f'
            });
        }
    }

    draw() {
        const sw = this.game.scaleW;
        const sh = this.game.scaleH;
        const centerX = (this.x + this.width / 2) * sw;
        const centerY = (this.y + this.height / 2) * sh;
        const ctx = this.game.ctx;

        ctx.save();
        ctx.translate(centerX, centerY);
        // Reunat, seinämät ja pohja (Yksinkertaistettu piirto)
        ctx.fillStyle = '#1a1108';
        this.drawShape(ctx, sw * 1.05, sh * 1.05);
        ctx.fillStyle = '#3d2b1f';
        this.drawShape(ctx, sw, sh);

        ctx.save();
        ctx.translate(3 * sw, 4 * sh);
        ctx.fillStyle = '#5a4534';
        this.drawShape(ctx, sw * 0.82, sh * 0.82);

        this.debris.forEach(d => {
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.arc(d.x * 0.8 * sw, d.y * 0.8 * sh, d.size * sw, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
        ctx.restore();
    }

    drawShape(ctx, factorW, factorH) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x * factorW, this.points[0].y * factorH);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x * factorW, this.points[i].y * factorH);
        }
        ctx.closePath();
        ctx.fill();
    }
}

class ObstacleManager {
    constructor(game) {
        this.game = game;
        this.obstacles = [];
    }

    update(dt, roadSpeed) {
        this.spawnObstacles();

        this.obstacles.forEach(obstacle => {
            obstacle.update(dt, roadSpeed);

            // Pistelasku
            if (obstacle.y > this.game.BASE_HEIGHT - this.game.PLAYER_Y_OFFSET + this.game.CAR_HEIGHT && !obstacle.scored) {
                this.game.points++;
                obstacle.scored = true;
            }

            // Törmäystarkistus
            if (this.game.checkCollision(this.game.player, obstacle)) {
                this.game.gameOver();
            }
        });

        // Siivous
        this.obstacles = this.obstacles.filter(obs => obs.y * this.game.scaleH < this.game.canvas.height);
    }

    spawnObstacles() {
        const obstaclesMinY = this.obstacles.length > 0 ? Math.min(...this.obstacles.map(obs => obs.y)) : this.game.BASE_HEIGHT;
        const spawnProbability = obstaclesMinY > this.game.MIN_OBSTACLE_GAP_Y ?
            this.game.acceleratingProbability(obstaclesMinY - this.game.MIN_OBSTACLE_GAP_Y, this.game.BASE_HEIGHT, 2) : 0;

        if (Math.random() < spawnProbability) {
            const lane = Math.floor(this.game.centerBiasedRandom() * this.game.ROAD_LANE_COUNT);

            // Luodaan ehdokaseste (puomi tai auto)
            const newObs = (this.game.currentTraficSign === 'speed_50' && Math.random() < 0.3)
                ? new RoadBlock(this.game, lane)
                : new MovingCar(this.game, lane);

            // Tarkistetaan onko kaistalla tilaa (ettei törmätä ruudulla)
            const isSafe = !this.obstacles
                .filter(obs => obs.lane === lane)
                .some(existing => this.checkFutureCollision(newObs, existing));

            if (isSafe) {
                if (newObs instanceof RoadBlock) {
                    newObs.scored = true; // Kuoppa ja puomi yhdessä antavat vain yhden pisteen
                    this.obstacles.push(new Pothole(this.game, lane, newObs.y - 50));
                }
                this.obstacles.push(newObs);
            }
        }
    }

    checkFutureCollision(obj1, obj2) {
        const upper = obj1.y < obj2.y ? obj1 : obj2;
        const lower = obj1.y < obj2.y ? obj2 : obj1;

        // Suhteellinen nopeus ruudulla: kuinka nopeasti ylempi saavuttaa alemman
        // Objekti i:n nopeus ruudulla alas on (roadSpeed - speed_i)
        // Ylempi saavuttaa alemman jos (roadSpeed - upper.speed) > (roadSpeed - lower.speed)
        // eli lower.speed > upper.speed
        const relativeV = lower.speed - upper.speed;
        if (relativeV <= 0) return false; // Ne etääntyvät toisistaan ruudulla

        const dist = lower.y - (upper.y + upper.height);
        const timeToHit = dist / relativeV;

        // Missä y-kordinaatissa ylempi on törmäyshetkellä
        const collisionY = upper.y + (this.game.roadSpeed - upper.speed) * timeToHit;
        return collisionY < this.game.BASE_HEIGHT;
    }

    draw() {
        this.obstacles.forEach(obs => obs.draw());
    }
}


class SceneryObject {
    constructor(game, yPos) {
        this.game = game;
        this.y = yPos;
        this.setRandomX();
    }

    setRandomX() {
        // Arvotaan puoli ja turvallinen etäisyys tiestä
        const roadSideWidth = this.game.ROAD_X - 60;
        if (Math.random() < 0.5) {
            this.x = Math.random() * roadSideWidth + 15;
        } else {
            const roadRight = this.game.ROAD_X + this.game.ROAD_WIDTH;
            this.x = roadRight + 45 + Math.random() * roadSideWidth;
        }
    }

    update(dt, roadSpeed) {
        this.y += roadSpeed * dt;
    }

    // Aliluokat ylikirjoittavat tämän
    draw() { }
}

class Tree extends SceneryObject {
    constructor(game, yPos) {
        super(game, yPos);
        this.radius = Math.random() * 15 + 10;
        this.trunkWidth = 8;
    }

    draw() {
        const sx = this.x * this.game.scaleW;
        const sy = this.y * this.game.scaleH;
        const sRadius = this.radius * this.game.scaleH;
        const sTrunkWidth = this.trunkWidth * this.game.scaleW;
        const ctx = this.game.ctx;

        ctx.save();
        // Runko
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(sx - sTrunkWidth / 2, sy, sTrunkWidth, sRadius * 2);
        // Lehdet
        ctx.fillStyle = '#388E3C';
        ctx.beginPath();
        ctx.arc(sx, sy, sRadius, 0, Math.PI * 2);
        ctx.fill();
        // Valoefekti
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(sx - sRadius * 0.2, sy - sRadius * 0.2, sRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Scenery {
    constructor(game) {
        this.game = game;
        this.sceneryObjects = [];
        
        // Määritetään "hihna", jolle puut asetetaan. 
        // Sen pitää olla reilusti ruutua pidempi (BASE_HEIGHT + buffer),
        // jotta ylin puu on varmasti kokonaan piilossa (runkoineen päivineen).
        // Puun korkeus on n. 40-50px, joten 300px puskuri on turvallinen.
        const buffer = 300; 
        const totalHeight = this.game.BASE_HEIGHT + buffer;
        
        // Lasketaan välimatka tälle pidennetylle alueelle.
        this.spacing = totalHeight / this.game.SCENERY_COUNT;

        for (let i = 0; i < this.game.SCENERY_COUNT; i++) {
            // Aloitetaan luominen hieman ruudun alareunan alapuolelta (+50px),
            // jotta puut eivät lopu kesken alhaalta heti pelin alkaessa.
            const startOffset = 50;
            
            // Lasketaan sijainti: Alhaalta ylöspäin.
            const y = (this.game.BASE_HEIGHT + startOffset) - (i * this.spacing);
            
            this.sceneryObjects.push(this.createRandomObject(y));
        }
    }

    createRandomObject(yPos) {
        return new Tree(this.game, yPos);
    }

    update(dt, roadSpeed) {
        for (let i = 0; i < this.sceneryObjects.length; i++) {
            const obj = this.sceneryObjects[i];
            obj.update(dt, roadSpeed);

            // Kierrätys: Kun puu on mennyt riittävän alas (ruudun korkeus + pieni marginaali)
            if (obj.y > this.game.BASE_HEIGHT + 100) {
                
                // Etsitään, missä kohtaa ylin puu (pienin y) tällä hetkellä menee.
                const minY = Math.min(...this.sceneryObjects.map(o => o.y));
                
                // Asetetaan uusi puu jonon jatkoksi yläpäähän.
                const newY = minY - this.spacing;
                
                this.sceneryObjects[i] = this.createRandomObject(newY);
            }
        }
    }

    draw() {
        this.drawGround();

        // Luodaan väliaikainen kopio listasta ja järjestetään se Y-koordinaatin mukaan nousevasti.
        // [...this.sceneryObjects] luo kopion (shallow copy), jotta emme sekoita alkuperäisen
        // listan järjestystä, jota update-metodi saattaa käyttää.
        const objectsToDraw = [...this.sceneryObjects].sort((a, b) => a.y - b.y);

        // Piirretään järjestetyssä järjestyksessä:
        // Pienin Y (kauimmainen) ensin, suurin Y (lähin) viimeisenä.
        objectsToDraw.forEach(obj => obj.draw());
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

class Dashboard {
    constructor(game) {
        this.game = game;
    }

    draw() {
        const { ctx, scaleW, scaleH, canvas, ROAD_X } = this.game;
        const margin = 10 * scaleW;
        const width = ROAD_X * scaleW - (2 * margin);
        const height = width * 0.85;
        const x = margin;
        const y = canvas.height - height - margin;

        ctx.save();

        // Tausta ja kehys
        ctx.fillStyle = this.game.UI_DASHBOARD_BG;
        ctx.strokeStyle = this.game.UI_DASHBOARD_BORDER;
        ctx.lineWidth = 1.5 * scaleW;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 6 * scaleW);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = height * 0.4;
        ctx.fillStyle = this.game.UI_DASHBOARD_TEXT;

        // Pisteet (Score)
        const pointsY = y + height * 0.36;
        const pointsText = this.game.points.toString().padStart(4, '0').replaceAll('0', 'O');
        ctx.font = `bold ${fontSize}px ${this.game.UI_FONT_MONO}`;
        ctx.fillText(pointsText, x + width / 2, pointsY);

        // Matkamittari (Odometer)
        const odoY = y + height * 0.7;
        const km = (Math.floor(this.game.pixelsToMeters(this.game.odometer) / 100) / 10).toFixed(1);
        const odometerText = km.padStart(4, '0').replaceAll('0', 'O');
        ctx.font = `bold ${fontSize}px ${this.game.UI_FONT_MONO}`;
        ctx.fillText(odometerText, x + width / 2, odoY);

        ctx.restore();
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
        const { canvas, coverImg, isCoverImageLoaded, showStartText, isMobile } = this.game;

        if (isCoverImageLoaded) {
            this.ctx.drawImage(coverImg, 0, 0, canvas.width, canvas.height);
            if (showStartText) {
                this.ctx.fillStyle = 'white';
                this.ctx.textAlign = 'center';
                this.ctx.font = `bold ${16 * this.scaleH}px ${this.game.UI_FONT_PRIMARY}`;
                const actionText = isMobile() ? 'Kosketa näyttöä' : 'Paina Enter';
                this.ctx.fillText(`${actionText} aloittaaksesi`, canvas.width / 2, canvas.height - 60 * this.scaleH);
            }
        } else {
            this.ctx.fillStyle = this.game.UI_COLOR_DARK;
            this.ctx.fillRect(0, 0, canvas.width, canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.font = `bold ${32 * this.scaleH}px ${this.game.UI_FONT_PRIMARY}`;
            this.ctx.fillText('Ladataan...', canvas.width / 2, canvas.height / 2);
        }
    }

    drawGameOver() {
        const { canvas, points, isMobile } = this.game;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.ctx.fillStyle = 'white';
        this.ctx.textAlign = 'center';
        this.ctx.font = `bold ${48 * this.scaleH}px ${this.game.UI_FONT_PRIMARY}`;
        this.ctx.fillText('PELI OHI', canvas.width / 2, canvas.height / 2 - 40 * this.scaleH);

        this.ctx.font = `${24 * this.scaleH}px ${this.game.UI_FONT_PRIMARY}`;
        this.ctx.fillText(`Lopulliset pisteet: ${points}`, canvas.width / 2, canvas.height / 2 + 10 * this.scaleH);

        this.ctx.font = `${20 * this.scaleH}px ${this.game.UI_FONT_PRIMARY}`;
        const actionText = isMobile() ? 'Kosketa näyttöä' : 'Paina Enter';
        this.ctx.fillText(`${actionText} aloittaaksesi uudelleen`, canvas.width / 2, canvas.height / 2 + 60 * this.scaleH);
    }

    drawTraficSigns() {
        if (this.game.currentTraficSign) {
            this.drawSpeedSign(this.game.currentTraficSign);
        }
    }

    drawSpeedSign(type) {
        const { ROAD_X, ROAD_WIDTH, UI_COLOR_YELLOW, UI_COLOR_RED, UI_COLOR_DARK, UI_FONT_PRIMARY } = this.game;
        const centerX = (ROAD_X + ROAD_WIDTH + (ROAD_X * 0.5)) * this.scaleW;
        const centerY = 560 * this.scaleH;

        const outerRadius = 30 * this.scaleW;
        const middleRadius = 28 * this.scaleW;
        const innerRadius = 21 * this.scaleW;

        // Sign background (yellow)
        this.ctx.fillStyle = UI_COLOR_YELLOW;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
        this.ctx.fill();

        // Sign border (red)
        this.ctx.fillStyle = UI_COLOR_RED;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, middleRadius, 0, 2 * Math.PI);
        this.ctx.fill();

        // Inner circle (yellow)
        this.ctx.fillStyle = UI_COLOR_YELLOW;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
        this.ctx.fill();

        // Text
        this.ctx.fillStyle = UI_COLOR_DARK;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        if (type === 'speed_50') {
            this.ctx.font = `bold ${26 * this.scaleH}px ${UI_FONT_PRIMARY}`;
            this.ctx.fillText(`50`, centerX, (centerY + 2 * this.scaleH));
        } else if (type === 'speed_100') {
            this.ctx.font = `bold ${25 * this.scaleH}px ${UI_FONT_PRIMARY}`;
            this.ctx.fillText(`1`, centerX - 14 * this.scaleW, centerY + 2 * this.scaleH);
            this.ctx.fillText(`0`, centerX - 3 * this.scaleW, centerY + 2 * this.scaleH);
            this.ctx.fillText(`0`, centerX + 11 * this.scaleW, centerY + 2 * this.scaleH);
        }
    }
}


window.addEventListener('load', () => {
    new Game('gameCanvas');
});
