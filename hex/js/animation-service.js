import { on } from './state.js';

export class AnimationService {
    constructor(gameState, hexGridView) {
        if (!AnimationService.instance) {
            this.gameState = gameState;
            this.hexGridView = hexGridView;
            on('unitMoving', (data) => this.handleUnitMove(data));
            AnimationService.instance = this;
        } else {
            // Update references on the existing singleton instance
            AnimationService.instance.gameState = gameState;
            AnimationService.instance.hexGridView = hexGridView;
        }
        return AnimationService.instance;
    }

    async handleUnitMove(data) {
        const { unit, path } = data;
        this.gameState.isAnimating = true;

        await this.animateUnit(unit, path);

        const finalHex = path[path.length - 1];
        const unitView = this.hexGridView.unitViews.find(uv => uv.unit === unit);
        unitView.updatePosition(finalHex.x, finalHex.y);

        if (this.gameState.getCurrentSpecialPhase() === 'ADVANCE') {
            unit.advanced = true;
        }

        this.gameState.isAnimating = false;
        this.hexGridView.refreshUnitDimmers();
    }

    animateUnit(unit, path) {
        return new Promise(resolve => {
            const speed = 6; // pixels per frame
            let pathIndex = 1;

            const step = () => {
                if (pathIndex >= path.length) {
                    resolve();
                    return;
                }

                const targetHex = path[pathIndex];
                const targetPosition = this.hexGridView.getUnitPosition(targetHex);
                
                const unitView = this.hexGridView.getViewForUnit(unit);
                const unitSvg = unitView.svg;
                const currentX = parseFloat(unitSvg.getAttribute('x'));
                const currentY = parseFloat(unitSvg.getAttribute('y'));

                const dx = targetPosition.x - currentX;
                const dy = targetPosition.y - currentY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < speed) {
                    unitSvg.setAttribute('x', targetPosition.x);
                    unitSvg.setAttribute('y', targetPosition.y);
                    pathIndex++;
                    requestAnimationFrame(step);
                    return;
                }

                const angle = Math.atan2(dy, dx);
                const newX = currentX + Math.cos(angle) * speed;
                const newY = currentY + Math.sin(angle) * speed;

                unitSvg.setAttribute('x', newX);
                unitSvg.setAttribute('y', newY);

                requestAnimationFrame(step);
            };

            requestAnimationFrame(step);
        });
    }
}