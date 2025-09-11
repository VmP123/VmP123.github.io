import { SvgService } from './svg-service.js';
import { ScenarioMap } from './scenario.js';
import { InfoArea } from './ui.js';
import { HexGrid } from './grid.js';
import { HexGridView } from './grid-view.js';
import { GameState } from './state.js';
import { AnimationService } from './animation-service.js';
import { GameStatus } from './constants.js';
import { ViewController } from './view-controller.js';
import { GameEngine } from './engine.js';
import { Unit } from './unit.js';

class Game {
    constructor() {
        this.svg = document.getElementById('main');
        this.infoAreaSvg = document.getElementById('info-area');
        this.hexRadius = 50;
        this.lineWidth = 2;

        this.svgService = null;
        this.scenarioMap = null;
        this.gameState = null;
        this.animationService = null;
        this.hexGrid = null;
        this.hexGridView = null;
        this.viewController = null;
        this.infoArea = null;
        this.gameEngine = null;
        this.listenersAdded = false;
    }

    async init(saveData = null) {
        // Clear existing SVG content if any
        this.svg.innerHTML = '';
        this.infoAreaSvg.innerHTML = '';

        // Only load SvgService once
        if (!this.svgService) {
            this.svgService = new SvgService();
            await this.svgService.load();
        }

        let scenario;
        if (saveData) {
            // Create a scenario-like object from save data
            scenario = {
                width: Math.max(...saveData.hexes.map(h => h.x)) + 1,
                height: Math.max(...saveData.hexes.map(h => h.y)) + 1,
                mapHexes: saveData.hexes.map(h => ({
                    ...h,
                    terrain: h.terrainType // Align property name
                }))
            };
            // Add unit data to the hexes for HexGrid constructor
            saveData.units.forEach(unitData => {
                const hex = scenario.mapHexes.find(h => h.x === unitData.x && h.y === unitData.y);
                if (hex) {
                    hex.unit = unitData.unitType;
                    hex.player = unitData.player;
                }
            });

            this.gameState = new GameState();
            Object.assign(this.gameState, saveData.gameState);
        } else {
            // Load from scenario file
            this.scenarioMap = new ScenarioMap();
            await this.scenarioMap.load("./maps/map01.json");
            scenario = this.scenarioMap;
            this.gameState = new GameState();
            this.gameState.status = GameStatus.GAMEON;
        }

        this.hexGrid = new HexGrid(scenario.height, scenario.width, scenario, this.gameState, false);

        // If loading from save, update unit states and rehydrate references
        if (saveData) {
            this.hexGrid.units.forEach(unit => {
                const savedUnit = saveData.units.find(su => su.x === unit.x && su.y === unit.y);
                if (savedUnit) {
                    Object.assign(unit, savedUnit);
                }
            });

            const getUnitByCoords = (coordsStr) => {
                if (!coordsStr) return null;
                const [x, y] = coordsStr.split(',').map(Number);
                return this.hexGrid.units.find(u => u.x === x && u.y === y);
            };
            const getHexByCoords = (coords) => {
                if (!coords) return null;
                return this.hexGrid.getHex(coords.x, coords.y);
            }

            this.gameState.vacatedHex = getHexByCoords(saveData.gameState.vacatedHex);
            this.gameState.attackers = saveData.gameState.attackers.map(getUnitByCoords);
            this.gameState.selectedUnits = saveData.gameState.selectedUnits.map(getUnitByCoords);
        }

        // Common initialization logic for the view
        this.hexGridView = new HexGridView(this.hexGrid, this.hexRadius, this.lineWidth, this.gameState, false, this.svgService);
        await this.hexGridView.drawHexGrid();

        this.animationService = new AnimationService(this.gameState, this.hexGridView);

        this.gameEngine = new GameEngine(this.gameState, this.hexGrid);

        this.svg.appendChild(this.hexGridView.svg);

        const mapWidth = parseFloat(this.hexGridView.svg.getAttribute('width'));
        const mapHeight = parseFloat(this.hexGridView.svg.getAttribute('height'));
        this.viewController = new ViewController(this.svg, mapWidth, mapHeight, this.gameState);
        this.viewController.hexGridView = this.hexGridView;
        this.hexGridView.viewController = this.viewController;

        this.hexGridView.hexViews.forEach(hexView => {
            hexView.svg.addEventListener('click', () => {
                if (this.viewController.panned) return;
                this.gameEngine.handleHexClick(hexView.hex);
            });
        });

        this.hexGridView.unitViews.forEach(unitView => {
            unitView.addClickHandler();
        });

        this.infoArea = new InfoArea(this.gameState, this.hexGridView, this.viewController.zoom.bind(this.viewController));
        this.infoArea.draw();
        this.infoAreaSvg.appendChild(this.infoArea.svg);

        this.viewController.setViewBox(0, 0, 1024, 880);

        if (!this.listenersAdded) { // Only add listeners once
            this.setupResizeListener();
            this.setupSaveLoadListeners();
            this.listenersAdded = true;
        }
        
        // Refresh UI with loaded state
        if (saveData) {
            this.infoArea.updatePhaseText();
            this.infoArea.updatePlayerText();
            this.infoArea.refreshCombatResultText();
            this.infoArea.refreshStatusText();
            this.infoArea.refreshEndPhaseButton();
            this.viewController.updateSelectionView(this.gameState.selectedUnits);
            this.hexGridView.refreshUnitDimmers();
        }
    }

    setupSaveLoadListeners() {
        document.getElementById('save-button').addEventListener('click', () => this.saveGame());
        const loadInput = document.getElementById('load-input');
        document.getElementById('load-button').addEventListener('click', () => loadInput.click());
        loadInput.addEventListener('change', (e) => this.loadGame(e.target.files[0]));
    }

    saveGame() {
        const getUnitId = (unit) => `${unit.x},${unit.y}`;

        const saveData = {
            gameState: {
                status: this.gameState.status,
                winner: this.gameState.winner,
                activePlayer: this.gameState.activePlayer,
                currentTurnPhase: this.gameState.currentTurnPhase,
                unassignedDamagePoints: this.gameState.unassignedDamagePoints,
                specialPhaseQueue: this.gameState.specialPhaseQueue,
                crtColumn: this.gameState.crtColumn,
                d6Value: this.gameState.d6Value,
                vacatedHex: this.gameState.vacatedHex ? { x: this.gameState.vacatedHex.x, y: this.gameState.vacatedHex.y } : null,
                attackers: this.gameState.attackers.map(getUnitId),
                selectedUnits: this.gameState.selectedUnits.map(getUnitId)
            },
            hexes: this.hexGrid.hexes.map(hex => ({
                x: hex.x,
                y: hex.y,
                terrainType: hex.terrainType,
                riverEdges: hex.riverEdges,
                flag: hex.flag,
                player: hex.player
            })),
            units: this.hexGrid.units.map(unit => ({
                x: unit.x,
                y: unit.y,
                unitType: unit.unitType,
                player: unit.player,
                healthStatus: unit.healthStatus,
                moved: unit.moved,
                attacked: unit.attacked,
                advanced: unit.advanced
            }))
        };

        const json = JSON.stringify(saveData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'hex-savegame.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    loadGame(file) {
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const saveData = JSON.parse(e.target.result);
                await this.init(saveData);
            } catch (error) {
                console.error("Failed to load or parse save game file:", error);
                alert("Error: Could not load save game file.");
            }
        };
        reader.readAsText(file);
    }

    setupResizeListener() {
        const gameWrapper = document.getElementById('game-wrapper');
        const baseWidth = 1424;
        const baseHeight = 880;
        const outerMargin = 25;

        const resizeGame = () => {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            const availableWidth = viewportWidth - outerMargin * 2;
            const availableHeight = viewportHeight - outerMargin * 2;

            const scaleX = availableWidth / baseWidth;
            const scaleY = availableHeight / baseHeight;

            const scale = Math.min(scaleX, scaleY);

            gameWrapper.style.transform = `scale(${scale})`;
        }

        window.addEventListener('resize', resizeGame);
        resizeGame(); // Initial resize
    }
}

window.onload = () => {
    const game = new Game();
    game.init();
};