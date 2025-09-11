import { TerrainType, ColorByPlayer } from './constants.js';
import { SvgService } from './svg-service.js';
import { getHexWidth, getHexHeight, getMargin } from './utils.js';

export class HexView {
    constructor(hex, hexRadius, lineWidth) {
        this.hex = hex;
        this.hexRadius = hexRadius;
        this.lineWidth = lineWidth;
        this.svg = this.draxHexSvg();
        this.setTerrain(hex.terrainType);
        this.setFlag(hex.flag, hex.player);
    }

    draxHexSvg() {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const margin = getMargin(this.lineWidth);
        const hexCenterX = (hexWidth * 0.5) + margin;
        const hexCenterY = (hexHeight * 0.5) + margin;

        const baseHex = this.createBaseHex(hexCenterX, hexCenterY, this.hexRadius);
        const innerHex = this.createInnerHex(hexCenterX, hexCenterY, this.hexRadius - 5);

        const hexSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const svgWidth = hexWidth + margin * 2;
        const svgHeight = hexHeight + margin * 2;
        hexSvg.setAttribute('width', svgWidth);
        hexSvg.setAttribute('height', svgHeight);
        hexSvg.appendChild(baseHex);
        hexSvg.appendChild(innerHex);

        return hexSvg;
    }

    createBaseHex(x, y, radius) {
        const baseHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        baseHex.setAttribute('class', 'hex baseHex');
        baseHex.setAttribute('points', this.calculateHexPoints(x, y, radius));
        baseHex.setAttribute('fill', '#ffffff');
        baseHex.setAttribute('stroke', 'black');
        baseHex.setAttribute('stroke-width', this.lineWidth);
        return baseHex;
    }

    createInnerHex(x, y, radius) {
        const innerHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        innerHex.setAttribute('class', 'hex innerHex');
        innerHex.setAttribute('points', this.calculateHexPoints(x, y, radius));
        innerHex.setAttribute('fill', 'none');
        innerHex.setAttribute('stroke', 'black');
        innerHex.setAttribute('stroke-width', this.lineWidth);
        innerHex.setAttribute('stroke-dasharray', '12 5');
        innerHex.setAttribute('display', 'none');
        return innerHex;
    }

    calculateHexPoints(x, y, radius) {
        const points = [];
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
            points.push((x + radius * Math.cos(angle)) + "," + (y + radius * Math.sin(angle)));
        }
        return points.join(" ");
    }

    getClosestSide(clickX, clickY) {
        const hexWidth = getHexWidth(this.hexRadius);
        const hexHeight = getHexHeight(this.hexRadius);
        const margin = getMargin(this.lineWidth);
        const hexCenterX = (hexWidth * 0.5) + margin;
        const hexCenterY = (hexHeight * 0.5) + margin;

        const vertices = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            vertices.push({
                x: hexCenterX + this.hexRadius * Math.cos(angle),
                y: hexCenterY + this.hexRadius * Math.sin(angle)
            });
        }

        let minDistanceSq = Infinity;
        let closestSideIndex = -1;

        for (let i = 0; i < 6; i++) {
            const p1 = vertices[i];
            const p2 = vertices[(i + 1) % 6];
            
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            
            const distSq = Math.pow(clickX - midX, 2) + Math.pow(clickY - midY, 2);
            
            if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                closestSideIndex = i;
            }
        }
        
        return closestSideIndex;
    }

    toggleInnerHex() {
        const innerHex = this.svg.querySelector('.innerHex');
        innerHex.setAttribute('display', this.hex.highlighted ? 'block' : 'none');
    }

    setTerrain(terrainType) {
        const existingTerrain = this.svg.querySelector('[data-terrain]');
        if (existingTerrain) {
            this.svg.removeChild(existingTerrain);
        }

        if (terrainType === TerrainType.MOUNTAIN || terrainType === TerrainType.FOREST || terrainType === TerrainType.SWAMP || terrainType === TerrainType.WATER || terrainType === TerrainType.CITY) {
            const svgService = new SvgService();
            const terrainSvgElement = svgService.svgElements[terrainType + '.svg'].cloneNode(true);
            terrainSvgElement.setAttribute('data-terrain', terrainType);

            const hexWidth = getHexWidth(this.hexRadius);
            const hexHeight = getHexHeight(this.hexRadius);
            const margin = getMargin(this.lineWidth);

            let x, y, width, height;

            switch (terrainType) {
                case TerrainType.MOUNTAIN:
                    x = (hexWidth / 2) - 37 + margin;
                    y = (hexHeight / 2) - 35 + margin;
                    break;
                case TerrainType.FOREST:
                case TerrainType.SWAMP:
                case TerrainType.WATER:
                case TerrainType.CITY:
                    x = (hexWidth / 2) - 40 + margin;
                    y = (hexHeight / 2) - 45 + margin;
                    width = 80;
                    height = 80;
                    break;
            }

            terrainSvgElement.setAttribute('x', x);
            terrainSvgElement.setAttribute('y', y);
            if (width && height) {
                terrainSvgElement.setAttribute('width', width);
                terrainSvgElement.setAttribute('height', height);
            }

            this.svg.appendChild(terrainSvgElement);
        }
    }

    setFlag(value, player) {
        const existingFlag = this.svg.querySelector('[data-flag]');
        if (existingFlag) {
            this.svg.removeChild(existingFlag);
        }

        if (value === undefined || value === null || player === undefined || player === null || value === false) {
			return;
        }

		const svgService = new SvgService();
		const flagSvgElement = svgService.svgElements['flag.svg'].cloneNode(true);
		flagSvgElement.setAttribute('data-flag', 'true');

		const flagColor = flagSvgElement.querySelector('.flagColor');
		flagColor.setAttribute('fill', ColorByPlayer[player]);

		const hexWidth = getHexWidth(this.hexRadius);
		const hexHeight = getHexHeight(this.hexRadius);
		const margin = getMargin(this.lineWidth);

		const x = (hexWidth / 2) - 37 + margin - 10;
		const y = (hexHeight / 2) - 35 + margin;

		flagSvgElement.setAttribute('x', x);
		flagSvgElement.setAttribute('y', y);

		this.svg.appendChild(flagSvgElement);
	}
}