import { HexView } from './hex-view.js';
import { UnitView } from './unit-view.js';
import { SpecialPhaseType, UnitProperties } from './constants.js';
import { getHexWidth, getHexHeight, getMargin, getAdjacentHexes } from './utils.js';

export class HexGridView {
    constructor(hexGrid, hexRadius, lineWidth, gameState, isEditor = false, svgService, animationService = null) {
        this.hexGrid = hexGrid;
        this.hexViews = [];
        this.unitViews = [];
        this.svg = null;
        this.hexRadius = hexRadius;
        this.lineWidth = lineWidth;
        this.gameState = gameState;
        this.isEditor = isEditor;
        this.svgService = svgService;
        this.animationService = animationService;
    }

    async drawHexGrid() {
        const { hexGrid, hexLayer, riverLayer, unitLayer } = this._createLayers();
        this.svg = hexGrid;

        hexGrid.appendChild(hexLayer);
        hexGrid.appendChild(riverLayer);
        hexGrid.appendChild(unitLayer);

        for (const hex of this.hexGrid.hexes) {
            const hexView = new HexView(hex, this.hexRadius, this.lineWidth);
            const position = this._calculateHexPosition(hex.x, hex.y);
            hexView.svg.setAttribute('x', position.x);
            hexView.svg.setAttribute('y', position.y);
            this.hexViews.push(hexView);
            hexLayer.appendChild(hexView.svg);

            if (hex.unit) {
                const baseRect = this.svgService.svgElements[hex.unit.unitType + ".svg"].cloneNode(true);
                const newUnitView = new UnitView(hex.unit, this, this.gameState);
                newUnitView.createUnit(baseRect);
                newUnitView.setBackgroundColor();
                newUnitView.refreshStatusText();
                newUnitView.refreshStatusIndicator();
                this.addUnitView(newUnitView);
            }
        }

        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const totalWidth = (this.hexGrid.cols * hexWidth * 0.75) + (hexWidth * 0.25) + 5;
        const totalHeight = (this.hexGrid.rows * hexHeight) + (hexHeight * 0.5);

        this.redrawAllRivers();

        hexGrid.setAttribute('width', totalWidth);
        hexGrid.setAttribute('height', totalHeight);
    }

    _createLayers() {
        const hexGrid = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        hexGrid.setAttribute('id', 'hexGrid');
        const hexLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        hexLayer.setAttribute('id', 'hexLayer');
        const riverLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        riverLayer.setAttribute('id', 'riverLayer');
        const unitLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        unitLayer.setAttribute('id', 'unitLayer');
        return { hexGrid, hexLayer, riverLayer, unitLayer };
    }

    _calculateHexPosition(col, row) {
        const hexWidth = getHexWidth(this.hexRadius);
        const xOffset = hexWidth * 0.75;
        const x = col * xOffset;
        const hexHeight = getHexHeight(this.hexRadius);
        const yOffset = hexHeight * 0.5;
        const y = row * hexHeight + ((col % 2) * yOffset);
        return { x, y };
    }

    _drawRiver(x, y, edge) {
        function calculateHexEdgePoints(x, y, radius, startVertex) {
            const startAngle = (Math.PI / 3) * startVertex;
            const endAngle = (Math.PI / 3) * (startVertex + 1);
            return [ (x + radius * Math.cos(startAngle)), (y + radius * Math.sin(startAngle)), (x + radius * Math.cos(endAngle)), (y + radius * Math.sin(endAngle)) ];
        }

        const points = calculateHexEdgePoints(x, y, this.hexRadius, edge);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', points[0]);
        line.setAttribute('y1', points[1]);
        line.setAttribute('x2', points[2]);
        line.setAttribute('y2', points[3]);
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', '#80c0ff');
        line.setAttribute('stroke-width', 10);
        line.setAttribute('pointer-events', 'none');
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.appendChild(line);
        return line;
    }

    addUnitView(unitView) {
        this.unitViews.push(unitView);
        const unitLayer = this.svg.querySelector('#unitLayer');
        unitLayer.appendChild(unitView.svg);
    }
    
    removeUnit(unit) {
        const unitView = this.getViewForUnit(unit);
        if (unitView) {
            unitView.remove();
            const viewIndex = this.unitViews.indexOf(unitView);
            if (viewIndex > -1) {
                this.unitViews.splice(viewIndex, 1);
            }
        }
    }

    clearHighlightedHexes() {
        for(const highlightedHex of this.hexGrid.hexes.filter(hex => hex.highlighted)) {
            highlightedHex.toggleInnerHex(false);
            this.getViewForHex(highlightedHex).toggleInnerHex();
        }
    }

    highlightAdjacentEnemyHexes(selectedUnits) {
        this.clearHighlightedHexes();
        if (!selectedUnits || selectedUnits.length === 0) return;

        let adjacentEnemyHexes = [];
        selectedUnits.forEach((su, index) => {
            const hexes = getAdjacentHexes(su.x, su.y, this.hexGrid.rows, this.hexGrid.cols)
                .filter(ah => this.hexGrid.units.some(unit => unit.x === ah.x && unit.y === ah.y && unit.player != this.gameState.activePlayer))
                .map(ah => this.hexGrid.hexes.find(h => h.x === ah.x && h.y === ah.y));

            if (index === 0) {
                adjacentEnemyHexes.push(...hexes);
            } else {
                adjacentEnemyHexes = adjacentEnemyHexes.filter(value => hexes.includes(value));
            }
        });

        for(const adjacentHex of adjacentEnemyHexes) {
            for(const hex of this.hexGrid.hexes) {
                if (adjacentHex.x == hex.x && adjacentHex.y == hex.y) {
                    hex.toggleInnerHex(true);
                    this.getViewForHex(hex).toggleInnerHex();
                }
            }
        }
    }

    highlightReachableEmptyHexes(x, y, unitType) {
        const { reachableHexes } = this.hexGrid.getReachableHex(x, y, UnitProperties[unitType].movementAllowance); 
        for(const adjacentHex of reachableHexes) {
            for(const hex of this.hexGrid.hexes) {
                if (adjacentHex.x == hex.x && adjacentHex.y == hex.y) {
                    hex.toggleInnerHex();
                    this.getViewForHex(hex).toggleInnerHex();
                }
            }
        }
    }

    getUnitPosition(hex) {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const margin = getMargin(this.lineWidth);
        const xOffset = hexWidth * 0.75;
        const yOffset = hexHeight * 0.5;
        const x = hex.x * xOffset + (hexWidth / 2) - 30 + margin;
        const y = hex.y * hexHeight + ((hex.x % 2) * yOffset) + (hexHeight / 2) - 30 + margin;
        return { x, y };
    }

    getHexPosition(hex) {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const xOffset = hexWidth * 0.75;
        const yOffset = hexHeight * 0.5;
        const x = hex.x * xOffset;
        const y = hex.y * hexHeight + ((hex.x % 2) * yOffset);
        return { x, y };
    }

    getViewForUnit(unit) {
        return this.unitViews.find(uv => uv.unit === unit);
    }

    getViewForHex(hex) {
        return this.hexViews.find(hv => hv.hex === hex);
    }

    redrawAllRivers() {
        const riverLayer = this.svg.querySelector('#riverLayer');
        if (!riverLayer) return;
        riverLayer.innerHTML = '';
        const margin = getMargin(this.lineWidth);
        this.hexGrid.hexes.forEach(hex => {
            if (hex.riverEdges && hex.riverEdges.length > 0) {
                const { x, y } = this.getHexPosition(hex);
                const hexCenterX = getHexWidth(this.hexRadius) / 2 + x + margin;
                const hexCenterY = getHexHeight(this.hexRadius) / 2 + y + margin;
                hex.riverEdges.forEach(edgeIndex => {
                    const riverSvg = this._drawRiver(hexCenterX, hexCenterY, edgeIndex);
                    riverLayer.appendChild(riverSvg);
                });
            }
        });
    }

    refreshUnitDimmers() {
        this.unitViews.forEach(uv => uv.refreshDimmer());
    }

    refreshUnitSelectRects() {
        this.unitViews.forEach(uv => uv.refreshSelectRect());
    }
    
    removeDeadUnits() {
        [...this.hexGrid.units].filter(u => u.isDead()).forEach(u => this.removeUnit(u));
    }

    startSpecialPhase(specialPhase) {
        if (specialPhase === SpecialPhaseType.ADVANCE) {
            this.clearHighlightedHexes();
            this.gameState.vacatedHex.toggleInnerHex(true);
            this.getViewForHex(this.gameState.vacatedHex).toggleInnerHex();
            this.refreshUnitDimmers();
        }
    }

    endSpecialPhase(currentPhase) {
        if(currentPhase === SpecialPhaseType.ADVANCE) {
            this.clearHighlightedHexes();
        }
        this.refreshUnitDimmers();
    }
}