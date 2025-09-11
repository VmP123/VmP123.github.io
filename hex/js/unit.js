import { 
	HealthStatus,
	UnitProperties
} from './constants.js';

export class Unit {
	constructor(x, y, unitType, player) {
		this.x = x;
		this.y = y;
		this.unitType = unitType;
		this.player = player;

		this.selected = false;
		this.moved = false;
		this.attacked = false;
		this.advanced = false;
		this.healthStatus = HealthStatus.FULL;
	}

	isDead() {
		return this.healthStatus === HealthStatus.DEAD;
	}

	isValidMove(gridX, gridY, hexGrid) {
        const { reachableHexes } = hexGrid.getReachableHex(this.x, this.y, UnitProperties[this.unitType].movementAllowance);
        return reachableHexes.some(h => h.x === gridX && h.y === gridY);
	}
}