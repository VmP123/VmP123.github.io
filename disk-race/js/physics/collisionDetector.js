import { Vector } from '../utils/vector.js';
import { CONFIG } from '../config.js';

export class CollisionDetector {
    // Check if disk is on the track
    static isOnTrack(disk, track) {
        return this.getPieceIndex(disk, track) !== -1;
    }

    // Get the index of the track piece the disk is in
    static getPieceIndex(disk, track) {
        for (let i = 0; i < track.pieces.length; i++) {
            if (this.isDiskInPiece(disk, track.pieces[i])) {
                return i;
            }
        }
        return -1;
    }

    // Check if disk is in a specific track piece
    static isDiskInPiece(disk, piece) {
        const bounds = piece.getBounds();

        // Transform disk position to piece's local coordinates
        const dx = disk.position.x - bounds.x;
        const dy = disk.position.y - bounds.y;
        const cos = Math.cos(-bounds.angle);
        const sin = Math.sin(-bounds.angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        if (bounds.type === 'straight' || bounds.type === 'start') {
            // Center-based check for being on track (user request)
            return Math.abs(localX) <= bounds.length / 2 &&
                Math.abs(localY) <= bounds.width / 2;
        } else if (bounds.type === 'curve') {
            const distance = Math.sqrt(localX * localX + localY * localY);
            let angle = Math.atan2(localY, localX);
            // Normalize angle to [0, 2pi]
            if (angle < 0) angle += Math.PI * 2;

            const innerBoundary = bounds.radius - bounds.width / 2;
            const outerBoundary = bounds.radius + bounds.width / 2;

            // Center-based check for being on track
            return angle >= 0 && angle <= bounds.arcAngle &&
                distance >= innerBoundary &&
                distance <= outerBoundary;
        }

        return false;
    }

    // Check and handle wall collisions
    // Check and handle wall collisions
    // Check and handle wall collisions
    static checkWallCollision(disk, track) {
        // 1. Check main wall segments
        for (const piece of track.pieces) {
            const collision = this.checkPieceWallCollision(disk, piece);
            if (collision) {
                return collision;
            }
        }

        // 2. Check wall caps (rounded ends)
        if (track.wallCaps) {
            for (const cap of track.wallCaps) {
                const dist = Math.hypot(disk.position.x - cap.x, disk.position.y - cap.y);
                if (dist < disk.radius + cap.radius) {
                    // Collision with cap
                    const nx = disk.position.x - cap.x;
                    const ny = disk.position.y - cap.y;
                    const len = Math.sqrt(nx * nx + ny * ny);
                    if (len > 0) {
                        return new Vector(nx / len, ny / len);
                    }
                }
            }
        }

        return null;
    }


    static checkPieceWallCollision(disk, piece) {
        const bounds = piece.getBounds();

        // Transform disk position to piece's local coordinates
        const dx = disk.position.x - bounds.x;
        const dy = disk.position.y - bounds.y;
        const cos = Math.cos(-bounds.angle);
        const sin = Math.sin(-bounds.angle);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        let normal = null;

        if (bounds.type === 'straight' || bounds.type === 'start') {
            // Check if within the length of the straight
            if (Math.abs(localX) <= bounds.length / 2) {
                const halfWidth = bounds.width / 2;

                // Left wall (negative Y in local coordinates)
                if (bounds.leftWall) {
                    if (localY - disk.radius <= -halfWidth && localY >= -halfWidth - CONFIG.WALL_THICKNESS) {
                        normal = new Vector(0, 1);
                    }
                }

                // Right wall (positive Y in local coordinates)
                if (bounds.rightWall) {
                    if (localY + disk.radius >= halfWidth && localY <= halfWidth + CONFIG.WALL_THICKNESS) {
                        normal = new Vector(0, -1);
                    }
                }
            }
        } else if (bounds.type === 'curve') {
            const distance = Math.sqrt(localX * localX + localY * localY);
            let angle = Math.atan2(localY, localX);
            if (angle < 0) angle += Math.PI * 2;

            if (angle >= 0 && angle <= bounds.arcAngle) {
                const innerRadius = bounds.radius - bounds.width / 2;
                const outerRadius = bounds.radius + bounds.width / 2;

                // Inner wall check (edge hits wall)
                if (bounds.leftWall && (distance - disk.radius <= innerRadius) && (distance >= innerRadius - CONFIG.WALL_THICKNESS)) {
                    normal = new Vector(localX / distance, localY / distance);
                }

                // Outer wall check (edge hits wall)
                if (bounds.rightWall && (distance + disk.radius >= outerRadius) && (distance <= outerRadius + CONFIG.WALL_THICKNESS)) {
                    normal = new Vector(-localX / distance, -localY / distance);
                }
            }
        }

        if (normal) {
            // Transform normal back to world coordinates
            const worldNormal = new Vector(
                normal.x * cos + normal.y * sin,
                -normal.x * sin + normal.y * cos
            );
            return worldNormal;
        }

        return null;
    }

    // Check if disk crossed the start line
    static checkStartLineCrossing(disk, prevPosition, startLine) {
        // Create a line segment from previous position to current position
        const dx = disk.position.x - prevPosition.x;
        const dy = disk.position.y - prevPosition.y;

        // Start line is perpendicular to its angle
        const lineNormal = new Vector(Math.cos(startLine.angle), Math.sin(startLine.angle));

        // Vector from start line to previous position
        const toPrev = new Vector(prevPosition.x - startLine.x, prevPosition.y - startLine.y);
        const toCurr = new Vector(disk.position.x - startLine.x, disk.position.y - startLine.y);

        // Check if we crossed the line (dot product changes sign)
        const prevDot = lineNormal.x * toPrev.x + lineNormal.y * toPrev.y;
        const currDot = lineNormal.x * toCurr.x + lineNormal.y * toCurr.y;

        // Crossed if signs are different and we're close enough to the line
        if (prevDot * currDot < 0) {
            // Check if we're within the track width
            const perpDist = Math.abs(lineNormal.x * toCurr.y - lineNormal.y * toCurr.x);
            if (perpDist < CONFIG.TRACK_WIDTH / 2) {
                // Return direction: 1 for forward, -1 for backward
                return currDot > 0 ? 1 : -1;
            }
        }

        return 0;
    }
}
