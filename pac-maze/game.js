/**
 * Pelin päälogiikka: renderöinti, ohjaus ja pelisilmukka.
 */

const GRID_SIZE = 10;
const MOUTH_MAX_OPEN = Math.PI / 3; // Radiaaneina
const SVG_NS = "http://www.w3.org/2000/svg";
const SHORTCUT_CHANCE = 0.3; // Todennäköisyys oikotielle (0.0 - 1.0)



// Sokkelon ja hahmon asetukset
const WALL_THICKNESS = 14;     // Seinän kokonaispaksuus
const WALL_HOLLOW_WIDTH = 9;   // Onton kohdan leveys
const WALL_ROUNDING = "round";  // Pyöristyksen tyyli
const PLAYER_RADIUS = 14;      // Hahmon vakiosäde
const PLAYER_GAP = 3;          // Väli seinän ja Pac-Manin välillä
const GHOST_COLORS = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']; // Blinky, Pinky, Inky, Clyde

// Lasketaan ruudun koko siten, että hahmo ja seinät mahtuvat ilmarakoineen
const CELL_SIZE = WALL_THICKNESS + 2 * (PLAYER_RADIUS + PLAYER_GAP);

// Kirsikan asetukset
const CHERRY_VISIBLE_MS = 10000;   // Aika ennen vilkkumista
const CHERRY_BLINK_MS = 500;       // Yhden vilkkusyklin kesto (näkyvissä + näkymätön)
const CHERRY_BLINK_COUNT = 5;      // Kuinka monta kertaa vilkahtaa näkyviin katoamisen jälkeen

// Pisteytys ja elämät
const SCORE_DOT = 10;
const SCORE_CHERRY = 200;
const SCORE_GOAL = 100;
const INITIAL_LIVES = 3;

class Game {
    constructor() {
        this.mazeSvg = document.getElementById('maze-svg');
        this.levelLabel = document.getElementById('level-count');
        this.winOverlay = document.getElementById('win-overlay');
        this.nextLevelBtn = document.getElementById('next-level-btn');
        this.startMenu = document.getElementById('start-menu');

        this.level = 1;
        this.onlyOnePath = true;
        this.ghostCount = 0;
        this.maze = null;
        this.player = {
            x: 0, // Ruutukoordinaatit
            y: 0,
            pixelX: 20, // Keskipiste pikseleinä
            pixelY: 20,
            dir: null,      // Nykyinen liikesuunta: 'UP', 'DOWN', 'LEFT', 'RIGHT'
            nextDir: null,   // Puskuroitu suunta
            facingDir: 'RIGHT', // Suunta johon hahmo katsoo
            speed: 2.5,     // Pikseliä per frame
            radius: PLAYER_RADIUS
        };

        this.dots = []; // Taulukko pisteille: { x, y, eaten, element }
        this.cherry = null; // { x, y, eaten, element }
        this.ghosts = [];
        this.score = 0;
        this.lives = INITIAL_LIVES;
        this.scoreElement = null; // Luodaan myöhemmin
        this.livesElement = null; // Luodaan myöhemmin
        this.menuIndex = 0; // 0 = Mode A, 1 = Mode B

        this.isMoving = false;
        this.gameRunning = false; // Aloitetaan pysäytettynä

        this.setupEventListeners();
        // init() kutsutaan vasta kun valikko on kuitattu
        this.gameLoop();
    }

    init() {
        this.maze = new Maze(GRID_SIZE, GRID_SIZE, this.onlyOnePath, SHORTCUT_CHANCE);
        this.gridData = this.maze.generate();


        this.createLayers(); // Luodaan tasot piirtojärjestystä varten
        this.updateLayoutParameters();
        this.resetPlayer();
        this.renderMaze();
        this.renderPlayer();
    }

    createLayers() {
        this.mazeSvg.innerHTML = '';
        this.layers = {
            walls: this.createLayer('layer-walls'),
            dots: this.createLayer('layer-dots'),
            cherry: this.createLayer('layer-cherry'),
            goal: this.createLayer('layer-goal'),
            player: this.createLayer('layer-player'),
            ghosts: this.createLayer('layer-ghosts')
        };
    }

    createLayer(id) {
        const g = document.createElementNS(SVG_NS, "g");
        g.setAttribute("id", id);
        this.mazeSvg.appendChild(g);
        return g;
    }

    updateLayoutParameters() {
        // Lasketaan tarvittava täyte (padding), jotta paksut seinät mahtuvat näkyviin.
        // Seinä on keskitetty koordinaattiin, joten puolet paksuudesta menee yli rajan.
        const padding = WALL_THICKNESS / 2;
        const totalSize = GRID_SIZE * CELL_SIZE;
        const viewSize = totalSize + 2 * padding;

        // Päivitetään SVG:n viewBox dynaamisesti
        this.mazeSvg.setAttribute("viewBox", `${-padding} ${-padding} ${viewSize} ${viewSize}`);

        // Päivitetään pelisäiliön maksimileveys. 
        // Lasketaan se ruudukon ja tarvittavan paddingin mukaan.
        const dynamicMaxWidth = viewSize;
        document.documentElement.style.setProperty('--container-max-width', `${dynamicMaxWidth}px`);
    }

    resetPlayer() {
        this.player.x = 0;
        this.player.y = 0;
        this.player.pixelX = CELL_SIZE / 2;
        this.player.pixelY = CELL_SIZE / 2;
        this.player.dir = null;
        this.player.nextDir = null;
        this.player.facingDir = 'RIGHT';
        this.isMoving = false;
        this.gameRunning = true;

        this.initGhosts();

        // Kirsikan tila
        this.cherry = null;
        this.cherryVisible = false;
        this.cherryDealtWith = false;
        if (this.cherryTimer) clearTimeout(this.cherryTimer);
        this.cherryTimer = null;

        this.updateScoreUI();
        this.winOverlay.classList.add('hidden');
        if (this.loseOverlay) this.loseOverlay.classList.add('hidden');
        if (this.deathOverlay) this.deathOverlay.classList.add('hidden');
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();

            // ESC avaa/sulkee valitun dialogin tai valikon
            if (key === 'escape') {
                if (!this.startMenu.classList.contains('hidden')) {
                    this.closeMenuWithoutReset();
                } else if (!this.winOverlay.classList.contains('hidden')) {
                    this.winOverlay.classList.add('hidden');
                } else if (this.deathOverlay && !this.deathOverlay.classList.contains('hidden')) {
                    this.deathOverlay.classList.add('hidden');
                    this.resetPositions();
                    this.gameRunning = true;
                } else if (this.loseOverlay && !this.loseOverlay.classList.contains('hidden')) {
                    this.loseOverlay.classList.add('hidden');
                } else {
                    // Jos mikään ei ole auki, avataan päävalikko
                    this.gameRunningBeforeMenu = this.gameRunning;
                    this.gameRunning = false;
                    this.startMenu.classList.remove('hidden');
                    this.updateMenuHighlight();
                }
                return;
            }

            // Valikko-ohjaus
            if (!this.startMenu.classList.contains('hidden')) {
                if (['arrowup', 'w', 'arrowleft', 'a'].includes(key)) {
                    this.menuIndex = 0;
                    this.updateMenuHighlight();
                } else if (['arrowdown', 's', 'arrowright', 'd'].includes(key)) {
                    this.menuIndex = 1;
                    this.updateMenuHighlight();
                } else if (key === 'enter') {
                    if (this.menuIndex === 0) {
                        this.onlyOnePath = true;
                        this.ghostCount = 0;
                    } else {
                        this.onlyOnePath = false;
                        this.ghostCount = 3;
                    }
                    this.startGameWithMode();
                }
                return;
            }

            if (['arrowup', 'w'].includes(key)) this.player.nextDir = 'UP';
            if (['arrowdown', 's'].includes(key)) this.player.nextDir = 'DOWN';
            if (['arrowleft', 'a'].includes(key)) this.player.nextDir = 'LEFT';
            if (['arrowright', 'd'].includes(key)) this.player.nextDir = 'RIGHT';

            // Enter-logiikka muissa tilanteissa
            if (key === 'enter' && !this.gameRunning) {
                if (!this.winOverlay.classList.contains('hidden')) {
                    this.startNextLevel();
                } else if (this.deathOverlay && !this.deathOverlay.classList.contains('hidden')) {
                    this.deathOverlay.classList.add('hidden');
                    this.resetPositions();
                    this.gameRunning = true;
                } else if (this.loseOverlay && !this.loseOverlay.classList.contains('hidden')) {
                    this.level = 1;
                    this.score = 0;
                    this.lives = INITIAL_LIVES;
                    this.levelLabel.textContent = this.level;
                    this.init();
                }
            }

            // Jos peli on pysähtynyt ja painetaan suuntaa, aloitetaan liike
            if (this.gameRunning && !this.player.dir && this.player.nextDir) {
                if (this.canMoveInDirection(this.player.x, this.player.y, this.player.nextDir)) {
                    this.player.dir = this.player.nextDir;
                    this.player.facingDir = this.player.dir;
                }
            }
        });

        // Lisää pistenäyttö ja elämät headeriin jos niitä ei ole
        const stats = document.querySelector('.stats');
        if (stats && !document.getElementById('score-count')) {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'stat-item';
            scoreItem.innerHTML = `
                <span class="label">Pisteet:</span>
                <span id="score-count" class="value">0</span>
            `;
            stats.prepend(scoreItem);
        }

        if (stats && !document.getElementById('lives-count')) {
            const livesItem = document.createElement('div');
            livesItem.className = 'stat-item';
            livesItem.innerHTML = `
                <span class="label">Elämät:</span>
                <span id="lives-count" class="value">${INITIAL_LIVES}</span>
            `;
            stats.appendChild(livesItem);
        }

        this.scoreElement = document.getElementById('score-count');
        this.livesElement = document.getElementById('lives-count');

        // Häviöikkuna
        if (!document.getElementById('lose-overlay')) {
            const loseOverlay = document.createElement('div');
            loseOverlay.id = 'lose-overlay';
            loseOverlay.className = 'overlay hidden';
            loseOverlay.innerHTML = `
                <div class="glass-panel celebration">
                    <h2>Peli ohi!</h2>
                    <p>Kummitus sai sinut kiinni.</p>
                    <button id="retry-btn">Yritä uudelleen</button>
                </div>
            `;
            document.body.appendChild(loseOverlay);
            this.loseOverlay = loseOverlay;
            document.getElementById('retry-btn').addEventListener('click', () => {
                this.level = 1;
                this.score = 0;
                this.lives = INITIAL_LIVES;
                this.levelLabel.textContent = this.level;
                this.init();
            });
        }

        // Kuolema-ikkuna (elämä menee)
        if (!document.getElementById('death-overlay')) {
            const deathOverlay = document.createElement('div');
            deathOverlay.id = 'death-overlay';
            deathOverlay.className = 'overlay hidden';
            deathOverlay.innerHTML = `
                <div class="glass-panel celebration">
                    <h2>Hups!</h2>
                    <p>Menetit elämän.</p>
                    <button id="continue-btn">Jatka peliä</button>
                </div>
            `;
            document.body.appendChild(deathOverlay);
            this.deathOverlay = deathOverlay;
            document.getElementById('continue-btn').addEventListener('click', () => {
                this.deathOverlay.classList.add('hidden');
                this.resetPositions();
                this.gameRunning = true;
            });
        }

        this.nextLevelBtn.addEventListener('click', () => {
            this.startNextLevel();
        });

        // Alkuvalikon napit
        document.getElementById('mode-a-btn').addEventListener('click', () => {
            this.onlyOnePath = true;
            this.ghostCount = 0;
            this.menuIndex = 0;
            this.startGameWithMode();
        });

        document.getElementById('mode-b-btn').addEventListener('click', () => {
            this.onlyOnePath = false;
            this.ghostCount = 3;
            this.menuIndex = 1;
            this.startGameWithMode();
        });

        // Sulje valikko klikkaamalla taustaa
        this.startMenu.addEventListener('click', (e) => {
            if (e.target === this.startMenu) {
                this.closeMenuWithoutReset();
            }
        });

        // Hampurilaisvalikko mobiilissa
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', () => {
                if (this.startMenu.classList.contains('hidden')) {
                    this.gameRunningBeforeMenu = this.gameRunning;
                    this.gameRunning = false;
                    this.startMenu.classList.remove('hidden');
                    this.updateMenuHighlight();
                } else {
                    this.closeMenuWithoutReset();
                }
            });
        }

        // Mobiiliohjaimet
        const setupMobileBtn = (id, dir) => {
            const el = document.getElementById(id);
            if (el) {
                const handleTouch = (e) => {
                    e.preventDefault();
                    this.player.nextDir = dir;
                    // Jos peli on pysähtynyt ja painetaan suuntaa, aloitetaan liike
                    if (this.gameRunning && !this.player.dir) {
                        if (this.canMoveInDirection(this.player.x, this.player.y, this.player.nextDir)) {
                            this.player.dir = this.player.nextDir;
                            this.player.facingDir = this.player.dir;
                        }
                    }
                };
                el.addEventListener('touchstart', handleTouch);
                el.addEventListener('mousedown', handleTouch);
            }
        };

        setupMobileBtn('ctrl-up', 'UP');
        setupMobileBtn('ctrl-right', 'RIGHT');
        setupMobileBtn('ctrl-down', 'DOWN');
        setupMobileBtn('ctrl-left', 'LEFT');

        this.updateMenuHighlight();
    }

    updateMenuHighlight() {
        const btnA = document.getElementById('mode-a-btn');
        const btnB = document.getElementById('mode-b-btn');
        if (this.menuIndex === 0) {
            btnA.classList.add('focused');
            btnB.classList.remove('focused');
        } else {
            btnA.classList.remove('focused');
            btnB.classList.add('focused');
        }
    }

    startGameWithMode() {
        this.startMenu.classList.add('hidden');
        this.level = 1;
        this.score = 0;
        this.lives = INITIAL_LIVES;
        this.levelLabel.textContent = this.level;
        this.init();
        this.gameRunning = true;
    }

    closeMenuWithoutReset() {
        this.startMenu.classList.add('hidden');
        // Palautetaan pelin tila sellaiseksi kuin se oli ennen valikon avaamista
        if (this.gameRunningBeforeMenu !== undefined) {
            this.gameRunning = this.gameRunningBeforeMenu;
        } else {
            // Jos peliä ei oltu vielä aloitettu, pidetään se pysäytettynä
            this.gameRunning = false;
        }
    }

    startNextLevel() {
        this.level++;
        this.levelLabel.textContent = this.level;
        this.init();
    }

    renderMaze() {
        // Tasot on jo luotu initissä, tyhjennetään ne uutta kenttää varten
        this.layers.walls.innerHTML = '';
        this.layers.dots.innerHTML = '';
        this.layers.goal.innerHTML = '';

        // Renderöidään seinät
        const walls = [];
        const wallSet = new Set();

        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = this.gridData[r][c];
                const x = c * CELL_SIZE;
                const y = r * CELL_SIZE;

                // Kerätään kaikki seinät uniikkeina
                if (cell.walls.top) addWall(x, y, x + CELL_SIZE, y);
                if (cell.walls.right) addWall(x + CELL_SIZE, y, x + CELL_SIZE, y + CELL_SIZE);
                if (cell.walls.bottom) addWall(x, y + CELL_SIZE, x + CELL_SIZE, y + CELL_SIZE);
                if (cell.walls.left) addWall(x, y, x, y + CELL_SIZE);
            }
        }

        function addWall(x1, y1, x2, y2) {
            // Järjestetään koordinaatit, jotta duplikaatit tunnistetaan (pienempi ensin)
            if (x1 > x2 || (x1 === x2 && y1 > y2)) {
                [x1, x2] = [x2, x1];
                [y1, y2] = [y2, y1];
            }
            const key = `${x1},${y1}-${x2},${y2}`;
            if (!wallSet.has(key)) {
                wallSet.add(key);
                walls.push({ x1, y1, x2, y2 });
            }
        }

        // Piirretään seinät kahdessa erässä "onton" ja pyöristetyn efektin saamiseksi
        // 1. Ulompi paksu sininen kerros
        walls.forEach(w => {
            const line = document.createElementNS(SVG_NS, "line");
            line.setAttribute("x1", w.x1);
            line.setAttribute("y1", w.y1);
            line.setAttribute("x2", w.x2);
            line.setAttribute("y2", w.y2);
            line.setAttribute("class", "wall-outer");
            line.setAttribute("stroke-width", WALL_THICKNESS);
            line.setAttribute("stroke-linecap", WALL_ROUNDING);
            this.layers.walls.appendChild(line);
        });

        // 2. Sisempi ohuempi taustavärinen kerros
        walls.forEach(w => {
            const line = document.createElementNS(SVG_NS, "line");
            line.setAttribute("x1", w.x1);
            line.setAttribute("y1", w.y1);
            line.setAttribute("x2", w.x2);
            line.setAttribute("y2", w.y2);
            line.setAttribute("class", "wall-inner");
            line.setAttribute("stroke-width", WALL_HOLLOW_WIDTH);
            line.setAttribute("stroke-linecap", WALL_ROUNDING);
            this.layers.walls.appendChild(line);
        });

        // Renderöidään maali (oikea alakulma)
        const goal = document.createElementNS(SVG_NS, "circle");
        goal.setAttribute("cx", (GRID_SIZE - 0.5) * CELL_SIZE);
        goal.setAttribute("cy", (GRID_SIZE - 0.5) * CELL_SIZE);
        goal.setAttribute("r", "8");
        goal.setAttribute("class", "goal-node");
        this.layers.goal.appendChild(goal);

        // Valitaan kirsikan paikka jo tässä. Piste pidetään silti paikallaan, 
        // jotta pelaaja ei tiedä kirsikan paikkaa etukäteen.
        // Valitaan satunnainen indeksi väliltä [1, GRID_SIZE*GRID_SIZE - 2],
        // jolloin vältytään aloitus- (0) ja lopetusruudulta (GRID_SIZE^2 - 1).
        const randomIndex = 1 + Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE - 2));
        this.cherryPos = {
            r: Math.floor(randomIndex / GRID_SIZE),
            c: randomIndex % GRID_SIZE
        };

        const cherryR = this.cherryPos.r;
        const cherryC = this.cherryPos.c;

        // Renderöidään pisteet
        this.dots = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                // Maali-ruutuun tai aloitusruutuun ei laiteta pistettä
                if (r === GRID_SIZE - 1 && c === GRID_SIZE - 1) continue;
                if (r === 0 && c === 0) continue;

                const dot = document.createElementNS(SVG_NS, "circle");
                const x = (c + 0.5) * CELL_SIZE;
                const y = (r + 0.5) * CELL_SIZE;
                dot.setAttribute("cx", x);
                dot.setAttribute("cy", y);
                dot.setAttribute("r", "3.5");
                dot.setAttribute("fill", "white");
                dot.setAttribute("class", "maze-dot");
                this.layers.dots.appendChild(dot);

                this.dots.push({ x, y, eaten: false, element: dot });
            }
        }

        // Kirsikkaa ei piirretä heti, vaan se ilmestyy myöhemmin
        this.cherry = null;
    }

    renderCherry(r, c) {
        const x = (c + 0.5) * CELL_SIZE;
        const y = (r + 0.5) * CELL_SIZE;

        // Luodaan kirsikka-SVG ryhmä
        const g = document.createElementNS(SVG_NS, "g");
        g.setAttribute("class", "cherry-node");

        // 1. MÄÄRITETÄÄN POLUT JA MUODOT
        const stemPath = `M ${x - 4} ${y + 4} Q ${x - 4} ${y - 10} ${x + 3} ${y - 12} M ${x + 4} ${y + 1} Q ${x + 4} ${y - 5} ${x + 3} ${y - 12}`;

        // --- LEHDEN SÄÄTÖ ---
        const leafAngle = 40;  // Kulma asteina (0 = suoraan oikealle, 90 = suoraan alas)
        const leafLength = 11; // Lehden pituus

        const rad = leafAngle * Math.PI / 180;
        const tx = x + 3 + Math.cos(rad) * leafLength;
        const ty = y - 12 + Math.sin(rad) * leafLength;

        // Muodostetaan lehti tx ja ty (tip) koordinaattien avulla
        const leafPathData = `M ${x + 3} ${y - 12} Q ${tx} ${ty - 7} ${tx} ${ty} Q ${tx - 7} ${ty} ${x + 3} ${y - 12}`;
        // --------------------

        // 2. LUODAAN ELEMENTIT (ei lisätä vielä groupiin)

        // Valkoiset reunukset (lelevennetyt polut ja suuremmat ympyrät)
        const outlineStem = document.createElementNS(SVG_NS, "path");
        outlineStem.setAttribute("d", stemPath);
        outlineStem.setAttribute("stroke", "white");
        outlineStem.setAttribute("stroke-width", "5");
        outlineStem.setAttribute("fill", "none");
        outlineStem.setAttribute("stroke-linecap", "round");

        const outlineBerry1 = document.createElementNS(SVG_NS, "circle");
        outlineBerry1.setAttribute("cx", x - 4);
        outlineBerry1.setAttribute("cy", y + 4);
        outlineBerry1.setAttribute("r", "7.5");
        outlineBerry1.setAttribute("fill", "white");

        const outlineBerry2 = document.createElementNS(SVG_NS, "circle");
        outlineBerry2.setAttribute("cx", x + 4);
        outlineBerry2.setAttribute("cy", y + 1);
        outlineBerry2.setAttribute("r", "7.5");
        outlineBerry2.setAttribute("fill", "white");

        const outlineLeaf = document.createElementNS(SVG_NS, "path");
        outlineLeaf.setAttribute("d", leafPathData);
        outlineLeaf.setAttribute("fill", "white");
        outlineLeaf.setAttribute("stroke", "white");
        outlineLeaf.setAttribute("stroke-width", "3");

        // Varsinaiset osat
        const stem = document.createElementNS(SVG_NS, "path");
        stem.setAttribute("d", stemPath);
        stem.setAttribute("stroke", "#8B4513");
        stem.setAttribute("stroke-width", "2.5");
        stem.setAttribute("fill", "none");
        stem.setAttribute("stroke-linecap", "round");

        const berry1 = document.createElementNS(SVG_NS, "circle");
        berry1.setAttribute("cx", x - 4);
        berry1.setAttribute("cy", y + 4);
        berry1.setAttribute("r", "6");
        berry1.setAttribute("fill", "#ef4444");

        const berry2 = document.createElementNS(SVG_NS, "circle");
        berry2.setAttribute("cx", x + 4);
        berry2.setAttribute("cy", y + 1);
        berry2.setAttribute("r", "6");
        berry2.setAttribute("fill", "#ef4444");

        const leaf = document.createElementNS(SVG_NS, "path");
        leaf.setAttribute("d", leafPathData);
        leaf.setAttribute("fill", "#4ade80");

        // Kiillot
        const shine1 = document.createElementNS(SVG_NS, "circle");
        shine1.setAttribute("cx", x - 6);
        shine1.setAttribute("cy", y + 2);
        shine1.setAttribute("r", "1.5");
        shine1.setAttribute("fill", "white");

        const shine2 = document.createElementNS(SVG_NS, "circle");
        shine2.setAttribute("cx", x + 2);
        shine2.setAttribute("cy", y - 1);
        shine2.setAttribute("r", "1.5");
        shine2.setAttribute("fill", "white");

        // 3. LISÄTÄÄN ELEMENTIT PIIRTOJÄRJESTYKSESSÄ
        // Ensin kaikki valkoiset "taustaosat" (luo yhtenäisen reunuksen)
        g.appendChild(outlineStem);
        g.appendChild(outlineBerry1);
        g.appendChild(outlineBerry2);
        g.appendChild(outlineLeaf);

        // Sitten varsinaiset värilliset elementit
        g.appendChild(stem);
        g.appendChild(berry1);
        g.appendChild(berry2);
        g.appendChild(leaf);

        // Viimeisenä kiillot aivan päällimmäiseksi
        g.appendChild(shine1);
        g.appendChild(shine2);

        this.layers.cherry.appendChild(g);
        this.cherry = { x, y, eaten: false, element: g };
    }

    spawnCherry() {
        if (this.cherryDealtWith) return;
        this.renderCherry(this.cherryPos.r, this.cherryPos.c);
        this.cherryVisible = true;

        // Kirsikka on näkyvissä kiinteän ajan, jonka jälkeen se alkaa vilkkua.
        this.cherryTimer = setTimeout(() => {
            if (this.cherry && !this.cherry.eaten) {
                this.cherry.element.classList.add('blinking');
                // Varmistetaan että CSS-animaatio vastaa vakiota
                this.cherry.element.style.animationDuration = `${CHERRY_BLINK_MS}ms`;
            }

            // Kirsikka poistuu kun se on välkähtänyt halutun määrän
            this.cherryTimer = setTimeout(() => {
                this.hideCherry();
            }, CHERRY_BLINK_MS * CHERRY_BLINK_COUNT);
        }, CHERRY_VISIBLE_MS);
    }

    hideCherry() {
        if (this.cherry && !this.cherry.eaten) {
            this.cherryVisible = false;
            this.cherryDealtWith = true;
            this.cherry.element.setAttribute("visibility", "hidden");
        }
    }

    updateScoreUI() {
        if (this.scoreElement) {
            this.scoreElement.textContent = this.score;
        }
        if (this.livesElement) {
            this.livesElement.textContent = this.lives;
        }
    }


    renderPlayer() {
        // Luodaan Pac-Man SVG
        const g = document.createElementNS(SVG_NS, "g");
        g.setAttribute("id", "pacman-group");

        const body = document.createElementNS(SVG_NS, "path");
        body.setAttribute("id", "pacman-body");
        body.setAttribute("fill", "#fde047");

        g.appendChild(body);
        this.layers.player.appendChild(g);
        this.updatePacmanGraphic();
    }

    updatePacmanGraphic() {
        const body = document.getElementById('pacman-body');
        if (!body) return;

        const x = this.player.pixelX;
        const y = this.player.pixelY;
        const r = this.player.radius;

        // Suun animaatio käännetty: reunoilla täysin auki, keskellä kiinni.
        const phaseX = Math.sin((this.player.pixelX / CELL_SIZE) * Math.PI);
        const phaseY = Math.sin((this.player.pixelY / CELL_SIZE) * Math.PI);

        // Varmistetaan min-arvo 0.01, ettei SVG-kaari hajoa (vilkkuminen)
        const mouthOpen = Math.max(0.01, (1 - Math.abs(phaseX * phaseY)) * MOUTH_MAX_OPEN);

        let rotation = 0;
        const lookDir = this.player.facingDir;
        if (lookDir === 'RIGHT') rotation = 0;
        if (lookDir === 'DOWN') rotation = 90;
        if (lookDir === 'LEFT') rotation = 180;
        if (lookDir === 'UP') rotation = 270;

        // Pieni säätö: jos suunta on vasemmalle, SVG-kaaren piirto voi vaatia tarkkuutta
        // Mutta rotaatio hoitaa sen tässä tapauksessa.

        // Kaari Pac-Manin suuta varten
        const startAngle = mouthOpen;
        const endAngle = 2 * Math.PI - mouthOpen;

        const x1 = x + r * Math.cos(startAngle);
        const y1 = y + r * Math.sin(startAngle);
        const x2 = x + r * Math.cos(endAngle);
        const y2 = y + r * Math.sin(endAngle);

        const pathData = `
            M ${x} ${y}
            L ${x1} ${y1}
            A ${r} ${r} 0 1 1 ${x2} ${y2}
            Z
        `;

        body.setAttribute("d", pathData);
        body.setAttribute("transform", `rotate(${rotation}, ${x}, ${y})`);
    }

    gameLoop() {
        if (this.gameRunning) {
            this.update();
            this.updateGhosts();
        }
        requestAnimationFrame(() => this.gameLoop());
    }

    update() {
        const p = this.player;

        if (p.dir) {
            // Liikutaan kohti seuraavaa ruutukeskipistettä
            let targetX = p.x * CELL_SIZE + CELL_SIZE / 2;
            let targetY = p.y * CELL_SIZE + CELL_SIZE / 2;

            // Jos ollaan keskellä tai menossa sen ohi
            const distBefore = Math.sqrt((p.pixelX - targetX) ** 2 + (p.pixelY - targetY) ** 2);

            // Liikuta pikseleitä
            if (p.dir === 'UP') p.pixelY -= p.speed;
            if (p.dir === 'DOWN') p.pixelY += p.speed;
            if (p.dir === 'LEFT') p.pixelX -= p.speed;
            if (p.dir === 'RIGHT') p.pixelX += p.speed;

            const distAfter = Math.sqrt((p.pixelX - targetX) ** 2 + (p.pixelY - targetY) ** 2);

            // Jos ollaan saavuttu tai ohitettu keskipiste, käsitellään kääntyminen/pysähtyminen
            if (distAfter >= distBefore || distAfter < p.speed) {
                // Lukitaan keskelle
                p.pixelX = targetX;
                p.pixelY = targetY;

                // Tarkistetaan voimmeko vaihtaa puskuroituun suuntaan
                if (p.nextDir && this.canMoveInDirection(p.x, p.y, p.nextDir)) {
                    p.dir = p.nextDir;
                    p.facingDir = p.dir;
                    p.nextDir = null;
                } else if (!this.canMoveInDirection(p.x, p.y, p.dir)) {
                    // Jos ei voi jatkaa ja puskuri ei onnistu, pysähdytään
                    p.dir = null;
                }

                // Jos liike jatkuu, päivitetään grid-koordinaatti seuraavaa kohdetta varten
                if (p.dir) {
                    if (p.dir === 'UP') p.y--;
                    if (p.dir === 'DOWN') p.y++;
                    if (p.dir === 'LEFT') p.x--;
                    if (p.dir === 'RIGHT') p.x++;
                }
            }

            // Satunnainen kääntyminen 180 astetta onnistuu heti (Pac-Man logic)
            if (p.nextDir) {
                if ((p.dir === 'LEFT' && p.nextDir === 'RIGHT') ||
                    (p.dir === 'RIGHT' && p.nextDir === 'LEFT') ||
                    (p.dir === 'UP' && p.nextDir === 'DOWN') ||
                    (p.dir === 'DOWN' && p.nextDir === 'UP')) {

                    // Vaihda suuntaa ja siirrä grid-kohde takaisin ruutuun jota kohti mentiin
                    const oldDir = p.dir;
                    p.dir = p.nextDir;
                    p.facingDir = p.dir;
                    p.nextDir = null;

                    // Koska olimme matkalla p.x/p.y kohti, ja nyt käännyimme, 
                    // meidän on korjattava mihin ruutuun olemme nyt matkalla.
                    if (oldDir === 'UP') p.y++;
                    if (oldDir === 'DOWN') p.y--;
                    if (oldDir === 'LEFT') p.x++;
                    if (oldDir === 'RIGHT') p.x--;
                }
            }
        }

        this.updatePacmanGraphic();
        this.checkWin();
        this.checkDotCollision();
        this.checkCherryCollision();
        this.checkGhostCollision();
    }

    checkDotCollision() {
        const px = this.player.pixelX;
        const py = this.player.pixelY;

        // Etsitään lähin syömätön piste
        // Käytetään etäisyyttä (Pytagoras), jotta piste katoaa vasta kun ollaan kohdalla
        const dot = this.dots.find(d => {
            if (d.eaten) return false;
            const dist = Math.sqrt((d.x - px) ** 2 + (d.y - py) ** 2);
            return dist < 8; // Katoaa kun ollaan 8 pikselin säteellä keskipisteestä
        });

        if (dot) {
            dot.eaten = true;
            dot.element.setAttribute("visibility", "hidden");
            this.score += SCORE_DOT;
            this.updateScoreUI();

            // Tarkistetaan kirsikan ilmestyminen (40% pisteistä kerätty)
            const totalDots = this.dots.length;
            const eatenDots = this.dots.filter(d => d.eaten).length;
            if (!this.cherryVisible && !this.cherryDealtWith && (eatenDots / totalDots) >= 0.4) {
                this.spawnCherry();
            }
        }
    }

    checkCherryCollision() {
        if (!this.cherry || this.cherry.eaten || !this.cherryVisible) return;

        const px = this.player.pixelX;
        const py = this.player.pixelY;
        const dist = Math.sqrt((this.cherry.x - px) ** 2 + (this.cherry.y - py) ** 2);

        if (dist < 2) {
            this.cherry.eaten = true;
            this.cherryVisible = false;
            this.cherryDealtWith = true;
            if (this.cherryTimer) clearTimeout(this.cherryTimer);
            this.cherry.element.setAttribute("visibility", "hidden");

            this.score += SCORE_CHERRY;
            this.updateScoreUI();
        }
    }

    canMoveInDirection(r, c, dir) {
        // Huom: r ja c ovat grid-koordinaatit. Pöytä on this.gridData[y][x]
        const playerX = this.player.x;
        const playerY = this.player.y;
        const cell = this.gridData[playerY][playerX];

        if (dir === 'UP' && (playerY === 0 || cell.walls.top)) return false;
        if (dir === 'DOWN' && (playerY === GRID_SIZE - 1 || cell.walls.bottom)) return false;
        if (dir === 'LEFT' && (playerX === 0 || cell.walls.left)) return false;
        if (dir === 'RIGHT' && (playerX === GRID_SIZE - 1 || cell.walls.right)) return false;
        return true;
    }


    initGhosts() {
        this.ghosts = [];
        this.layers.ghosts.innerHTML = '';

        // Luodaan kummitukset, sijoitetaan ne kauas aloituksesta
        // Aloitetaan vaikka oikeasta yläkulmasta ja vasemmasta alakulmasta
        const startPos = [
            { r: 0, c: GRID_SIZE - 1 },
            { r: GRID_SIZE - 1, c: 0 },
            { r: GRID_SIZE - 1, c: Math.floor(GRID_SIZE / 2) },
            { r: Math.floor(GRID_SIZE / 2), c: GRID_SIZE - 1 }
        ];

        for (let i = 0; i < this.ghostCount; i++) {
            const pos = startPos[i % startPos.length];
            const ghost = new Ghost(pos.r, pos.c, GHOST_COLORS[i % GHOST_COLORS.length], this);
            this.ghosts.push(ghost);
        }
    }

    updateGhosts() {
        this.ghosts.forEach(ghost => ghost.update());
    }

    checkGhostCollision() {
        const px = this.player.pixelX;
        const py = this.player.pixelY;
        const threshold = PLAYER_RADIUS + 5;

        for (const ghost of this.ghosts) {
            const dist = Math.sqrt((ghost.pixelX - px) ** 2 + (ghost.pixelY - py) ** 2);
            if (dist < threshold) {
                this.handlePlayerDeath();
                break;
            }
        }
    }

    handlePlayerDeath() {
        this.lives--;
        this.updateScoreUI();
        this.gameRunning = false;

        if (this.lives <= 0) {
            this.loseOverlay.classList.remove('hidden');
        } else {
            this.deathOverlay.classList.remove('hidden');
        }
    }

    resetPositions() {
        // Pelaajan palautus
        this.player.x = 0;
        this.player.y = 0;
        this.player.pixelX = CELL_SIZE / 2;
        this.player.pixelY = CELL_SIZE / 2;
        this.player.dir = null;
        this.player.nextDir = null;
        this.player.facingDir = 'RIGHT';

        // Kummitusten palautus
        this.initGhosts();

        this.updatePacmanGraphic();
    }

    checkWin() {
        if (this.player.x === GRID_SIZE - 1 && this.player.y === GRID_SIZE - 1) {
            // Oletetaan että voitto on voimassa kun ollaan tarpeeksi lähellä maalin keskipistettä
            const targetX = (GRID_SIZE - 0.5) * CELL_SIZE;
            const targetY = (GRID_SIZE - 0.5) * CELL_SIZE;
            const d = Math.sqrt((this.player.pixelX - targetX) ** 2 + (this.player.pixelY - targetY) ** 2);

            if (d < 5 && this.gameRunning) {
                this.gameRunning = false;
                this.score += SCORE_GOAL;
                this.updateScoreUI();
                this.winOverlay.classList.remove('hidden');
            }

        }
    }
}

class Ghost {
    constructor(r, c, color, game) {
        this.r = r;
        this.c = c;
        this.color = color;
        this.game = game;
        this.pixelX = (c + 0.5) * CELL_SIZE;
        this.pixelY = (r + 0.5) * CELL_SIZE;
        this.dir = null;
        this.speed = 1.5;
        this.element = this.createGraphic();
    }

    createGraphic() {
        const g = document.createElementNS(SVG_NS, "g");
        const r = 14; // Hieman pienempi kuin pelaaja

        // Kummituksen runko (perinteinen muoto)
        const body = document.createElementNS(SVG_NS, "path");
        body.setAttribute("fill", this.color);
        g.appendChild(body);
        this.body = body;
        this.updateBody();

        // Silmät
        const eyeR = 3.5;
        const pupilR = 1.5;

        const leftEye = document.createElementNS(SVG_NS, "circle");
        leftEye.setAttribute("cx", -5);
        leftEye.setAttribute("cy", -2);
        leftEye.setAttribute("r", eyeR);
        leftEye.setAttribute("fill", "white");
        g.appendChild(leftEye);

        const rightEye = document.createElementNS(SVG_NS, "circle");
        rightEye.setAttribute("cx", 5);
        rightEye.setAttribute("cy", -2);
        rightEye.setAttribute("r", eyeR);
        rightEye.setAttribute("fill", "white");
        g.appendChild(rightEye);

        const leftPupil = document.createElementNS(SVG_NS, "circle");
        leftPupil.setAttribute("cx", -5);
        leftPupil.setAttribute("cy", -2);
        leftPupil.setAttribute("r", pupilR);
        leftPupil.setAttribute("fill", "blue");
        g.appendChild(leftPupil);
        this.leftPupil = leftPupil;

        const rightPupil = document.createElementNS(SVG_NS, "circle");
        rightPupil.setAttribute("cx", 5);
        rightPupil.setAttribute("cy", -2);
        rightPupil.setAttribute("r", pupilR);
        rightPupil.setAttribute("fill", "blue");
        g.appendChild(rightPupil);
        this.rightPupil = rightPupil;

        this.game.layers.ghosts.appendChild(g);
        return g;
    }

    update() {
        if (!this.dir) {
            this.chooseNewDirection();
        }

        let targetX = (this.c + 0.5) * CELL_SIZE;
        let targetY = (this.r + 0.5) * CELL_SIZE;

        const distBefore = Math.sqrt((this.pixelX - targetX) ** 2 + (this.pixelY - targetY) ** 2);

        if (this.dir === 'UP') this.pixelY -= this.speed;
        if (this.dir === 'DOWN') this.pixelY += this.speed;
        if (this.dir === 'LEFT') this.pixelX -= this.speed;
        if (this.dir === 'RIGHT') this.pixelX += this.speed;

        const distAfter = Math.sqrt((this.pixelX - targetX) ** 2 + (this.pixelY - targetY) ** 2);

        if (distAfter >= distBefore || distAfter < this.speed) {
            this.pixelX = targetX;
            this.pixelY = targetY;
            this.chooseNewDirection();
        }

        this.element.setAttribute("transform", `translate(${this.pixelX}, ${this.pixelY})`);
        this.updatePupils();
    }

    updateBody() {
        const r = 14;
        // Pään kaari ja sivut
        let d = `M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 L ${r} ${r}`;

        // Staattinen ja symmetrinen siniaaltohelma
        // Huiput reunoilla (x = r ja x = -r) ja keskellä (x = 0)
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
            const x = r - (i * (2 * r) / steps);
            const theta = (i / steps) * Math.PI * 4;
            // y-koordinaatti vaihtelee välillä [r, r+4]. Pitkä reuna = r+4.
            const y = r + (1 + Math.cos(theta)) * 2;
            d += ` L ${x} ${y}`;
        }

        d += ` L ${-r} 0 Z`;
        this.body.setAttribute("d", d);
    }

    updatePupils() {
        if (!this.dir) return;

        let dx = 0;
        let dy = 0;
        const offset = 1.5;

        if (this.dir === 'UP') dy = -offset;
        if (this.dir === 'DOWN') dy = offset;
        if (this.dir === 'LEFT') dx = -offset;
        if (this.dir === 'RIGHT') dx = offset;

        this.leftPupil.setAttribute("cx", -5 + dx);
        this.leftPupil.setAttribute("cy", -2 + dy);
        this.rightPupil.setAttribute("cx", 5 + dx);
        this.rightPupil.setAttribute("cy", -2 + dy);
    }

    chooseNewDirection() {
        const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const possible = directions.filter(d => {
            // Estä suunnanvaihto heti takaisin (paitsi jos umpiikuja)
            if (this.dir === 'UP' && d === 'DOWN') return false;
            if (this.dir === 'DOWN' && d === 'UP') return false;
            if (this.dir === 'LEFT' && d === 'RIGHT') return false;
            if (this.dir === 'RIGHT' && d === 'LEFT') return false;

            const cell = this.game.gridData[this.r][this.c];
            if (d === 'UP' && (this.r === 0 || cell.walls.top)) return false;
            if (d === 'DOWN' && (this.r === GRID_SIZE - 1 || cell.walls.bottom)) return false;
            if (d === 'LEFT' && (this.c === 0 || cell.walls.left)) return false;
            if (d === 'RIGHT' && (this.c === GRID_SIZE - 1 || cell.walls.right)) return false;
            return true;

        });

        if (possible.length > 0) {
            this.dir = possible[Math.floor(Math.random() * possible.length)];
        } else {
            // Jos vain yksi tie (taaksepäin), ota se
            const backDir = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' }[this.dir];
            this.dir = backDir;
        }

        // Päivitä grid-koordinaatit kohti uutta ruutua
        if (this.dir === 'UP') this.r--;
        if (this.dir === 'DOWN') this.r++;
        if (this.dir === 'LEFT') this.c--;
        if (this.dir === 'RIGHT') this.c++;
    }
}

// Käynnistetään peli
new Game();
