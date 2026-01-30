import { CONFIG } from '../config.js';

export class TrackPiece {
    constructor(type, x, y, angle, leftWall = false, rightWall = false) {
        this.type = type; // 'straight' or 'curve'
        this.x = x;
        this.y = y;
        this.angle = angle; // in radians
        this.leftWall = leftWall;
        this.rightWall = rightWall;
        this.width = CONFIG.TRACK_WIDTH;
    }

    // Get connection points (entrance and exit)
    getConnectionPoints() {
        const bounds = this.getBounds();
        if (this.type === 'straight' || this.type === 'start') {
            return {
                start: {
                    x: this.x - Math.cos(this.angle) * (bounds.length / 2),
                    y: this.y - Math.sin(this.angle) * (bounds.length / 2),
                    angle: this.angle
                },
                end: {
                    x: this.x + Math.cos(this.angle) * (bounds.length / 2),
                    y: this.y + Math.sin(this.angle) * (bounds.length / 2),
                    angle: this.angle
                }
            };
        } else {
            // Curve: arc center is at (this.x, this.y)
            // Renderer draws arc from angle 0 to PI/2 in local coordinates
            // Start point: angle 0 (pointing right in local coords)
            // End point: angle PI/2 (pointing up in local coords)

            const startAngleLocal = 0;
            const endAngleLocal = Math.PI / 2;

            // Transform to world coordinates
            const cos = Math.cos(this.angle);
            const sin = Math.sin(this.angle);

            // Start point in local coords (radius, 0)
            const startLocalX = bounds.radius;
            const startLocalY = 0;

            // End point in local coords (0, radius)
            const endLocalX = 0;
            const endLocalY = bounds.radius;

            return {
                start: {
                    x: this.x + (startLocalX * cos - startLocalY * sin),
                    y: this.y + (startLocalX * sin + startLocalY * cos),
                    angle: this.angle + startAngleLocal + Math.PI / 2
                },
                end: {
                    x: this.x + (endLocalX * cos - endLocalY * sin),
                    y: this.y + (endLocalX * sin + endLocalY * cos),
                    angle: this.angle + endAngleLocal + Math.PI / 2
                }
            };
        }
    }

    // Get where the next piece should start
    getExitInfo() {
        return this.getConnectionPoints().end;
    }

    // Get the boundaries of this track piece for rendering and collision
    getBounds() {
        const bounds = {
            type: this.type,
            x: this.x,
            y: this.y,
            angle: this.angle,
            width: this.width,
            leftWall: this.leftWall,
            rightWall: this.rightWall
        };

        if (this.type === 'straight' || this.type === 'start') {
            bounds.length = this.width * 2; // Straight pieces are 2x width long
        } else if (this.type === 'curve') {
            bounds.radius = this.width; // Curve radius equals track width
            bounds.arcAngle = Math.PI / 2; // 90 degrees
        }

        return bounds;
    }
}
