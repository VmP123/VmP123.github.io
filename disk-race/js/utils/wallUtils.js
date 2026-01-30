export class WallUtils {
    static getWallEndpoints(piece, config) {
        const bounds = piece.getBounds();
        const wallThick = config.WALL_THICKNESS;
        const pts = {};

        const rotate = (x, y, a) => {
            const c = Math.cos(a), s = Math.sin(a);
            return {
                x: x * c - y * s,
                y: x * s + y * c
            };
        };

        if (piece.type === 'straight' || piece.type === 'start') {
            const w = bounds.width;
            const l = bounds.length;
            // Local Coords (centered)
            const lyLeft = -w / 2 - wallThick / 2;
            const lyRight = w / 2 + wallThick / 2;

            const pStartLeft = rotate(-l / 2, lyLeft, piece.angle);
            const pStartRight = rotate(-l / 2, lyRight, piece.angle);
            const pEndLeft = rotate(l / 2, lyLeft, piece.angle);
            const pEndRight = rotate(l / 2, lyRight, piece.angle);

            pts.startLeft = { x: piece.x + pStartLeft.x, y: piece.y + pStartLeft.y };
            pts.startRight = { x: piece.x + pStartRight.x, y: piece.y + pStartRight.y };
            pts.endLeft = { x: piece.x + pEndLeft.x, y: piece.y + pEndLeft.y };
            pts.endRight = { x: piece.x + pEndRight.x, y: piece.y + pEndRight.y };

        } else if (piece.type === 'curve') {
            const r = bounds.radius;
            const w = bounds.width;

            const rInner = r - w / 2 - wallThick / 2;
            const rOuter = r + w / 2 + wallThick / 2;

            // Start (Angle 0)
            // Left Wall = Inner, Right Wall = Outer
            // Local: (r, 0)
            const pStartLeft = rotate(rInner, 0, piece.angle);
            const pStartRight = rotate(rOuter, 0, piece.angle);

            // End (Angle 90 deg = PI/2)
            // Local: (0, r)
            const pEndLeft = rotate(0, rInner, piece.angle);
            const pEndRight = rotate(0, rOuter, piece.angle);

            pts.startLeft = { x: piece.x + pStartLeft.x, y: piece.y + pStartLeft.y };
            pts.startRight = { x: piece.x + pStartRight.x, y: piece.y + pStartRight.y };
            pts.endLeft = { x: piece.x + pEndLeft.x, y: piece.y + pEndLeft.y };
            pts.endRight = { x: piece.x + pEndRight.x, y: piece.y + pEndRight.y };
        }
        return pts;
    }

    static computeWallCaps(pieces, config) {
        const wallEndpoints = [];
        const wallCaps = []; // List of points {x, y, radius}

        // 1. Collect all endpoints
        pieces.forEach(piece => {
            const eps = this.getWallEndpoints(piece, config);
            if (piece.leftWall) {
                if (eps.startLeft) wallEndpoints.push({ point: eps.startLeft, piece, side: 'left', end: 'start' });
                if (eps.endLeft) wallEndpoints.push({ point: eps.endLeft, piece, side: 'left', end: 'end' });
            }
            if (piece.rightWall) {
                if (eps.startRight) wallEndpoints.push({ point: eps.startRight, piece, side: 'right', end: 'start' });
                if (eps.endRight) wallEndpoints.push({ point: eps.endRight, piece, side: 'right', end: 'end' });
            }
        });

        // 2. Identify connected endpoints (Map to track connection status)
        // Using a simple set of "connected indices" to avoid double counting
        const connectedIndices = new Set();

        for (let i = 0; i < wallEndpoints.length; i++) {
            if (connectedIndices.has(i)) continue;

            let isConnected = false;
            for (let j = 0; j < wallEndpoints.length; j++) {
                if (i === j) continue;
                const ep1 = wallEndpoints[i];
                const ep2 = wallEndpoints[j];

                // Allow self-intersection if track loops, but generally we care about diff pieces or diff ends
                if (ep1.piece === ep2.piece && ep1.side === ep2.side && ep1.end === ep2.end) continue;

                const dist = Math.hypot(ep1.point.x - ep2.point.x, ep1.point.y - ep2.point.y);
                if (dist < 5) {
                    isConnected = true;
                    connectedIndices.add(j);
                    break;
                }
            }

            if (isConnected) {
                connectedIndices.add(i);
            }
        }

        // 3. Create caps for unconnected endpoints
        for (let i = 0; i < wallEndpoints.length; i++) {
            if (!connectedIndices.has(i)) {
                wallCaps.push({
                    x: wallEndpoints[i].point.x,
                    y: wallEndpoints[i].point.y,
                    radius: config.WALL_THICKNESS / 2
                });
            }
        }

        return wallCaps;
    }
}
