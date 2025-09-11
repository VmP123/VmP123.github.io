import { Hex } from './hex.js';
import { Unit } from './unit.js';
import { TerrainType, UnitProperties, MaxMovementPointCost, TerrainProperties, SpecialPhaseType, GameStatus, PlayerType } from './constants.js';
import { getAnotherPlayer, getAdjacentHexes } from './utils.js';

export class HexGrid {
    constructor(rows, cols, scenarioMap, gameState, isEditor = false) {
        this.hexes = [];
        this.units = [];
        this.rows = rows;
        this.cols = cols;
        this.scenarioMap = scenarioMap;
        this.gameState = gameState;
        this.isEditor = isEditor;

        this.initialize();
    }

    initialize() {
        const mapData = this._preprocessMapData();

        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if ((row === this.rows - 1) && (col % 2 === 1)) {
                    continue;
                }
                
                const hex = this._initializeHex(col, row, mapData);
                this.hexes.push(hex);
            }
        }
    }

    _preprocessMapData() {
        const mapData = new Map();
        if (Array.isArray(this.scenarioMap.mapHexes)) {
            this.scenarioMap.mapHexes.forEach(hex => {
                mapData.set(`${hex.x},${hex.y}`, hex);
            });
        }
        return mapData;
    }

    _initializeHex(col, row, mapData) {
        const hex = new Hex(col, row, this, this.isEditor);
        const mapHexData = mapData.get(`${col},${row}`) || {};

        hex.setTerrain(mapHexData.terrain || TerrainType.CLEAR);
        hex.setFlag(mapHexData.flag, mapHexData.player);
        hex.setRiverEdges(mapHexData.riverEdges || []);

        if (mapHexData.unit) {
            const newUnit = new Unit(col, row, mapHexData.unit, mapHexData.player);
            this.addUnit(newUnit);
            hex.setUnit(newUnit);
        }

        return hex;
    }

    isRiverBetween(hexA, hexB) {
        const dx = hexB.x - hexA.x;
        const dy = hexB.y - hexA.y;

        const offsetsOddRow = [ [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0] ];
        const offsetsEvenRow = [ [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1] ];
        const offsets = hexA.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

        const edgeIndexA = offsets.findIndex(offset => offset[0] === dx && offset[1] === dy);
        if (edgeIndexA === -1) return false;

        const oppositeEdgeMap = { 0: 3, 1: 4, 2: 5, 3: 0, 4: 1, 5: 2 };
        const edgeIndexB = oppositeEdgeMap[edgeIndexA];

        return hexA.riverEdges.includes(edgeIndexA) || hexB.riverEdges.includes(edgeIndexB);
    }

    isHexInEnemyZoc(hex, player) {
        const adjacentHexes = getAdjacentHexes(hex.x, hex.y, this.rows, this.cols);
        const enemyPlayer = getAnotherPlayer(player);

        for (const adjHex of adjacentHexes) {
            const unit = this.units.find(u => u.x === adjHex.x && u.y === adjHex.y);
            if (unit && unit.player === enemyPlayer) {
                const targetHex = this.getHex(adjHex.x, adjHex.y);
                if (!this.isRiverBetween(hex, targetHex)) {
                    return true;
                }
            }
        }
        return false;
    }

    addUnit(unit) {
        this.units.push(unit);
    }

    isEmpty(x, y) {
        return !this.units.some(unit => unit.x === x && unit.y === y) && this.hexes.some(hex => hex.x === x && hex.y === y && hex.isEmpty);
    }

    getAdjacentEmptyHexesRecursion(x, y, currentDepth, maxDepth) {
        const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols).filter(ah => this.isEmpty(ah.x, ah.y));
        var allAdjacentHexes = [...adjacentHexes];

        if (currentDepth < maxDepth) {
            for(const adjacentHex of adjacentHexes) {
                const adjacentHexesRecursion = this.getAdjacentEmptyHexesRecursion(adjacentHex.x, adjacentHex.y, currentDepth + 1, maxDepth).filter(ah => !(ah.x == x && ah.y == y));
                allAdjacentHexes.push(...adjacentHexesRecursion);
            }
        }

        if (currentDepth === 1 && maxDepth > 1) {
            allAdjacentHexes = Array.from(new Set(allAdjacentHexes.map(JSON.stringify)), JSON.parse);
        }

        return allAdjacentHexes;
    }

    dfs(x, y, movementPoints, visited, reachableHexes, fromX, fromY, cameFrom, gScore) {
        const currentHex = this.getHex(x, y);
        const isCurrentHexInZoc = this.isHexInEnemyZoc(currentHex, this.gameState.activePlayer);

        const existingVisitIndex = visited.findIndex(v => v.x === x && v.y === y);
        const existingVisit = existingVisitIndex !== -1 ? visited[existingVisitIndex] : null;

        if (existingVisit) {
            const isExistingPathInZoc = existingVisit.isCurrentHexInZoc;
            if (isExistingPathInZoc && isCurrentHexInZoc && existingVisit.movementPoints >= movementPoints) return;
            else if (!isCurrentHexInZoc && !isExistingPathInZoc && existingVisit.movementPoints >= movementPoints) return;
        }

        let cost = !this.units.some(unit => unit.x === x && unit.y === y) ? TerrainProperties[currentHex.terrainType].movementPointCost : MaxMovementPointCost;

        const hasPrevHex = fromX !== undefined && fromY !== undefined;
        if (hasPrevHex) {
            const fromHex = this.getHex(fromX, fromY);
            if (this.isRiverBetween(fromHex, currentHex)) {
                cost += 1;
            }
        }

        if (movementPoints < cost) {
            if (!existingVisit) {
                visited.push({ x: x, y: y, movementPoints: movementPoints, isCurrentHexInZoc: isCurrentHexInZoc });
            }
            return;
        }

        const newVisitEntry = { x: x, y: y, movementPoints: movementPoints, isCurrentHexInZoc: isCurrentHexInZoc };
        if (existingVisit) {
            visited[existingVisitIndex] = newVisitEntry;
        } else {
            visited.push(newVisitEntry);
        }

        if (!reachableHexes.some(rh => rh.x === x && rh.y === y)) {
            reachableHexes.push({ x: x, y: y });
        }

        if (hasPrevHex) {
            const prevHex = this.getHex(fromX, fromY);
            cameFrom.set(currentHex, prevHex);
            gScore.set(currentHex, (gScore.get(prevHex) || 0) + cost);
        } else {
            gScore.set(currentHex, 0);
        }

        const remainingPoints = movementPoints - cost;

        if (remainingPoints > 0 && !isCurrentHexInZoc) {
            const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols);
            adjacentHexes.forEach(ah => this.dfs(ah.x, ah.y, remainingPoints, visited, reachableHexes, x, y, cameFrom, gScore));
        }
    }

    getReachableHex(x, y, movementPoints) {
        const reachableHexes = [];
        const visited = [];
        const cameFrom = new Map();
        const gScore = new Map();
      
        visited.push({x: x, y: y, movementPoints: movementPoints});
      
        const adjacentHexes = getAdjacentHexes(x, y, this.rows, this.cols);
        adjacentHexes.forEach(ah => this.dfs(ah.x, ah.y, movementPoints, visited, reachableHexes, x, y, cameFrom, gScore));
                
        return { reachableHexes, cameFrom, gScore };
    }

    findPath(start, end, movingUnit) {
        const movementAllowance = UnitProperties[movingUnit.unitType].movementAllowance;
        const { cameFrom, gScore } = this.getReachableHex(start.x, start.y, movementAllowance);

        if (cameFrom.has(end)) {
            return this.reconstructPath(cameFrom, end);
        }

        return null; 
    }

    reconstructPath(cameFrom, current) {
        const totalPath = [current];
        while (cameFrom.has(current)) {
            current = cameFrom.get(current);
            totalPath.unshift(current);
        }
        return totalPath;
    }

    removeUnit(unit) {
        const index = this.units.indexOf(unit);
        if (index > -1) {
            this.units.splice(index, 1);
        }

        const hex = this.getHex(unit.x, unit.y);
        if (hex) {
            hex.removeUnit();
        }
    }

    getHex(x, y) {
        return this.hexes.find(h => h.x === x && h.y === y);
    }

    clearSelections() {
        this.gameState.selectUnit(null);
    }

    clearUnitMovedAttacked() {
        this.units.forEach(u => {
            u.moved = false;
            u.attacked = false;
            u.advanced = false;
        });
    }

    checkWinningConditions() {
        const winner = this.getWinner();

        if (winner != null) {
            this.gameState.status = GameStatus.ENDED;
            this.gameState.setWinner(winner);
        }
    }

    getWinner() {
        for (const player of Object.values(PlayerType)) {
            if (!this.units.some(u => u.player == getAnotherPlayer(player))) {
                return player;
            }

            const flagHex = this.hexes.find(h => h.flag != null && h.player == getAnotherPlayer(player));
            if (flagHex && this.units.some(u => u.x === flagHex.x && u.y === flagHex.y && u.player === player)) {
                return player;
            }
        }

        return null;
    }

    removeDeadUnits() {
        const deadUnits = this.units.filter(u => u.isDead());
        deadUnits.forEach(u => this.removeUnit(u));
        return deadUnits;
    }

    startSpecialPhase(specialPhase) {
        if (this.gameState.status === GameStatus.ENDED) return;
        if (specialPhase === SpecialPhaseType.ADVANCE) {
            if (this.gameState.attackers.every(a => a.isDead())) {
                this.endSpecialPhase();
            }
        }
    }

    endSpecialPhase() {
        this.gameState.shiftSpecialPhaseQueue();
        this.startSpecialPhase(this.gameState.getCurrentSpecialPhase());
    }
}