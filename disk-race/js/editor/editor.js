import { CONFIG } from '../config.js';
import { TrackPiece } from '../track/trackPiece.js';
import { Renderer } from '../rendering/renderer.js';
import { Vector } from '../utils/vector.js';

class TrackEditor {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);

        this.libraryCanvas = document.getElementById('library-canvas');
        this.libraryRenderer = new Renderer(this.libraryCanvas);

        this.trackName = "Oma rata";
        // Start with an empty board
        this.pieces = [];

        // Selection & Drag state
        this.selectedPieces = [];
        this.isDraggingPiece = false;
        this.isMarqueeSelecting = false;
        this.marqueeStart = { x: 0, y: 0 };
        this.mousePos = { x: 0, y: 0 };

        // Drag and drop state (from library)
        this.isDraggingFromPalette = false;
        this.draggedType = null;
        this.dragRotation = 0;

        this.isWallToolActive = false; // "Laitatyökalu" state

        this.setupCanvas();
        this.setupButtons();
        this.setupLibrary();
        this.setupMainCanvasEvents();
        this.setupKeyboard();
        this.setupResize();
        this.renderLibrary();

        // Load from localStorage if available
        this.loadFromLocalStorage();

        this.render();
    }

    setupCanvas() {
        this.resize();
    }

    setupResize() {
        window.addEventListener('resize', () => {
            this.resize();
            this.render();
        });
    }

    resize() {
        const area = document.querySelector('.canvas-area');
        if (area) {
            this.canvas.width = area.clientWidth;
            this.canvas.height = area.clientHeight;
        }
    }

    setupButtons() {
        document.getElementById('undo').onclick = () => this.undo();
        document.getElementById('clear-all').onclick = () => this.clear();
        document.getElementById('save-json').onclick = () => this.saveJSON();
        document.getElementById('load-json').onclick = () => this.loadJSON();
        document.getElementById('rotate-piece').onclick = () => this.rotateSelection(Math.PI / 2);

        // Back to game button
        document.getElementById('back-to-game').onclick = () => {
            this.saveToLocalStorage();
            window.location.href = 'index.html';
        };

        const wallBtn = document.getElementById('toggle-walls');
        wallBtn.onclick = () => {
            this.isWallToolActive = !this.isWallToolActive;
            wallBtn.style.background = this.isWallToolActive ? '#dbeafe' : 'white';
            wallBtn.style.borderColor = this.isWallToolActive ? '#3b82f6' : '#e0e7ff';
            this.selectedPieces = []; // Clear selection when switching tools
            this.render();
        };
    }

    setupLibrary() {
        this.libraryCanvas.onmousedown = (e) => {
            // Allow dragging from library even if wall tool is active

            const rect = this.libraryCanvas.getBoundingClientRect();
            const mouseY = e.clientY - rect.top;

            if (mouseY < 150) {
                this.draggedType = 'straight';
            } else if (mouseY >= 150 && mouseY < 300) {
                this.draggedType = 'curve';
            } else if (mouseY >= 300 && mouseY < 450) {
                this.draggedType = 'start';
            } else {
                return;
            }

            this.isDraggingFromPalette = true;
            this.dragRotation = 0;
            document.body.style.cursor = 'grabbing';
            this.render();
        };
    }

    setupMainCanvasEvents() {
        this.canvas.onmousedown = (e) => {
            const pos = this.getMousePos(e);
            let clickedPiece = null;

            // Find clicked piece (checking top-most first)
            for (let i = this.pieces.length - 1; i >= 0; i--) {
                if (this.isPointInsidePiece(this.pieces[i], pos.x, pos.y)) {
                    clickedPiece = this.pieces[i];
                    break;
                }
            }

            // Wall Tool Logic
            // Only capture input if we are in wall mode AND clicking near a wall
            if (this.isWallToolActive && clickedPiece) {
                const b = clickedPiece.getBounds();
                const WALL_CLICK_THRESHOLD = 20;
                let wallActionTaken = false;

                if (clickedPiece.type === 'straight' || clickedPiece.type === 'start') {
                    // Transform point to local space to check Y relative to center
                    const dx = pos.x - clickedPiece.x;
                    const dy = pos.y - clickedPiece.y;
                    const c = Math.cos(-clickedPiece.angle);
                    const s = Math.sin(-clickedPiece.angle);
                    const localY = dx * s + dy * c;
                    const halfWidth = b.width / 2;

                    // Check boundaries
                    if (Math.abs(Math.abs(localY) - halfWidth) <= WALL_CLICK_THRESHOLD) {
                        // negative Y is "left" wall (top in 0 rotation), positive is "right"
                        if (localY < 0) {
                            clickedPiece.leftWall = !clickedPiece.leftWall;
                        } else {
                            clickedPiece.rightWall = !clickedPiece.rightWall;
                        }
                        wallActionTaken = true;
                    }

                } else if (clickedPiece.type === 'curve') {
                    // Curve center is at piece.x, piece.y
                    const dist = Math.hypot(pos.x - clickedPiece.x, pos.y - clickedPiece.y);
                    const halfWidth = b.width / 2;
                    const innerR = b.radius - halfWidth;
                    const outerR = b.radius + halfWidth;

                    // Check boundaries
                    if (Math.abs(dist - innerR) <= WALL_CLICK_THRESHOLD) {
                        clickedPiece.leftWall = !clickedPiece.leftWall;
                        wallActionTaken = true;
                    } else if (Math.abs(dist - outerR) <= WALL_CLICK_THRESHOLD) {
                        clickedPiece.rightWall = !clickedPiece.rightWall;
                        wallActionTaken = true;
                    }
                }

                if (wallActionTaken) {
                    this.render();
                    return; // Stop processing for selection/drag ONLY if we toggled a wall
                }
            }

            // Normal Selection Logic
            if (clickedPiece) {
                this.isDraggingPiece = true;

                if (!e.shiftKey && !this.selectedPieces.includes(clickedPiece)) {
                    this.selectedPieces = [clickedPiece];
                } else if (e.shiftKey && !this.selectedPieces.includes(clickedPiece)) {
                    this.selectedPieces.push(clickedPiece);
                }

                this.selectedPieces.forEach(p => {
                    p.dragOffsetX = pos.x - p.x;
                    p.dragOffsetY = pos.y - p.y;
                });

                const idx = this.pieces.indexOf(clickedPiece);
                this.pieces.push(this.pieces.splice(idx, 1)[0]);
            } else {
                this.isMarqueeSelecting = true;
                this.marqueeStart = pos;
                if (!e.shiftKey) {
                    this.selectedPieces = [];
                }
            }
            this.render();
        };

        window.addEventListener('mousemove', (e) => {
            this.mousePos = this.getMousePos(e);

            // Update cursor for wall tool
            if (this.isWallToolActive) {
                let cursor = 'default';
                const WALL_CLICK_THRESHOLD = 20;

                for (let i = this.pieces.length - 1; i >= 0; i--) {
                    const p = this.pieces[i];
                    if (this.isPointInsidePiece(p, this.mousePos.x, this.mousePos.y)) {
                        cursor = 'move'; // Default to move if over piece center
                        const b = p.getBounds();

                        if (p.type === 'straight' || p.type === 'start') {
                            const dx = this.mousePos.x - p.x;
                            const dy = this.mousePos.y - p.y;
                            const c = Math.cos(-p.angle);
                            const s = Math.sin(-p.angle);
                            const localY = dx * s + dy * c;
                            const halfWidth = b.width / 2;
                            if (Math.abs(Math.abs(localY) - halfWidth) <= WALL_CLICK_THRESHOLD) {
                                cursor = 'alias';
                            }
                        } else {
                            const dist = Math.hypot(this.mousePos.x - p.x, this.mousePos.y - p.y);
                            const halfWidth = b.width / 2;
                            if (Math.abs(dist - (b.radius - halfWidth)) <= WALL_CLICK_THRESHOLD ||
                                Math.abs(dist - (b.radius + halfWidth)) <= WALL_CLICK_THRESHOLD) {
                                cursor = 'alias';
                            }
                        }
                        break;
                    }
                }
                document.body.style.cursor = cursor;
                // No return here, allow drag updates below
            }

            if (this.isDraggingFromPalette) {
                this.render();
            } else if (this.isDraggingPiece) {
                this.selectedPieces.forEach(p => {
                    p.x = this.mousePos.x - p.dragOffsetX;
                    p.y = this.mousePos.y - p.dragOffsetY;
                });
                this.render();
            } else if (this.isMarqueeSelecting) {
                this.render();
            }
        });

        window.addEventListener('mouseup', (e) => {
            // Allow dropping pieces even in wall mode
            if (this.isDraggingFromPalette) {
                if (e.target === this.canvas) {
                    let placeX = this.mousePos.x;
                    let placeY = this.mousePos.y;

                    if (this.draggedType === 'curve') {
                        const tempCurve = new TrackPiece('curve', 0, 0, this.dragRotation, true, true);
                        const b = tempCurve.getBounds();
                        const midAngle = this.dragRotation + b.arcAngle / 2;
                        placeX -= Math.cos(midAngle) * b.radius;
                        placeY -= Math.sin(midAngle) * b.radius;
                    }

                    const newPiece = new TrackPiece(this.draggedType, placeX, placeY, this.dragRotation, true, true);
                    this.pieces.push(newPiece);
                    this.selectedPieces = [newPiece];
                    this.snapSelection();
                }
                this.isDraggingFromPalette = false;
                this.draggedType = null;
            } else if (this.isDraggingPiece) {
                this.snapSelection();
                this.isDraggingPiece = false;
            } else if (this.isMarqueeSelecting) {
                this.isMarqueeSelecting = false;
                const rect = {
                    x1: Math.min(this.marqueeStart.x, this.mousePos.x),
                    y1: Math.min(this.marqueeStart.y, this.mousePos.y),
                    x2: Math.max(this.marqueeStart.x, this.mousePos.x),
                    y2: Math.max(this.marqueeStart.y, this.mousePos.y)
                };

                this.pieces.forEach(p => {
                    const bounds = this.getPieceBBox(p);
                    if (bounds.minX >= rect.x1 && bounds.maxX <= rect.x2 &&
                        bounds.minY >= rect.y1 && bounds.maxY <= rect.y2) {
                        if (!this.selectedPieces.includes(p)) {
                            this.selectedPieces.push(p);
                        }
                    }
                });
            }
            if (!this.isWallToolActive) {
                document.body.style.cursor = 'default';
            }
            this.render();
        });

        this.canvas.oncontextmenu = (e) => {
            e.preventDefault();
            this.selectedPieces = [];
            this.render();
        };
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    isPointInsidePiece(piece, mx, my) {
        const b = piece.getBounds();
        const dx = mx - piece.x;
        const dy = my - piece.y;
        const c = Math.cos(-piece.angle);
        const s = Math.sin(-piece.angle);
        const lx = dx * c - dy * s;
        const ly = dx * s + dy * c;

        if (piece.type === 'straight' || piece.type === 'start') {
            return Math.abs(lx) <= b.length / 2 && Math.abs(ly) <= b.width / 2;
        } else {
            const dist = Math.sqrt(lx * lx + ly * ly);
            let angle = Math.atan2(ly, lx);
            angle = (angle + Math.PI * 2) % (Math.PI * 2);
            return dist >= b.radius - b.width / 2 && dist <= b.radius + b.width / 2 &&
                angle >= 0 && angle <= b.arcAngle;
        }
    }

    getPieceCenter(piece) {
        if (piece.type === 'straight' || piece.type === 'start') return { x: piece.x, y: piece.y };
        const b = piece.getBounds();
        const midAngle = piece.angle + b.arcAngle / 2;
        return {
            x: piece.x + Math.cos(midAngle) * b.radius,
            y: piece.y + Math.sin(midAngle) * b.radius
        };
    }

    getPieceBBox(piece) {
        const b = piece.getBounds();
        let pts = [];
        if (piece.type === 'straight' || piece.type === 'start') {
            pts = [
                { x: -b.length / 2, y: -b.width / 2 }, { x: b.length / 2, y: -b.width / 2 },
                { x: b.length / 2, y: b.width / 2 }, { x: -b.length / 2, y: b.width / 2 }
            ];
        } else {
            const steps = 8;
            for (let i = 0; i <= steps; i++) {
                const a = (b.arcAngle * i) / steps;
                pts.push({ x: Math.cos(a) * (b.radius + b.width / 2), y: Math.sin(a) * (b.radius + b.width / 2) });
                pts.push({ x: Math.cos(a) * (b.radius - b.width / 2), y: Math.sin(a) * (b.radius - b.width / 2) });
            }
        }

        const cos = Math.cos(piece.angle);
        const sin = Math.sin(piece.angle);
        const worldPts = pts.map(p => ({
            x: piece.x + (p.x * cos - p.y * sin),
            y: piece.y + (p.x * sin + p.y * cos)
        }));

        return {
            minX: Math.min(...worldPts.map(p => p.x)),
            maxX: Math.max(...worldPts.map(p => p.x)),
            minY: Math.min(...worldPts.map(p => p.y)),
            maxY: Math.max(...worldPts.map(p => p.y))
        };
    }

    snapSelection() {
        if (this.selectedPieces.length === 0) return;

        const SNAP_THRESHOLD = 50;
        let bestSnap = { dist: Infinity, dx: 0, dy: 0 };

        const otherPieces = this.pieces.filter(p => !this.selectedPieces.includes(p));
        const boardPoints = [];
        otherPieces.forEach(p => {
            const cp = p.getConnectionPoints();
            boardPoints.push(cp.start);
            boardPoints.push(cp.end);
        });

        this.selectedPieces.forEach(selPiece => {
            const selCP = selPiece.getConnectionPoints();
            const selPoints = [selCP.start, selCP.end];

            selPoints.forEach(sp => {
                boardPoints.forEach(bp => {
                    const d = Math.sqrt((sp.x - bp.x) ** 2 + (sp.y - bp.y) ** 2);
                    if (d < bestSnap.dist && d < SNAP_THRESHOLD) {
                        bestSnap = { dist: d, dx: bp.x - sp.x, dy: bp.y - sp.y };
                    }
                });
            });
        });

        if (bestSnap.dist < Infinity) {
            this.selectedPieces.forEach(p => {
                p.x += bestSnap.dx;
                p.y += bestSnap.dy;
            });
        }
    }

    rotateSelection(angle) {
        if (this.isDraggingFromPalette) {
            this.dragRotation += angle;
            this.render();
            return;
        }

        if (this.selectedPieces.length === 0) return;

        let cx = 0, cy = 0;
        this.selectedPieces.forEach(p => {
            const center = this.getPieceCenter(p);
            cx += center.x; cy += center.y;
        });
        cx /= this.selectedPieces.length;
        cy /= this.selectedPieces.length;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        this.selectedPieces.forEach(p => {
            const center = this.getPieceCenter(p);
            const rx = center.x - cx;
            const ry = center.y - cy;

            const newCX = cx + (rx * cos - ry * sin);
            const newCY = cy + (rx * sin + ry * cos);

            p.angle += angle;

            if (p.type === 'curve') {
                const b = p.getBounds();
                const midAngle = p.angle + b.arcAngle / 2;
                p.x = newCX - Math.cos(midAngle) * b.radius;
                p.y = newCY - Math.sin(midAngle) * b.radius;
            } else {
                p.x = newCX;
                p.y = newCY;
            }

            // If we are dragging this piece, we need to update the dragOffset
            // because the piece's position (p.x, p.y) has effectively changed relative to the mouse
            // The mouse position hasn't changed, but the piece anchor has.
            // New offset = MousePos - NewPiecePos
            if (this.isDraggingPiece && this.selectedPieces.includes(p)) {
                p.dragOffsetX = this.mousePos.x - p.x;
                p.dragOffsetY = this.mousePos.y - p.y;
            }
        });
        this.render();
    }

    setupKeyboard() {
        window.onkeydown = (e) => {
            if (e.key === 'Escape') {
                this.selectedPieces = [];
                this.render();
            }
            if (e.ctrlKey && e.key === 'z') this.undo();

            const rotAngle = Math.PI / 2;
            if (e.key === 'r' || e.key === 'ArrowRight') this.rotateSelection(rotAngle);
            if (e.key === 'ArrowLeft') this.rotateSelection(-rotAngle);

            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Prevent deleting the only start piece if necessary, or just allow it
                this.pieces = this.pieces.filter(p => !this.selectedPieces.includes(p));
                this.selectedPieces = [];
                this.render();
            }
        };
    }

    undo() {
        this.pieces.pop();
        this.render();
    }

    clear() {
        if (confirm("Tyhjennetäänkö koko rata?")) {
            this.pieces = [];
            this.selectedPieces = [];
            this.render();
        }
    }

    saveJSON() {
        const toDeg = (rad) => {
            let deg = Math.round(rad * (180 / Math.PI)) % 360;
            return deg < 0 ? deg + 360 : deg;
        };

        const startPiece = this.pieces.find(p => p.type === 'start');
        const startLine = startPiece ?
            { x: Math.round(startPiece.x), y: Math.round(startPiece.y), angle: toDeg(startPiece.angle) } :
            { x: 0, y: 0, angle: 0 };

        const trackData = {
            name: this.trackName,
            startLine: startLine,
            pieces: this.pieces.filter(p => p.type !== 'start').map(p => ({
                type: p.type, x: Math.round(p.x), y: Math.round(p.y), angle: toDeg(p.angle),
                leftWall: p.leftWall, rightWall: p.rightWall
            }))
        };
        const blob = new Blob([JSON.stringify(trackData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'oma_rata.json';
        a.click();
    }

    loadJSON() {
        const fileInput = document.getElementById('file-input');
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const trackData = JSON.parse(event.target.result);
                    this.loadTrackData(trackData);
                    fileInput.value = ''; // Reset input
                } catch (error) {
                    alert('Virhe JSON-tiedoston lataamisessa: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }

    loadTrackData(trackData) {
        const toRad = (deg) => (deg * Math.PI) / 180;

        this.pieces = [];
        this.selectedPieces = [];

        // Load start piece if exists
        if (trackData.startLine) {
            const start = new TrackPiece(
                'start',
                trackData.startLine.x,
                trackData.startLine.y,
                toRad(trackData.startLine.angle),
                true,
                true
            );
            this.pieces.push(start);
        }

        // Load other pieces
        if (trackData.pieces) {
            trackData.pieces.forEach(pieceData => {
                const piece = new TrackPiece(
                    pieceData.type,
                    pieceData.x,
                    pieceData.y,
                    toRad(pieceData.angle),
                    pieceData.leftWall !== undefined ? pieceData.leftWall : true,
                    pieceData.rightWall !== undefined ? pieceData.rightWall : true
                );
                this.pieces.push(piece);
            });
        }

        if (trackData.name) {
            this.trackName = trackData.name;
        }

        this.render();
    }

    saveToLocalStorage() {
        const toDeg = (rad) => {
            let deg = Math.round(rad * (180 / Math.PI)) % 360;
            return deg < 0 ? deg + 360 : deg;
        };

        const startPiece = this.pieces.find(p => p.type === 'start');
        const startLine = startPiece ?
            { x: Math.round(startPiece.x), y: Math.round(startPiece.y), angle: toDeg(startPiece.angle) } :
            { x: 0, y: 0, angle: 0 };

        const trackData = {
            name: this.trackName,
            startLine: startLine,
            pieces: this.pieces.filter(p => p.type !== 'start').map(p => ({
                type: p.type, x: Math.round(p.x), y: Math.round(p.y), angle: toDeg(p.angle),
                leftWall: p.leftWall, rightWall: p.rightWall
            }))
        };

        localStorage.setItem('editorTrack', JSON.stringify(trackData));
    }

    loadFromLocalStorage() {
        const savedTrack = localStorage.getItem('editorTrack');
        if (savedTrack) {
            try {
                const trackData = JSON.parse(savedTrack);
                this.loadTrackData(trackData);
                console.log('Loaded track from localStorage');
            } catch (error) {
                console.error('Error loading from localStorage:', error);
            }
        }
    }

    renderLibrary() {
        this.libraryRenderer.clear();
        this.libraryRenderer.drawTrackPiece(new TrackPiece('straight', 105, 70, 0, true, true));
        this.libraryRenderer.ctx.fillStyle = '#475569';
        this.libraryRenderer.ctx.font = 'bold 12px sans-serif';
        this.libraryRenderer.ctx.textAlign = 'center';
        this.libraryRenderer.ctx.fillText('SUORA OSA', 105, 130);

        const libX = 105;
        let libY = 260;
        const tempCurve = new TrackPiece('curve', 0, 0, 0, true, true);
        const bc = tempCurve.getBounds();
        const midAngleC = 0 + bc.arcAngle / 2;
        this.libraryRenderer.drawTrackPiece(new TrackPiece('curve', libX - Math.cos(midAngleC) * bc.radius, libY - Math.sin(midAngleC) * bc.radius, 0, true, true));
        this.libraryRenderer.ctx.fillText('MUTKA 90°', 105, 330);

        libY = 460;
        this.libraryRenderer.drawTrackPiece(new TrackPiece('start', libX, libY, 0, true, true));
        this.libraryRenderer.ctx.fillText('LÄHTÖVIIVA', 105, 530);
    }

    render() {
        this.renderer.clear('#f0f4f8');
        this.renderer.drawTrack({ pieces: this.pieces, startLine: { x: -1000, y: -1000, angle: 0 } }); // Don't use old startLine

        this.selectedPieces.forEach(p => this.drawHighlight(p));

        if (this.isDraggingFromPalette) {
            this.renderer.ctx.save();
            this.renderer.ctx.globalAlpha = 0.5;

            let drawX = this.mousePos.x;
            let drawY = this.mousePos.y;

            if (this.draggedType === 'curve') {
                const tempCurve = new TrackPiece('curve', 0, 0, this.dragRotation, true, true);
                const b = tempCurve.getBounds();
                const midAngle = this.dragRotation + b.arcAngle / 2;
                drawX -= Math.cos(midAngle) * b.radius;
                drawY -= Math.sin(midAngle) * b.radius;
            }

            const preview = new TrackPiece(this.draggedType, drawX, drawY, this.dragRotation, true, true);
            this.renderer.drawTrackPiece(preview);
            this.renderer.ctx.restore();

            // Draw highlight for palette drag too
            this.drawHighlight(preview);
        }

        if (this.isMarqueeSelecting) {
            this.renderer.ctx.save();
            this.renderer.ctx.strokeStyle = '#3b82f6';
            this.renderer.ctx.lineWidth = 1;
            this.renderer.ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            const w = this.mousePos.x - this.marqueeStart.x;
            const h = this.mousePos.y - this.marqueeStart.y;
            this.renderer.ctx.fillRect(this.marqueeStart.x, this.marqueeStart.y, w, h);
            this.renderer.ctx.strokeRect(this.marqueeStart.x, this.marqueeStart.y, w, h);
            this.renderer.ctx.restore();
        }
    }

    drawHighlight(piece) {
        const b = piece.getBounds();
        const ctx = this.renderer.ctx;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.angle);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 4]);

        const trackBorderExt = CONFIG.BORDER_WIDTH; // 4
        const wallBorderExt = CONFIG.BORDER_WIDTH / 2; // 2
        const wallPad = CONFIG.WALL_THICKNESS + wallBorderExt; // 10

        const padTop = b.leftWall ? wallPad : trackBorderExt;
        const padBottom = b.rightWall ? wallPad : trackBorderExt;
        const strokeOffset = 2; // Half of lineWidth to ensure we are outside

        if (piece.type === 'straight' || piece.type === 'start') {
            const x = -b.length / 2 - strokeOffset;
            const y = -b.width / 2 - padTop - strokeOffset;
            const w = b.length + strokeOffset * 2;
            const h = b.width + padTop + padBottom + strokeOffset * 2;

            ctx.strokeRect(x, y, w, h);
        } else {
            const padOuter = b.rightWall ? wallPad : trackBorderExt;
            const padInner = b.leftWall ? wallPad : trackBorderExt;

            const outerRadius = b.radius + b.width / 2 + padOuter + strokeOffset;
            const innerRadius = b.radius - b.width / 2 - padInner - strokeOffset;

            ctx.beginPath();
            ctx.arc(0, 0, outerRadius, 0, b.arcAngle);
            ctx.arc(0, 0, innerRadius, b.arcAngle, 0, true);
            ctx.closePath();
            ctx.stroke();
        }
        ctx.restore();
    }
}

const canvas = document.getElementById('editor-canvas');
new TrackEditor(canvas);
