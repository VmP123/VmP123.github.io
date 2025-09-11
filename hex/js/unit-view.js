import { ColorByPlayer, TurnPhase, SpecialPhaseType, HealthStatus, UnitProperties } from './constants.js';
import { getHexWidth, getHexHeight, getMargin } from './utils.js';

export class UnitView {
    constructor(unit, hexGridView, gameState) {
        this.unit = unit; // Reference to the model
        this.hexGridView = hexGridView;
        this.gameState = gameState;
        this.svg = null; // The main SVG element for this view
    }

    createUnit(baseRect) {
        this.unit.baseRect = baseRect;
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

		const margin = getMargin(this.hexGridView.lineWidth);
		const hexWidth = getHexWidth(this.hexGridView.hexRadius);
		const hexHeight = getHexHeight(this.hexGridView.hexRadius);

		const dimmerRect = document.createElementNS('http://www.w3.org/2000/svg', "rect");
		dimmerRect.setAttribute("x", 3);
		dimmerRect.setAttribute("y", 3);
		dimmerRect.setAttribute("width", 54);
		dimmerRect.setAttribute("height", 54);
		dimmerRect.setAttribute("fill", "#ffffff");
		dimmerRect.setAttribute("opacity", "65%");
		dimmerRect.setAttribute("class", "dimmer");
		dimmerRect.setAttribute("rx", 6);
		dimmerRect.setAttribute('stroke-width', 2);
		dimmerRect.setAttribute('display', 'none');

		const selectRect = document.createElementNS('http://www.w3.org/2000/svg', "rect");	
		selectRect.setAttribute("alignment-baseline", "middle");
		selectRect.setAttribute("x", 2);
		selectRect.setAttribute("y", 2);
		selectRect.setAttribute("width", 56);
		selectRect.setAttribute("height", 56);
		selectRect.setAttribute("fill", "none");
		selectRect.setAttribute("rx", 6);
		selectRect.setAttribute('stroke-width', 6);
		selectRect.setAttribute('stroke', 'black');
		selectRect.setAttribute("class", "selectRect");
		selectRect.setAttribute('display', 'none');

		svg.appendChild(this.unit.baseRect);
		svg.appendChild(dimmerRect);
		svg.appendChild(selectRect);
		
		this.svg = svg;

		if (this.hexGridView.isEditor) {
			this.svg.style.pointerEvents = 'none';
		}

		this.updatePosition(this.unit.x, this.unit.y);
	}

    addClickHandler() {
        if (this.hexGridView.isEditor) {
            return;
        }
        const handleClick = () => {
            if (this.hexGridView.viewController && this.hexGridView.viewController.panned) {
                return;
            }
            window.game.gameEngine.handleUnitClick(this.unit);
        };
        this.svg.addEventListener('click', handleClick);
    }

    setBackgroundColor() {
		const color = ColorByPlayer[this.unit.player];
		const backgroundElement = this.unit.baseRect.querySelector('.background');

		backgroundElement.setAttribute('fill', color);
	}

    refreshSelectRect() {
		const selectRect = this.svg.querySelector('.selectRect');
		selectRect.setAttribute('display', this.unit.selected ? 'block' : 'none');
	}

	refreshDimmer() {
		var dimm = false;

		const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

		if (currentSpecialPhase === null) {
			dimm = 
				(this.gameState.currentTurnPhase === TurnPhase.ATTACK && this.unit.attacked) ||
				(this.gameState.currentTurnPhase === TurnPhase.MOVE && this.unit.moved);

		}
		else {
			dimm = (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE && !this.gameState.attackers.includes(this.unit)) ||
					 (currentSpecialPhase === SpecialPhaseType.ADVANCE && !this.gameState.attackers.includes(this.unit));
		}

		if (this.gameState.isAnimating) {
			dimm = false;
		}

		const dimmerRect = this.svg.querySelector('.dimmer');
		dimmerRect.setAttribute('display', dimm ? 'block' : 'none');
	}

	updatePosition(gridX, gridY) {
		this.unit.x = gridX;
		this.unit.y = gridY;

		const hexWidth = getHexWidth(this.hexGridView.hexRadius);
		const hexHeight = getHexHeight(this.hexGridView.hexRadius);
		const margin = getMargin(this.hexGridView.lineWidth);

		const xOffset = hexWidth * 0.75;
		const yOffset = hexHeight * 0.5;
		const x = this.unit.x * xOffset + (hexWidth / 2) - 30 + margin;
		const y = this.unit.y * hexHeight + ((this.unit.x % 2) * yOffset) + (hexHeight / 2) - 30 + margin;

		this.svg.setAttribute('x', x);
		this.svg.setAttribute('y', y);
	}

	refreshStatusIndicator() {
		const reducedRect = this.unit.baseRect.querySelector('.reduced');
		reducedRect.setAttribute('display', this.unit.healthStatus === HealthStatus.FULL ? 'none' : "block");
	}

	refreshStatusText() {
		const attack = this.unit.healthStatus === HealthStatus.FULL 
			? UnitProperties[this.unit.unitType].attackStrength
			: UnitProperties[this.unit.unitType].reducedAttackStrength

		const defend = this.unit.healthStatus === HealthStatus.FULL 
			? UnitProperties[this.unit.unitType].defendStrength
			: UnitProperties[this.unit.unitType].reducedDefendStrength

		this.unit.baseRect.querySelector('.health').textContent = 
			attack + "-" +
			defend + "-" +
			UnitProperties[this.unit.unitType].movementAllowance;
	}

	remove() {
		const unitLayer = this.hexGridView.svg.querySelector('#unitLayer');
		unitLayer.removeChild(this.svg);
	}
}