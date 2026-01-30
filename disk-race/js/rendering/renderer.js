import { CONFIG } from '../config.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        // Only set default size if not already set or if explicitly specified in CONFIG
        if (this.canvas.width === 300 || this.canvas.width === 150 || this.canvas.width === 0) { // Default browser values
            this.canvas.width = CONFIG.CANVAS_WIDTH;
            this.canvas.height = CONFIG.CANVAS_HEIGHT;
        }
    }

    clear(color = '#ffffff') {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw straight piece with selective corner rounding
    drawStraightWithConnections(bounds, connections) {
        const x = -bounds.length / 2;
        const y = -bounds.width / 2;
        const w = bounds.length;
        const h = bounds.width;
        const r = CONFIG.CORNER_RADIUS;
        const bw = CONFIG.BORDER_WIDTH;

        // Determine which corners to round
        const roundLeft = false;
        const roundRight = false;

        // Draw border layer
        this.ctx.fillStyle = CONFIG.COLORS.TRACK_BORDER;
        this.drawRectWithSelectiveRounding(
            x,
            y - bw,
            w,
            h + 2 * bw,
            roundLeft ? r + bw : 0,
            roundRight ? r + bw : 0
        );

        // Draw main fill on top
        this.ctx.fillStyle = CONFIG.COLORS.TRACK;
        this.drawRectWithSelectiveRounding(x, y, w, h, roundLeft ? r : 0, roundRight ? r : 0);
    }

    // Draw rectangle with selective corner rounding (left and right sides)
    drawRectWithSelectiveRounding(x, y, w, h, radiusLeft, radiusRight) {
        this.ctx.beginPath();

        // Top-left corner
        if (radiusLeft > 0) {
            this.ctx.moveTo(x + radiusLeft, y);
        } else {
            this.ctx.moveTo(x, y);
        }

        // Top edge and top-right corner
        if (radiusRight > 0) {
            this.ctx.lineTo(x + w - radiusRight, y);
            this.ctx.arcTo(x + w, y, x + w, y + radiusRight, radiusRight);
        } else {
            this.ctx.lineTo(x + w, y);
        }

        // Right edge and bottom-right corner
        if (radiusRight > 0) {
            this.ctx.lineTo(x + w, y + h - radiusRight);
            this.ctx.arcTo(x + w, y + h, x + w - radiusRight, y + h, radiusRight);
        } else {
            this.ctx.lineTo(x + w, y + h);
        }

        // Bottom edge and bottom-left corner
        if (radiusLeft > 0) {
            this.ctx.lineTo(x + radiusLeft, y + h);
            this.ctx.arcTo(x, y + h, x, y + h - radiusLeft, radiusLeft);
        } else {
            this.ctx.lineTo(x, y + h);
        }

        // Left edge and back to start
        if (radiusLeft > 0) {
            this.ctx.lineTo(x, y + radiusLeft);
            this.ctx.arcTo(x, y, x + radiusLeft, y, radiusLeft);
        } else {
            this.ctx.lineTo(x, y);
        }

        this.ctx.closePath();
        this.ctx.fill();
    }

    // Draw a rounded rectangle with thick border
    drawRoundedRect(x, y, width, height, radius, fillColor, borderColor) {
        this.ctx.save();

        // Draw border (expand only height/thickness, not length/width, to avoid gaps/lines at ends)
        this.ctx.fillStyle = borderColor;
        this.ctx.beginPath();
        // Use 0 radius for border if input radius is 0, to keep sharp corners sharp
        const borderRadius = radius > 0 ? radius + CONFIG.BORDER_WIDTH / 2 : 0;

        this.ctx.roundRect(
            x,
            y - CONFIG.BORDER_WIDTH / 2,
            width,
            height + CONFIG.BORDER_WIDTH,
            borderRadius
        );
        this.ctx.fill();

        // Draw fill
        this.ctx.fillStyle = fillColor;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, radius);
        this.ctx.fill();

        this.ctx.restore();
    }

    // Draw track pieces
    drawTrack(track) {
        // First pass: detect connections for each piece
        const connections = new Map();
        const wallEndpoints = [];

        track.pieces.forEach((piece, index) => {
            const conn = { start: false, end: false };
            const pieceConn = piece.getConnectionPoints();

            // Collect wall endpoints for connection checking
            const eps = this.getWallEndpoints(piece);
            if (piece.leftWall) {
                if (eps.startLeft) wallEndpoints.push({ point: eps.startLeft, piece, side: 'left', end: 'start' });
                if (eps.endLeft) wallEndpoints.push({ point: eps.endLeft, piece, side: 'left', end: 'end' });
            }
            if (piece.rightWall) {
                if (eps.startRight) wallEndpoints.push({ point: eps.startRight, piece, side: 'right', end: 'start' });
                if (eps.endRight) wallEndpoints.push({ point: eps.endRight, piece, side: 'right', end: 'end' });
            }

            // Check against all other pieces for generic track connection
            track.pieces.forEach((other, otherIndex) => {
                if (index === otherIndex) return;

                const otherConn = other.getConnectionPoints();
                const distToOtherStart = Math.hypot(pieceConn.start.x - otherConn.start.x, pieceConn.start.y - otherConn.start.y);
                const distToOtherEnd = Math.hypot(pieceConn.start.x - otherConn.end.x, pieceConn.start.y - otherConn.end.y);
                if (distToOtherStart < 5 || distToOtherEnd < 5) conn.start = true;

                const distEndToOtherStart = Math.hypot(pieceConn.end.x - otherConn.start.x, pieceConn.end.y - otherConn.start.y);
                const distEndToOtherEnd = Math.hypot(pieceConn.end.x - otherConn.end.x, pieceConn.end.y - otherConn.end.y);
                if (distEndToOtherStart < 5 || distEndToOtherEnd < 5) conn.end = true;
            });

            connections.set(piece, conn);
        });

        // Compute wall connections
        const wallConnections = new Map();
        track.pieces.forEach(p => {
            wallConnections.set(p, {
                startLeft: false, startRight: false,
                endLeft: false, endRight: false
            });
        });

        // N^2 checking for wall endpoints (N is small ~50-100 max typically)
        for (let i = 0; i < wallEndpoints.length; i++) {
            for (let j = i + 1; j < wallEndpoints.length; j++) {
                const ep1 = wallEndpoints[i];
                const ep2 = wallEndpoints[j];
                if (ep1.piece === ep2.piece) continue;

                const dist = Math.hypot(ep1.point.x - ep2.point.x, ep1.point.y - ep2.point.y);
                if (dist < 5) {
                    const flags1 = wallConnections.get(ep1.piece);
                    const flags2 = wallConnections.get(ep2.piece);
                    const cap1 = ep1.side.charAt(0).toUpperCase() + ep1.side.slice(1);
                    const cap2 = ep2.side.charAt(0).toUpperCase() + ep2.side.slice(1);
                    flags1[ep1.end + cap1] = true;
                    flags2[ep2.end + cap2] = true;
                }
            }
        }

        // Render Internal Pass 1: Surfaces
        for (const piece of track.pieces) {
            this.drawTrackPieceSurface(piece, connections.get(piece));
        }

        // Draw start/finish line only if there's no 'start' piece
        const hasStartPiece = track.pieces.some(p => p.type === 'start');
        if (!hasStartPiece && track.startLine) {
            this.drawStartLine(track.startLine);
        }

        // Render Internal Pass 2: Walls
        for (const piece of track.pieces) {
            this.drawTrackPieceWalls(piece, wallConnections.get(piece));
        }
    }

    getWallEndpoints(piece) {
        const bounds = piece.getBounds();
        const wallThick = CONFIG.WALL_THICKNESS;
        const pts = {};

        const rotate = (x, y, a) => {
            const c = Math.cos(a), s = Math.sin(a);
            return { x: x * c - y * s, y: x * s + y * c };
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

    // Used for library rendering or single piece rendering
    drawTrackPiece(piece, connections = null, wallConnections = null) {
        this.drawTrackPieceSurface(piece, connections);
        this.drawTrackPieceWalls(piece, wallConnections);
    }

    drawTrackPieceSurface(piece, connections = null) {
        const bounds = piece.getBounds();
        this.ctx.save();
        this.ctx.translate(bounds.x, bounds.y);
        this.ctx.rotate(bounds.angle);

        if (bounds.type === 'straight' || bounds.type === 'start') {
            const conn = connections || { start: false, end: false };
            this.drawStraightSurface(bounds, conn);
            if (bounds.type === 'start') {
                this.drawStartLine({ x: 0, y: 0, angle: 0 });
            }
        } else if (bounds.type === 'curve') {
            this.drawCurvedSurface(bounds);
        }
        this.ctx.restore();
    }

    drawTrackPieceWalls(piece, wallConnections = null) {
        const bounds = piece.getBounds();
        const wc = wallConnections || { startLeft: false, endLeft: false, startRight: false, endRight: false };

        this.ctx.save();
        this.ctx.translate(bounds.x, bounds.y);
        this.ctx.rotate(bounds.angle);

        if (bounds.type === 'straight' || bounds.type === 'start') {
            this.drawStraightWalls(bounds, wc);
        } else if (bounds.type === 'curve') {
            this.drawCurvedWalls(bounds, wc);
        }
        this.ctx.restore();
    }

    drawWallCap(x, y) {
        const radius = CONFIG.WALL_THICKNESS / 2;
        const borderR = radius + CONFIG.BORDER_WIDTH / 2;
        this.ctx.fillStyle = CONFIG.COLORS.WALL_BORDER;
        this.ctx.beginPath();
        this.ctx.arc(x, y, borderR, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = CONFIG.COLORS.WALL;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawCapBorder(x, y) {
        const radius = CONFIG.WALL_THICKNESS / 2;
        const borderR = radius + CONFIG.BORDER_WIDTH / 2;
        this.ctx.fillStyle = CONFIG.COLORS.WALL_BORDER;
        this.ctx.beginPath();
        this.ctx.arc(x, y, borderR, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawCapFill(x, y) {
        const radius = CONFIG.WALL_THICKNESS / 2;
        this.ctx.fillStyle = CONFIG.COLORS.WALL;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawStraightSurface(bounds, connections) {
        const x = -bounds.length / 2;
        const y = -bounds.width / 2;
        const w = bounds.length;
        const h = bounds.width;
        const r = CONFIG.CORNER_RADIUS;
        const bw = CONFIG.BORDER_WIDTH;
        // Determine which corners to round
        const roundLeft = false; // connections.start ? false : true; // Example logic
        const roundRight = false; // connections.end ? false : true; // Example logic

        // Draw border layer
        this.ctx.fillStyle = CONFIG.COLORS.TRACK_BORDER;
        this.drawRectWithSelectiveRounding(x, y - bw, w, h + 2 * bw, roundLeft ? r + bw : 0, roundRight ? r + bw : 0);

        // Draw main fill on top
        this.ctx.fillStyle = CONFIG.COLORS.TRACK;
        this.drawRectWithSelectiveRounding(x, y, w, h, roundLeft ? r : 0, roundRight ? r : 0);
    }

    drawStraightWalls(bounds, wc) {
        const wallThick = CONFIG.WALL_THICKNESS;
        const wallBorderHalf = CONFIG.BORDER_WIDTH / 2;

        // Draw walls
        if (bounds.leftWall) {
            // Top Side (-y)
            const wy = -bounds.width / 2 - wallThick;
            // Border
            // Draw Caps Border First (to be under fill if needed, but here same layer)
            if (!wc.startLeft) this.drawCapBorder(-bounds.length / 2, wy + wallThick / 2);
            if (!wc.endLeft) this.drawCapBorder(bounds.length / 2, wy + wallThick / 2);

            // Main Border
            this.ctx.fillStyle = CONFIG.COLORS.WALL_BORDER;
            this.ctx.beginPath();
            this.ctx.rect(-bounds.length / 2, wy - wallBorderHalf, bounds.length, wallThick + CONFIG.BORDER_WIDTH);
            this.ctx.fill();

            // Draw Caps Fill
            if (!wc.startLeft) this.drawCapFill(-bounds.length / 2, wy + wallThick / 2);
            if (!wc.endLeft) this.drawCapFill(bounds.length / 2, wy + wallThick / 2);

            // Main Fill
            this.ctx.fillStyle = CONFIG.COLORS.WALL;
            this.ctx.beginPath();
            this.ctx.rect(-bounds.length / 2, wy, bounds.length, wallThick);
            this.ctx.fill();
        }

        if (bounds.rightWall) {
            // Bottom Side (+y)
            const wy = bounds.width / 2;

            // Caps Border
            if (!wc.startRight) this.drawCapBorder(-bounds.length / 2, wy + wallThick / 2);
            if (!wc.endRight) this.drawCapBorder(bounds.length / 2, wy + wallThick / 2);

            // Main Border
            this.ctx.fillStyle = CONFIG.COLORS.WALL_BORDER;
            this.ctx.beginPath();
            this.ctx.rect(-bounds.length / 2, wy - wallBorderHalf, bounds.length, wallThick + CONFIG.BORDER_WIDTH);
            this.ctx.fill();

            // Caps Fill
            if (!wc.startRight) this.drawCapFill(-bounds.length / 2, wy + wallThick / 2);
            if (!wc.endRight) this.drawCapFill(bounds.length / 2, wy + wallThick / 2);

            // Main Fill
            this.ctx.fillStyle = CONFIG.COLORS.WALL;
            this.ctx.beginPath();
            this.ctx.rect(-bounds.length / 2, wy, bounds.length, wallThick);
            this.ctx.fill();
        }
    }

    drawCurvedSurface(bounds) {
        const innerRadius = bounds.radius - bounds.width / 2;
        const outerRadius = bounds.radius + bounds.width / 2;

        // Draw track surface
        this.ctx.fillStyle = CONFIG.COLORS.TRACK_BORDER;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, outerRadius + CONFIG.BORDER_WIDTH, 0, bounds.arcAngle);
        this.ctx.arc(0, 0, innerRadius - CONFIG.BORDER_WIDTH, bounds.arcAngle, 0, true);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = CONFIG.COLORS.TRACK;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, outerRadius, 0, bounds.arcAngle);
        this.ctx.arc(0, 0, innerRadius, bounds.arcAngle, 0, true);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawCurvedWalls(bounds, wc) {
        const innerRadius = bounds.radius - bounds.width / 2;
        const outerRadius = bounds.radius + bounds.width / 2;

        const wallThick = CONFIG.WALL_THICKNESS;
        const wallBorderHalf = CONFIG.BORDER_WIDTH / 2;
        const rInnerMiddle = innerRadius - wallThick / 2;
        const rOuterMiddle = outerRadius + wallThick / 2;

        // Draw walls if present
        if (bounds.leftWall) {
            // Inner Wall
            // Caps Border
            if (!wc.startLeft) this.drawCapBorder(rInnerMiddle, 0); // Start (Angle 0)
            if (!wc.endLeft) this.drawCapBorder(0, rInnerMiddle);   // End (Angle 90/PI/2 -> x=0, y=r)

            // Border (Underneath)
            this.ctx.fillStyle = CONFIG.COLORS.WALL_BORDER;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, innerRadius + wallBorderHalf, 0, bounds.arcAngle);
            this.ctx.arc(0, 0, innerRadius - wallThick - wallBorderHalf, bounds.arcAngle, 0, true);
            this.ctx.closePath();
            this.ctx.fill();

            // Caps Fill
            if (!wc.startLeft) this.drawCapFill(rInnerMiddle, 0);
            if (!wc.endLeft) this.drawCapFill(0, rInnerMiddle);

            // Fill (Top)
            this.ctx.fillStyle = CONFIG.COLORS.WALL;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, innerRadius, 0, bounds.arcAngle);
            this.ctx.arc(0, 0, innerRadius - wallThick, bounds.arcAngle, 0, true);
            this.ctx.closePath();
            this.ctx.fill();
        }

        if (bounds.rightWall) {
            // Outer Wall
            // Caps Border
            if (!wc.startRight) this.drawCapBorder(rOuterMiddle, 0);
            if (!wc.endRight) this.drawCapBorder(0, rOuterMiddle);

            // Border (Underneath)
            this.ctx.fillStyle = CONFIG.COLORS.WALL_BORDER;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, outerRadius + wallThick + wallBorderHalf, 0, bounds.arcAngle);
            this.ctx.arc(0, 0, outerRadius - wallBorderHalf, bounds.arcAngle, 0, true);
            this.ctx.closePath();
            this.ctx.fill();

            // Caps Fill
            if (!wc.startRight) this.drawCapFill(rOuterMiddle, 0);
            if (!wc.endRight) this.drawCapFill(0, rOuterMiddle);

            // Fill (Top)
            this.ctx.fillStyle = CONFIG.COLORS.WALL;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, outerRadius + wallThick, 0, bounds.arcAngle);
            this.ctx.arc(0, 0, outerRadius, bounds.arcAngle, 0, true);
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    drawStartLine(startLine) {
        this.ctx.save();
        this.ctx.translate(startLine.x, startLine.y);
        this.ctx.rotate(startLine.angle);

        // Draw checkered pattern
        const lineWidth = CONFIG.TRACK_WIDTH;
        const squareSize = 10;
        const squares = Math.ceil(lineWidth / squareSize);

        for (let i = 0; i < squares; i++) {
            const y = -lineWidth / 2 + i * squareSize;

            // First column (-10 to 0)
            this.ctx.fillStyle = i % 2 === 0 ? CONFIG.COLORS.START_LINE : CONFIG.COLORS.START_LINE_BORDER;
            this.ctx.fillRect(-10, y, 10, squareSize);

            // Second column (0 to 10)
            this.ctx.fillStyle = i % 2 !== 0 ? CONFIG.COLORS.START_LINE : CONFIG.COLORS.START_LINE_BORDER;
            this.ctx.fillRect(0, y, 10, squareSize);
        }

        this.ctx.restore();
    }

    // Draw the disk
    drawDisk(disk, arrowAngle = null) {
        this.ctx.save();

        // Draw border (use disk's own border color)
        this.ctx.fillStyle = disk.borderColor || CONFIG.COLORS.DISK_BORDER;
        this.ctx.beginPath();
        this.ctx.arc(
            disk.position.x,
            disk.position.y,
            disk.radius + CONFIG.BORDER_WIDTH,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Draw disk (use disk's own color)
        this.ctx.fillStyle = disk.color || CONFIG.COLORS.DISK;
        this.ctx.beginPath();
        this.ctx.arc(disk.position.x, disk.position.y, disk.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw direction arrow if provided
        if (arrowAngle !== null) {
            this.drawArrow(disk.position.x, disk.position.y, arrowAngle, disk.radius * 2);
        }

        this.ctx.restore();
    }

    // Draw direction arrow
    drawArrow(x, y, angle, length) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        // Arrow shaft
        this.ctx.strokeStyle = CONFIG.COLORS.ARROW_BORDER;
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(length, 0);
        this.ctx.stroke();

        this.ctx.strokeStyle = CONFIG.COLORS.ARROW;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(length, 0);
        this.ctx.stroke();

        // Arrow head
        this.ctx.fillStyle = CONFIG.COLORS.ARROW_BORDER;
        this.ctx.beginPath();
        this.ctx.moveTo(length, 0);
        this.ctx.lineTo(length - 15, -10);
        this.ctx.lineTo(length - 15, 10);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = CONFIG.COLORS.ARROW;
        this.ctx.beginPath();
        this.ctx.moveTo(length, 0);
        this.ctx.lineTo(length - 12, -7);
        this.ctx.lineTo(length - 12, 7);
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.restore();
    }

    // Draw particles
    renderParticles(particleSystem) {
        particleSystem.render(this.ctx);
    }
}
