import { on } from './state.js';
import { TurnPhase, SpecialPhaseType } from './constants.js';

export class ViewController {
    constructor(svg, mapWidth, mapHeight, gameState) {
        this.gameState = gameState;
        this.svg = svg;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.hexGridView = null; // Will be set by game.js

        this.isPanning = false;
        this.panStarted = false;
        this.panned = false;
        this.panThreshold = 5;
        this.startX = 0;
        this.startY = 0;
        this.startViewBox = null;

        this.isZoomedOut = false;
        this.lastZoomInViewBox = null;
        this.margin = 100;

        this.svg.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.svg.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.svg.addEventListener('dblclick', this.onDoubleClick.bind(this));
        window.addEventListener('mouseup', this.endPan.bind(this));
        this.svg.addEventListener('mouseleave', this.endPan.bind(this));

        on('selectionChanged', (data) => this.updateSelectionView(data.selectedUnits));
        on('combatResolved', (data) => this.handleCombatVisuals(data));
        on('unitUpdated', (data) => this.handleUnitUpdated(data.unit));
        on('unitRemoved', (data) => this.handleUnitRemoved(data.unit));
        on('phaseChanged', () => this.handlePhaseChanged());
        on('currentSpecialPhaseUpdated', () => this.handleSpecialPhaseUpdate());
    }

    onMouseDown(e) {
        if (e.button !== 0) return; // Only left click
        const viewBoxString = this.svg.getAttribute('viewBox');
        if (!viewBoxString) return;
        
        const viewBox = viewBoxString.split(' ').map(parseFloat);
        if (viewBox.length < 4) return;
        
        this.isPanning = true;
        this.panStarted = false;
        this.panned = false;
        this.startViewBox = viewBox;
        this.startX = e.clientX;
        this.startY = e.clientY;
    }

    onMouseMove(e) {
        if (!this.isPanning || !this.startViewBox) return;

        const dx_pixels = e.clientX - this.startX;
        const dy_pixels = e.clientY - this.startY;

        if (!this.panStarted) {
            if (Math.abs(dx_pixels) > this.panThreshold || Math.abs(dy_pixels) > this.panThreshold) {
                this.panStarted = true;
                this.panned = true;
                this.svg.style.cursor = 'grabbing';
            } else {
                return; // not enough movement yet
            }
        }
        
        const rect = this.svg.getBoundingClientRect();
        const scaleX = this.startViewBox[2] / rect.width;
        const scaleY = this.startViewBox[3] / rect.height;
        
        const dx = dx_pixels * scaleX;
        const dy = dy_pixels * scaleY;
        
        const newX = this.startViewBox[0] - dx;
        const newY = this.startViewBox[1] - dy;

        this.setViewBox(newX, newY, this.startViewBox[2], this.startViewBox[3]);
    }

    endPan() {
        this.isPanning = false;
        this.panStarted = false;
        this.svg.style.cursor = 'pointer';
    }

    onDoubleClick(e) {
        this.zoom(e.clientX, e.clientY);
    }

    zoom(clientX = null, clientY = null) {
        const oldViewBoxString = this.svg.getAttribute('viewBox');
        const oldViewBox = oldViewBoxString.split(' ').map(parseFloat);
        if (oldViewBox.length < 4) return;
        
        const [oldX, oldY, oldWidth, oldHeight] = oldViewBox;
        
        let newWidth, newHeight;
        let newX, newY;
        
        if (!this.isZoomedOut) { // If currently zoomed in (isZoomedOut is false), zoom out
          this.isZoomedOut = true;
          this.lastZoomInViewBox = oldViewBox; // Save current viewBox before zooming out
          newWidth = this.mapWidth + this.margin * 2;
          newHeight = this.mapHeight + this.margin * 2;
          newX = oldX + oldWidth / 2 - newWidth / 2; // Center on current view
          newY = oldY + oldHeight / 2 - newHeight / 2; // Center on current view
        } else { // If currently zoomed out (isZoomedOut is true), zoom in
          this.isZoomedOut = false;
          newWidth = 1024; // Default zoom-in width
          newHeight = 880; // Default zoom-in height
          
          if (clientX !== null && clientY !== null) { // Double-click zoom to point
            const rect = this.svg.getBoundingClientRect();
            const scaleX = oldWidth / rect.width;
            const scaleY = oldHeight / rect.height;
            
            const svgX = oldX + (clientX - rect.left) * scaleX;
            const svgY = oldY + (clientY - rect.top) * scaleY;
            
            newX = svgX - newWidth / 2;
            newY = svgY - newHeight / 2;
          } else if (this.lastZoomInViewBox) { // Button zoom to last saved location
            [newX, newY, newWidth, newHeight] = this.lastZoomInViewBox;
          } else { // Default zoom-in, center on current view
            newX = oldX + oldWidth / 2 - newWidth / 2;
            newY = oldY + oldHeight / 2 - newHeight / 2;
          }
        }
        
        this.setViewBox(newX, newY, newWidth, newHeight);
    }

    setViewBox(x, y, width, height) {
        let newX = x;
        let newY = y;

        // If the view is wider than the map, center it horizontally.
        if (width >= this.mapWidth) {
            newX = (this.mapWidth / 2) - (width / 2);
        } else {
            // Otherwise, clamp the panning normally.
            const minX = -this.margin;
            const maxX = this.mapWidth - width + this.margin;
            newX = this.clamp(newX, minX, maxX);
        }

        // Same for vertical panning.
        if (height >= this.mapHeight) {
            newY = (this.mapHeight / 2) - (height / 2);
        } else {
            const minY = -this.margin;
            const maxY = this.mapHeight - height + this.margin;
            newY = this.clamp(newY, minY, maxY);
        }
        
        this.svg.setAttribute('viewBox', `${newX} ${newY} ${width} ${height}`);
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(value, max));
    }
    
    updateMapDimensions(width, height) {
        this.mapWidth = width;
        this.mapHeight = height;
    }

    updateSelectionView(selectedUnits) {
        if (this.hexGridView) {
            this.hexGridView.hexGrid.units.forEach(u => u.selected = selectedUnits.includes(u));
            this.hexGridView.refreshUnitSelectRects();
            this.hexGridView.clearHighlightedHexes();

            const specialPhase = this.gameState.getCurrentSpecialPhase();

            if (specialPhase === SpecialPhaseType.ADVANCE) {
                if (this.gameState.vacatedHex) {
                    const hexView = this.hexGridView.getViewForHex(this.gameState.vacatedHex);
                    this.gameState.vacatedHex.toggleInnerHex(true);
                    hexView.toggleInnerHex();
                }
                return;
            }

            if (selectedUnits.length > 0) {
                if (this.gameState.currentTurnPhase === TurnPhase.MOVE) {
                    const selectedUnit = selectedUnits[0];
                    this.hexGridView.highlightReachableEmptyHexes(selectedUnit.x, selectedUnit.y, selectedUnit.unitType);
                } else if (this.gameState.currentTurnPhase === TurnPhase.ATTACK) {
                    this.hexGridView.highlightAdjacentEnemyHexes(selectedUnits);
                }
            }
        }
    }

    handleCombatVisuals(data) {
        const { attackers, defender } = data;

        attackers.forEach(attacker => {
            this.handleUnitUpdated(attacker);
        });
        this.handleUnitUpdated(defender);

        this.hexGridView.clearHighlightedHexes();
        this.hexGridView.refreshUnitSelectRects();
        this.hexGridView.refreshUnitDimmers();
    }

    handleUnitUpdated(unit) {
        const unitView = this.hexGridView.getViewForUnit(unit);
        if (unitView) {
            unitView.refreshStatusIndicator();
            unitView.refreshStatusText();
        }
    }

    handleUnitRemoved(unit) {
        this.hexGridView.removeUnit(unit);
    }

    handlePhaseChanged() {
        this.hexGridView.clearHighlightedHexes();
        this.hexGridView.refreshUnitDimmers();
    }

    handleSpecialPhaseUpdate() {
        const specialPhase = this.gameState.getCurrentSpecialPhase();
        this.hexGridView.clearHighlightedHexes();
        this.hexGridView.refreshUnitDimmers();
        if (specialPhase === SpecialPhaseType.ADVANCE) {
            if (this.gameState.vacatedHex) {
                const hexView = this.hexGridView.getViewForHex(this.gameState.vacatedHex);
                this.gameState.vacatedHex.toggleInnerHex(true);
                if (hexView) {
                    hexView.toggleInnerHex();
                }
            }
        }
    }
}