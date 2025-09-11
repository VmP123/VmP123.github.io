import { TerrainType } from './Constants.js';

export class Hex {
	constructor(x, y, hexGrid, isEditor = false) {
		this.x = x;
		this.y = y;
		this.hexGrid = hexGrid;
		this.highlighted = false;
		this.terrainType = null;
		this.isEmpty = true;
		this.riverEdges = [];
		this.flag = null;
		this.isEditor = isEditor;
        this.unit = null;
	}

	toggleInnerHex(value) {
		if (value === undefined || value === null) {
			this.highlighted = !this.highlighted;
		}
		else {
			this.highlighted = value;
		}
	}

	setTerrain(terrainType) {
		this.terrainType = terrainType;
		this.isEmpty = true;

		if (terrainType === TerrainType.MOUNTAIN || terrainType === TerrainType.FOREST || terrainType === TerrainType.SWAMP || terrainType === TerrainType.WATER || terrainType === TerrainType.CITY) {
			this.isEmpty = false;
		}
	}

    setFlag(value, player) {
		if (value === undefined || value === null || player === undefined || player === null || value === false) {
            this.flag = null;
            this.player = null;
			return;
        }

		this.isEmpty = true;
		this.flag = value;
		this.player = player;
	}

	setRiverEdges(riverEdges) {
		this.riverEdges = riverEdges;
	}

	setUnit(unit) {
		this.unit = unit;
		this.isEmpty = false;
	}

	removeUnit() {
		this.unit = null;
		this.isEmpty = true;
	}

	toggleRiver(edgeIndex) {
	    const offsetsOddRow = [
	        [1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]
	    ];

	    const offsetsEvenRow = [
	        [1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]
	    ];

	    const offsets = this.x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;

		const [dx, dy] = offsets[edgeIndex];
		const adjacentX = this.x + dx;
		const adjacentY = this.y + dy;

		const isWithinGridBounds = (x, y) =>
			x >= 0 &&
			x < this.hexGrid.cols &&
			y >= 0 &&
			y < this.hexGrid.rows &&
			!((y === this.hexGrid.rows - 1) && (x % 2 === 1));

		if (!isWithinGridBounds(adjacentX, adjacentY)) {
			return;
		}

		const adjacentHex = this.hexGrid.getHex(adjacentX, adjacentY);
		if (!adjacentHex) {
			return;
		}

		const oppositeEdgeMap = { 0: 3, 1: 4, 2: 5, 3: 0, 4: 1, 5: 2 };
		const oppositeEdge = oppositeEdgeMap[edgeIndex];

		const thisHexShouldStore = this.x < adjacentHex.x || (this.x === adjacentHex.x && this.y < adjacentHex.y);

		if (thisHexShouldStore) {
			const index = this.riverEdges.indexOf(edgeIndex);
			if (index > -1) {
				this.riverEdges.splice(index, 1);
			} else {
				this.riverEdges.push(edgeIndex);
				const otherIndex = adjacentHex.riverEdges.indexOf(oppositeEdge);
				if (otherIndex > -1) {
					adjacentHex.riverEdges.splice(otherIndex, 1);
				}
			}
		} else {
			const index = adjacentHex.riverEdges.indexOf(oppositeEdge);
			if (index > -1) {
				adjacentHex.riverEdges.splice(index, 1);
			} else {
				adjacentHex.riverEdges.push(oppositeEdge);
				const thisIndex = this.riverEdges.indexOf(edgeIndex);
				if (thisIndex > -1) {
					this.riverEdges.splice(thisIndex, 1);
				}
			}
		}
	}
}