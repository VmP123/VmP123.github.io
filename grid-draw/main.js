const CONFIG = {
    SNAP_RADIUS_PIXELS: 10,
    DEFAULT_GRID_SIZE: 20,
    GRID_SIZE_MIN: 5,
    GRID_SIZE_MAX: 160,
    ZOOM_MIN: 1.0,
    ZOOM_MAX: 10.0,
    ZOOM_FACTOR_WHEEL: 1.1,
    ZOOM_FACTOR_BUTTON: 1.5,
    CANVAS_MARGIN: 40,
    CANVAS_FALLBACK_RATIO: 0.9,
    MIN_DRAW_LENGTH_FOR_DIRECTION: 5,
    INTERSECTION_THRESHOLD_NEAR: 10,
    INTERSECTION_THRESHOLD_EXACT: 0.5,
    EPSILON: 0.0001,
    VP_SELECTION_RADIUS: 15,
    ERASER_HOVER_WIDTH_EXTRA: 6,
    FILL_BOUNDARY_LINE_WIDTH_EXTRA: 0,
    FILL_MASK_ALPHA_THRESHOLD: 20,
    PREVIEW_ALPHA: 0.5
};

const UI = {
    canvas: document.getElementById('drawing-canvas'),
    snapToggle: document.getElementById('snap-toggle'),
    snapEndpointToggle: document.getElementById('snap-endpoint-toggle'),
    snapLineIntersectionToggle: document.getElementById('snap-line-intersection-toggle'),
    snapGridLineIntersectionToggle: document.getElementById('snap-grid-line-intersection-toggle'),
    snapIntersectionToggle: document.getElementById('snap-intersection-toggle'),
    toolRadios: document.querySelectorAll('input[name="tool"]'),
    colorPicker: document.getElementById('color-picker'),
    undoButton: document.getElementById('undo-button'),
    redoButton: document.getElementById('redo-button'),
    clearCanvasButton: document.getElementById('clear-canvas-button'),
    addLayerButton: document.getElementById('add-layer-button'),
    mergeLayersButton: document.getElementById('merge-layers-button'),
    layersList: document.getElementById('layers-list'),
    saveJsonButton: document.getElementById('save-json-button'),
    loadJsonButton: document.getElementById('load-json-button'),
    jsonFileInput: document.getElementById('json-file-input'),
    exportImageButton: document.getElementById('export-image-button'),
    grid2DToggle: document.getElementById('2d-grid-toggle'),
    grid2DDensityValue: document.getElementById('2d-grid-density-value'),
    gridHalveButton: document.getElementById('grid-halve-button'),
    gridDoubleButton: document.getElementById('grid-double-button'),
    gridOnTopToggle: document.getElementById('grid-on-top-toggle'),
    showVPsToggle: document.getElementById('show-vps-toggle'),
    showMeasurementsToggle: document.getElementById('show-measurements-toggle'),
    zoomInButton: document.getElementById('zoom-in-button'),
    zoomOutButton: document.getElementById('zoom-out-button'),
    zoomValue: document.getElementById('zoom-value'),
    lineWidthSlider: document.getElementById('line-width-slider'),
    lineWidthValue: document.getElementById('line-width-value'),
    gridTypeSelect: document.getElementById('grid-type-select'),
    container: document.getElementById('canvas-container'),
    dialogOverlay: document.getElementById('dialog-overlay'),
    alertTitle: document.getElementById('alert-title'),
    alertMessage: document.getElementById('alert-message'),
    alertDialog: document.getElementById('alert-dialog'),
    alertOkBtn: document.getElementById('alert-ok-btn'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmDialog: document.getElementById('confirm-dialog'),
    confirmOkBtn: document.getElementById('confirm-ok-btn'),
    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
    showPointsToggle: document.getElementById('show-points-toggle'),
    isoPlaneRadios: document.querySelectorAll('input[name="iso-plane"]'),
    isoPlanesGroup: document.getElementById('isometric-planes-group'),
    promptTitle: document.getElementById('prompt-title'),
    promptMessage: document.getElementById('prompt-message'),
    promptInput: document.getElementById('prompt-input'),
    promptDialog: document.getElementById('prompt-dialog'),
    promptOkBtn: document.getElementById('prompt-ok-btn'),
    promptCancelBtn: document.getElementById('prompt-cancel-btn'),
    splitDialog: document.getElementById('split-dialog'),
    splitNumInput: document.getElementById('split-num-input'),
    splitDialogModeRadios: document.getElementsByName('split-dialog-mode'),
    splitClearContainer: document.getElementById('split-clear-container'),
    splitClearBtn: document.getElementById('split-clear-btn'),
    splitCancelBtn: document.getElementById('split-cancel-btn'),
    splitOkBtn: document.getElementById('split-ok-btn')
};

const ctx = UI.canvas.getContext('2d');

const STATE = {
    isDrawing: false,
    startCoords: { x: 0, y: 0 },
    currentCoords: { x: 0, y: 0 },
    layers: [
        {
            id: 1,
            name: "Layer 1",
            visible: true,
            selected: false,
            lines: [],
            vpLines: [],
            circles: [],
            arcs: [],
            ellipses: [],
            isoArcs: [],
            fills: [],
            points: []
        }
    ],
    activeLayerId: 1,
    nextLayerId: 2,
    actionHistory: [],
    redoHistory: [],
    drawingTool: 'free',
    currentColor: '#000000',
    currentLineWidth: 2,
    vanishingPoints: [],
    activeVP: null,
    hoveredLine: null,
    fillIndexMap: null,
    referenceLine: null,
    gridSize2D: CONFIG.DEFAULT_GRID_SIZE,
    gridType: '2d',
    show2DGrid: UI.grid2DToggle.checked,
    gridOnTop: UI.gridOnTopToggle ? UI.gridOnTopToggle.checked : false,
    showVPs: UI.showVPsToggle ? UI.showVPsToggle.checked : true,
    showPoints: UI.showPointsToggle ? UI.showPointsToggle.checked : false,
    showMeasurements: true,
    snapGrid: UI.snapToggle.checked,
    snapToEndpoint: UI.snapEndpointToggle.checked,
    snapToLineIntersection: UI.snapLineIntersectionToggle.checked,
    snapToGridLineIntersection: UI.snapGridLineIntersectionToggle.checked,
    snapToIntersection: UI.snapIntersectionToggle.checked,
    lineIntersectionPoints: [],
    zoomLevel: 1.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    isSpacePressed: false,
    isShiftPressed: false,
    arcStep: 0, // 0: idle, 1: center set, 2: radius/start point set
    arcCenter: null,
    arcStart: null,
    selectedItems: [],
    isMarqueeSelecting: false,
    marqueeStart: null,
    marqueeEnd: null,
    isMovingSelection: false,
    moveStartPos: null,
    moveCurrentPos: null,
    movingAnchorItem: null,
    moveSnapHandle: null,
    isoPlane: 'top',
    cuttingBlades: [],
    rawMousePos: { x: 0, y: 0 },
    clipboard: null,
    vpRectStep: 0,
    vpRectPoint2: null,
    splitSelection: null // { target, type, layerId, n, mode }
};

const fillCanvas = document.createElement('canvas');
const fillCtx = fillCanvas.getContext('2d');

let alertResolve = null;
let confirmResolve = null;
let promptResolve = null;
let splitResolve = null;

function showAlertDialog(message, title = "Ilmoitus") {
    return new Promise((resolve) => {
        alertResolve = resolve;
        UI.alertTitle.textContent = title;
        UI.alertMessage.textContent = message;
        UI.dialogOverlay.style.display = 'flex';
        UI.alertDialog.style.display = 'block';
        UI.alertOkBtn.focus();
    });
}

function closeAlertDialog() {
    UI.dialogOverlay.style.display = 'none';
    UI.alertDialog.style.display = 'none';
    if (alertResolve) {
        alertResolve();
        alertResolve = null;
    }
}

function showConfirmDialog(message, title = "Vahvistus") {
    return new Promise((resolve) => {
        confirmResolve = resolve;
        UI.confirmTitle.textContent = title;
        UI.confirmMessage.textContent = message;
        UI.dialogOverlay.style.display = 'flex';
        UI.confirmDialog.style.display = 'block';
        UI.confirmOkBtn.focus();
    });
}

function closeConfirmDialog(result = false) {
    UI.dialogOverlay.style.display = 'none';
    UI.confirmDialog.style.display = 'none';
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

function showPromptDialog(message, defaultValue = "", title = "Syötä arvo") {
    return new Promise((resolve) => {
        promptResolve = resolve;
        UI.promptTitle.textContent = title;
        UI.promptMessage.textContent = message;
        UI.promptInput.value = defaultValue;
        UI.dialogOverlay.style.display = 'flex';
        UI.promptDialog.style.display = 'block';
        UI.promptInput.focus();
        UI.promptInput.select();
    });
}

function closePromptDialog(value = null) {
    UI.dialogOverlay.style.display = 'none';
    UI.promptDialog.style.display = 'none';
    if (promptResolve) {
        promptResolve(value);
        promptResolve = null;
    }
}

function showSplitDialog(hasPoints = false) {
    return new Promise((resolve) => {
        splitResolve = resolve;
        UI.splitClearContainer.style.display = hasPoints ? 'block' : 'none';
        UI.dialogOverlay.style.display = 'flex';
        UI.splitDialog.style.display = 'block';
        UI.splitNumInput.focus();
        UI.splitNumInput.select();
    });
}

function closeSplitDialog(result = null) {
    UI.dialogOverlay.style.display = 'none';
    UI.splitDialog.style.display = 'none';
    if (splitResolve) {
        splitResolve(result);
        splitResolve = null;
    }
}

/**
 * Normalizes an angle to the range [0, 2*PI).
 * Immune to Infinity/NaN and large numbers.
 */
function normalizeAngle(a) {
    if (!Number.isFinite(a)) return 0;
    a = a % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a;
}

function addAction(action) {
    STATE.actionHistory.push(action);
    STATE.redoHistory.length = 0; // Clear redo history on new action
}

// Setup confirm dialog button handlers
document.addEventListener('DOMContentLoaded', () => {
    UI.confirmOkBtn.onclick = () => closeConfirmDialog(true);
    UI.confirmCancelBtn.onclick = () => closeConfirmDialog(false);
    UI.promptOkBtn.onclick = () => closePromptDialog(UI.promptInput.value);
    UI.promptCancelBtn.onclick = () => closePromptDialog(null);
    UI.splitOkBtn.onclick = () => {
        const mode = Array.from(UI.splitDialogModeRadios).find(r => r.checked).value;
        const n = parseInt(UI.splitNumInput.value);
        closeSplitDialog({ mode, n });
    };
    UI.splitCancelBtn.onclick = () => closeSplitDialog(null);
    UI.splitClearBtn.onclick = () => closeSplitDialog({ action: 'clear' });

    // Close on overlay click
    UI.dialogOverlay.onclick = (e) => {
        if (e.target.id === 'dialog-overlay') {
            closeAlertDialog();
            closeConfirmDialog(false);
            closePromptDialog(null);
            closeSplitDialog(null);
        }
    };
});


function getActiveLayer() {
    return STATE.layers.find(layer => layer.id === STATE.activeLayerId);
}

function getAllLines() {
    const allLines = [];
    STATE.layers.forEach(layer => {
        if (layer.visible) {
            allLines.push(...layer.lines);
        }
    });
    return allLines;
}

function getAllVPLines() {
    const allVPLines = [];
    STATE.layers.forEach(layer => {
        if (layer.visible) {
            allVPLines.push(...layer.vpLines);
        }
    });
    return allVPLines;
}

function getAllFills() {
    const allFills = [];
    STATE.layers.forEach(layer => {
        if (layer.visible) {
            allFills.push(...layer.fills);
        }
    });
    return allFills;
}

function getAllCircles() {
    const allCircles = [];
    STATE.layers.forEach(layer => {
        if (layer.visible && layer.circles) {
            allCircles.push(...layer.circles);
        }
    });
    return allCircles;
}

function getAllArcs() {
    const allArcs = [];
    STATE.layers.forEach(layer => {
        if (layer.visible && layer.arcs) {
            allArcs.push(...layer.arcs);
        }
    });
    return allArcs;
}

function getAllEllipses() {
    const allEllipses = [];
    STATE.layers.forEach(layer => {
        if (layer.visible && layer.ellipses) {
            allEllipses.push(...layer.ellipses);
        }
    });
    return allEllipses;
}

function getAllIsoArcs() {
    const allIsoArcs = [];
    STATE.layers.forEach(layer => {
        if (layer.visible && layer.isoArcs) {
            allIsoArcs.push(...layer.isoArcs);
        }
    });
    return allIsoArcs;
}

function updateLayersList() {
    const layersList = UI.layersList;
    layersList.innerHTML = '';

    // Render layers in reverse order (top layer first)
    [...STATE.layers].reverse().forEach(layer => {
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item' + (layer.id === STATE.activeLayerId ? ' active' : '');
        layerItem.dataset.layerId = layer.id;

        const selectCheckbox = document.createElement('input');
        selectCheckbox.type = 'checkbox';
        selectCheckbox.className = 'layer-select-checkbox';
        selectCheckbox.checked = !!layer.selected;
        selectCheckbox.onclick = (e) => {
            e.stopPropagation();
            layer.selected = selectCheckbox.checked;
        };

        const visBtn = document.createElement('button');
        visBtn.className = 'layer-visibility-btn' + (!layer.visible ? ' hidden' : '');
        visBtn.innerHTML = `<i class="fa-solid fa-eye${!layer.visible ? '-slash' : ''}"></i>`;
        visBtn.title = layer.visible ? 'Piilota' : 'Näytä';
        visBtn.onclick = (e) => {
            e.stopPropagation();
            layer.visible = !layer.visible;
            updateLayersList();
            draw();
        };

        const nameSpan = document.createElement('span');
        nameSpan.className = 'layer-name';
        nameSpan.textContent = layer.name;

        const editBtn = document.createElement('button');
        editBtn.className = 'layer-edit-btn';
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
        editBtn.title = 'Muokkaa nimeä';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            nameSpan.contentEditable = 'true';
            nameSpan.focus();
            setTimeout(() => {
                const range = document.createRange();
                range.selectNodeContents(nameSpan);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }, 0);
        };

        nameSpan.onblur = () => {
            if (nameSpan.contentEditable === 'true') {
                nameSpan.contentEditable = 'false';
                layer.name = nameSpan.textContent.trim() || `Layer ${layer.id}`;
                nameSpan.textContent = layer.name;
            }
        };
        nameSpan.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                nameSpan.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                nameSpan.textContent = layer.name;
                nameSpan.blur();
            }
        };

        const moveUpBtn = document.createElement('button');
        moveUpBtn.className = 'layer-move-btn';
        moveUpBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
        moveUpBtn.title = 'Siirrä ylös';
        moveUpBtn.onclick = (e) => {
            e.stopPropagation();
            const index = STATE.layers.findIndex(l => l.id === layer.id);
            if (index < STATE.layers.length - 1) {
                [STATE.layers[index], STATE.layers[index + 1]] = [STATE.layers[index + 1], STATE.layers[index]];
                updateLayersList();
                draw();
            }
        };

        const moveDownBtn = document.createElement('button');
        moveDownBtn.className = 'layer-move-btn';
        moveDownBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        moveDownBtn.title = 'Siirrä alas';
        moveDownBtn.onclick = (e) => {
            e.stopPropagation();
            const index = STATE.layers.findIndex(l => l.id === layer.id);
            if (index > 0) {
                [STATE.layers[index], STATE.layers[index - 1]] = [STATE.layers[index - 1], STATE.layers[index]];
                updateLayersList();
                draw();
            }
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'layer-delete-btn';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.title = 'Poista taso';
        delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (STATE.layers.length === 1) {
                await showAlertDialog('Et voi poistaa viimeistä tasoa!', 'Virhe');
                return;
            }
            const confirmed = await showConfirmDialog(`Haluatko varmasti poistaa tason "${layer.name}"?`, 'Vahvista poistaminen');
            if (confirmed) {
                const index = STATE.layers.findIndex(l => l.id === layer.id);
                STATE.layers.splice(index, 1);
                if (STATE.activeLayerId === layer.id) {
                    STATE.activeLayerId = STATE.layers[0].id;
                }
                updateLayersList();
                draw();
            }
        };

        layerItem.appendChild(selectCheckbox);
        layerItem.appendChild(visBtn);
        layerItem.appendChild(nameSpan);

        layerItem.appendChild(moveUpBtn);
        layerItem.appendChild(moveDownBtn);
        layerItem.appendChild(editBtn);
        layerItem.appendChild(delBtn);

        layerItem.onclick = () => {
            STATE.activeLayerId = layer.id;
            updateLayersList();
        };

        layersList.appendChild(layerItem);
    });
}

function resizeCanvas() {
    const container = UI.container;
    if (container) {
        UI.canvas.width = container.clientWidth - CONFIG.CANVAS_MARGIN;
        UI.canvas.height = container.clientHeight - CONFIG.CANVAS_MARGIN;
    } else {
        UI.canvas.width = window.innerWidth * CONFIG.CANVAS_FALLBACK_RATIO;
        UI.canvas.height = window.innerHeight * CONFIG.CANVAS_FALLBACK_RATIO;
    }

    // Resize fill canvas matches main canvas & clear it (will be rebuilt on draw)
    fillCanvas.width = UI.canvas.width;
    fillCanvas.height = UI.canvas.height;

    draw();
}

function snapToGrid2DIntersectionOrLine(point) {
    const gridSize = STATE.gridSize2D;

    const nearestGridX = Math.round(point.x / gridSize) * gridSize;
    const nearestGridY = Math.round(point.y / gridSize) * gridSize;
    const intersectionDist = Math.sqrt(
        Math.pow(point.x - nearestGridX, 2) +
        Math.pow(point.y - nearestGridY, 2)
    );

    const nearestHorizontalY = Math.round(point.y / gridSize) * gridSize;
    const horizontalDist = Math.abs(point.y - nearestHorizontalY);

    const threshold = CONFIG.SNAP_RADIUS_PIXELS / STATE.zoomLevel; // Snap radius in canvas coordinates

    // Check which is closest
    if (intersectionDist < threshold) {
        return { x: nearestGridX, y: nearestGridY };
    } else if (verticalDist < horizontalDist && verticalDist < threshold) {
        return { x: nearestVerticalX, y: point.y };
    } else if (horizontalDist < threshold) {
        return { x: point.x, y: nearestHorizontalY };
    }

    return point;
}

function findNearestVanishingPoint(point) {
    if (STATE.vanishingPoints.length === 0) return null;

    let nearest = STATE.vanishingPoints[0];
    let minDist = Math.sqrt(
        Math.pow(point.x - nearest.x, 2) +
        Math.pow(point.y - nearest.y, 2)
    );

    for (let i = 1; i < STATE.vanishingPoints.length; i++) {
        const vp = STATE.vanishingPoints[i];
        const dist = Math.sqrt(
            Math.pow(point.x - vp.x, 2) +
            Math.pow(point.y - vp.y, 2)
        );
        if (dist < minDist) {
            minDist = dist;
            nearest = vp;
        }
    }

    return nearest;
}

function findNearestEndpoint(point, threshold = CONFIG.SNAP_RADIUS_PIXELS / STATE.zoomLevel) {
    let nearestPoint = null;
    let minDistance = Infinity;

    const allVPLines = getAllVPLines();
    const allLines = getAllLines();

    for (const vpLine of allVPLines) {
        const distToStart = Math.sqrt(
            Math.pow(point.x - vpLine.start.x, 2) +
            Math.pow(point.y - vpLine.start.y, 2)
        );
        if (distToStart < minDistance && distToStart < threshold) {
            minDistance = distToStart;
            nearestPoint = vpLine.start;
        }

        // Check end point
        const distToEnd = Math.sqrt(
            Math.pow(point.x - vpLine.end.x, 2) +
            Math.pow(point.y - vpLine.end.y, 2)
        );
        if (distToEnd < minDistance && distToEnd < threshold) {
            minDistance = distToEnd;
            nearestPoint = vpLine.end;
        }
    }

    for (const line of allLines) {
        const distToStart = Math.sqrt(
            Math.pow(point.x - line.start.x, 2) +
            Math.pow(point.y - line.start.y, 2)
        );
        if (distToStart < minDistance && distToStart < threshold) {
            minDistance = distToStart;
            nearestPoint = line.start;
        }

        const distToEnd = Math.sqrt(
            Math.pow(point.x - line.end.x, 2) +
            Math.pow(point.y - line.end.y, 2)
        );
        if (distToEnd < minDistance && distToEnd < threshold) {
            minDistance = distToEnd;
            nearestPoint = line.end;
        }
    }

    const allCircles = getAllCircles();
    for (const circle of allCircles) {
        const dist = Math.sqrt(
            Math.pow(point.x - circle.center.x, 2) +
            Math.pow(point.y - circle.center.y, 2)
        );
        if (dist < minDistance && dist < threshold) {
            minDistance = dist;
            nearestPoint = circle.center;
        }
    }

    const allArcs = getAllArcs();
    for (const arc of allArcs) {
        const distCenter = Math.sqrt(
            Math.pow(point.x - arc.center.x, 2) +
            Math.pow(point.y - arc.center.y, 2)
        );
        if (distCenter < minDistance && distCenter < threshold) {
            minDistance = distCenter;
            nearestPoint = arc.center;
        }

        const startX = arc.center.x + Math.cos(arc.startAngle) * arc.radius;
        const startY = arc.center.y + Math.sin(arc.startAngle) * arc.radius;
        const distStart = Math.sqrt(Math.pow(point.x - startX, 2) + Math.pow(point.y - startY, 2));
        if (distStart < minDistance && distStart < threshold) {
            minDistance = distStart;
            nearestPoint = { x: startX, y: startY };
        }

        const endX = arc.center.x + Math.cos(arc.endAngle) * arc.radius;
        const endY = arc.center.y + Math.sin(arc.endAngle) * arc.radius;
        const distEnd = Math.sqrt(Math.pow(point.x - endX, 2) + Math.pow(point.y - endY, 2));
        if (distEnd < minDistance && distEnd < threshold) {
            minDistance = distEnd;
            nearestPoint = { x: endX, y: endY };
        }
    }

    const allEllipses = getAllEllipses();
    for (const el of allEllipses) {
        const dist = Math.sqrt(
            Math.pow(point.x - el.center.x, 2) +
            Math.pow(point.y - el.center.y, 2)
        );
        if (dist < minDistance && dist < threshold) {
            minDistance = dist;
            nearestPoint = el.center;
        }
    }

    const allIsoArcs = getAllIsoArcs();
    for (const ia of allIsoArcs) {
        const distCenter = Math.sqrt(
            Math.pow(point.x - ia.center.x, 2) +
            Math.pow(point.y - ia.center.y, 2)
        );
        if (distCenter < minDistance && distCenter < threshold) {
            minDistance = distCenter;
            nearestPoint = ia.center;
        }

        const cosR = Math.cos(ia.rotation);
        const sinR = Math.sin(ia.rotation);

        const sx = ia.radiusX * Math.cos(ia.startAngle);
        const sy = ia.radiusY * Math.sin(ia.startAngle);
        const startX = sx * cosR - sy * sinR + ia.center.x;
        const startY = sx * sinR + sy * cosR + ia.center.y;
        const distStart = Math.sqrt(Math.pow(point.x - startX, 2) + Math.pow(point.y - startY, 2));
        if (distStart < minDistance && distStart < threshold) {
            minDistance = distStart;
            nearestPoint = { x: startX, y: startY };
        }

        const ex = ia.radiusX * Math.cos(ia.endAngle);
        const ey = ia.radiusY * Math.sin(ia.endAngle);
        const endX = ex * cosR - ey * sinR + ia.center.x;
        const endY = ex * sinR + ey * cosR + ia.center.y;
        const distEnd = Math.sqrt(Math.pow(point.x - endX, 2) + Math.pow(point.y - endY, 2));
        if (distEnd < minDistance && distEnd < threshold) {
            minDistance = distEnd;
            nearestPoint = { x: endX, y: endY };
        }
    }

    // Check standalone points (legacy or for items without direct attachment if needed)
    // Actually, we'll prefer checking items for helperPoints now.
    STATE.layers.forEach(layer => {
        if (!layer.visible) return;

        const checkPoints = (arr) => {
            arr.forEach(item => {
                if (item.helperPoints) {
                    item.helperPoints.forEach(p => {
                        const dist = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2));
                        if (dist < minDistance && dist < threshold) {
                            minDistance = dist;
                            nearestPoint = p;
                        }
                    });
                }
            });
        };

        checkPoints(layer.lines);
        checkPoints(layer.vpLines);
        checkPoints(layer.circles);
        checkPoints(layer.arcs);
        checkPoints(layer.ellipses);
        checkPoints(layer.isoArcs);
    });

    return nearestPoint;
}

function selectVPByDirection(startPoint, currentPoint) {
    if (STATE.vanishingPoints.length === 0) return null;

    // Use active VP if set and still exists in vanishingPoints array
    if (STATE.activeVP && STATE.vanishingPoints.includes(STATE.activeVP)) {
        return STATE.activeVP;
    }

    if (STATE.vanishingPoints.length === 1) return STATE.vanishingPoints[0];

    // Calculate drawing direction
    const drawDirection = {
        x: currentPoint.x - startPoint.x,
        y: currentPoint.y - startPoint.y
    };

    const drawLength = Math.sqrt(drawDirection.x * drawDirection.x + drawDirection.y * drawDirection.y);
    if (drawLength < CONFIG.MIN_DRAW_LENGTH_FOR_DIRECTION) return STATE.vanishingPoints[0]; // Too short to determine direction

    let bestVP = null;
    let bestAlignment = -Infinity;

    for (const vp of STATE.vanishingPoints) {
        const toVP = {
            x: vp.x - startPoint.x,
            y: vp.y - startPoint.y
        };

        // Dot product shows how well directions align
        const alignment = toVP.x * drawDirection.x + toVP.y * drawDirection.y;

        if (alignment > bestAlignment) {
            bestAlignment = alignment;
            bestVP = vp;
        }
    }

    return bestVP;
}

function calculateVPLine(startPoint, vp) {
    const dx = vp.x - startPoint.x;
    const dy = vp.y - startPoint.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { start: startPoint, end: startPoint };

    const maxDist = Math.max(UI.canvas.width, UI.canvas.height) * 2;
    const endPoint = {
        x: startPoint.x + (dx / len) * maxDist,
        y: startPoint.y + (dy / len) * maxDist
    };

    return { start: startPoint, end: endPoint };
}

function getVPRectCorners(p0, p1, p2 = null) {
    // Determine which point defines the direction toward VP
    const dirPoint = (p2 !== null) ? p2 : p1;
    const vp = selectVPByDirection(p0, dirPoint);
    if (!vp) return null;

    const intersectWithVertical = (pLine, vp, x) => {
        const dx = vp.x - pLine.x;
        const dy = vp.y - pLine.y;
        if (Math.abs(dx) < 0.001) return { x: x, y: pLine.y };
        const m = dy / dx;
        return { x: x, y: pLine.y + m * (x - pLine.x) };
    };

    if (p2 === null) {
        // Standard 2-point mode (p1 is corner)
        const C0 = p0;
        const C1 = intersectWithVertical(C0, vp, p1.x);
        const C2 = p1;
        const C3 = intersectWithVertical(C2, vp, p0.x);
        return [C0, C1, C2, C3];
    } else {
        // 3-point mode: p0-p1 is one edge, p2 sets the width
        const C0 = p0;
        const C1 = p1;
        const C2 = intersectWithVertical(C1, vp, p2.x);
        const C3 = intersectWithVertical(C0, vp, p2.x);
        return [C0, C1, C2, C3];
    }
}

function distanceToLine(px, py, p1, p2) {
    const A = px - p1.x;
    const B = py - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;
    if (param < 0) {
        xx = p1.x;
        yy = p1.y;
    } else if (param > 1) {
        xx = p2.x;
        yy = p2.y;
    } else {
        xx = p1.x + param * C;
        yy = p1.y + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

function isPointInRect(pt, start, end) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
}

function isShapeInMarquee(item, type, start, end) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    const checkPoint = (pt) => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;

    if (type === 'free' || type === 'vp') {
        const line = item;
        return checkPoint(line.start) && checkPoint(line.end);
    }

    const center = item.center;
    const a = item.radiusX || item.radius;
    const b = item.radiusY || item.radius;
    const phi = item.rotation || 0;

    if (type === 'circle' || type === 'ellipse') {
        const xExt = Math.sqrt(Math.pow(a * Math.cos(phi), 2) + Math.pow(b * Math.sin(phi), 2));
        const yExt = Math.sqrt(Math.pow(a * Math.sin(phi), 2) + Math.pow(b * Math.cos(phi), 2));
        return center.x - xExt >= minX && center.x + xExt <= maxX &&
            center.y - yExt >= minY && center.y + yExt <= maxY;
    }

    if (type === 'arc' || type === 'isoArc') {
        const getPt = (theta) => {
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            const cosP = Math.cos(phi);
            const sinP = Math.sin(phi);
            return {
                x: center.x + a * cosT * cosP - b * sinT * sinP,
                y: center.y + a * cosT * sinP + b * sinT * cosP
            };
        };

        // Check start and end
        if (!checkPoint(getPt(item.startAngle))) return false;
        if (!checkPoint(getPt(item.endAngle))) return false;

        // Check extrema angles
        const angles = [
            Math.atan2(-b * Math.sin(phi), a * Math.cos(phi)),
            Math.atan2(-b * Math.sin(phi), a * Math.cos(phi)) + Math.PI,
            Math.atan2(b * Math.cos(phi), a * Math.sin(phi)),
            Math.atan2(b * Math.cos(phi), a * Math.sin(phi)) + Math.PI
        ];

        for (let angle of angles) {
            if (isAngleInArc(angle, item)) {
                if (!checkPoint(getPt(angle))) return false;
            }
        }
        return true;
    }

    return false;
}

function isItemSelected(item, type) {
    return STATE.selectedItems.some(sel => (sel.line || sel.shape) === item && sel.type === type);
}

/**
 * Draws a thick highlight stroke for an item (selection or hover)
 */
function drawItemHighlight(ctx, item, type, color, isDashed = false) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (isDashed) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    if (type === 'circle') {
        ctx.lineWidth = (item.lineWidth || 2) + CONFIG.ERASER_HOVER_WIDTH_EXTRA;
        ctx.arc(item.center.x, item.center.y, item.radius, 0, Math.PI * 2);
    } else if (type === 'arc') {
        ctx.lineWidth = (item.lineWidth || 2) + CONFIG.ERASER_HOVER_WIDTH_EXTRA;
        ctx.arc(item.center.x, item.center.y, item.radius, item.startAngle, item.endAngle, item.anticlockwise);
    } else if (type === 'ellipse') {
        ctx.lineWidth = (item.lineWidth || 2) + CONFIG.ERASER_HOVER_WIDTH_EXTRA;
        ctx.ellipse(item.center.x, item.center.y, item.radiusX, item.radiusY, item.rotation, 0, Math.PI * 2);
    } else if (type === 'isoArc') {
        ctx.lineWidth = (item.lineWidth || 2) + CONFIG.ERASER_HOVER_WIDTH_EXTRA;
        ctx.ellipse(item.center.x, item.center.y, item.radiusX, item.radiusY, item.rotation, item.startAngle, item.endAngle, item.anticlockwise);
    } else {
        ctx.lineWidth = (item.lineWidth || 2) + CONFIG.ERASER_HOVER_WIDTH_EXTRA;
        ctx.moveTo(item.start.x, item.start.y);
        ctx.lineTo(item.end.x, item.end.y);
    }
    ctx.stroke();
    if (isDashed) ctx.setLineDash([]);
    ctx.restore();
}

/**
 * Deletes all currently selected items
 */
function deleteSelectedItems() {
    if (STATE.selectedItems.length === 0) return;

    const removedItems = [];

    // Sort by index descending to avoid index shifting problems during splice
    const sortedSelection = [...STATE.selectedItems].sort((a, b) => b.index - a.index);

    sortedSelection.forEach(sel => {
        const layer = STATE.layers.find(l => l.id === sel.layerId);
        if (!layer) return;

        let arr;
        if (sel.type === 'vp') arr = layer.vpLines;
        else if (sel.type === 'circle') arr = layer.circles;
        else if (sel.type === 'arc') arr = layer.arcs;
        else if (sel.type === 'ellipse') arr = layer.ellipses;
        else if (sel.type === 'isoArc') arr = layer.isoArcs;
        else if (sel.type === 'free') arr = layer.lines;
        else return;

        const item = sel.line || sel.shape;
        const idx = arr.indexOf(item);
        if (idx > -1) {
            arr.splice(idx, 1);
            removedItems.push({
                layerId: layer.id,
                type: sel.type,
                item: item,
                index: idx
            });
        }
    });

    if (removedItems.length > 0) {
        addAction({
            type: 'remove_multi',
            items: removedItems
        });
    }

    STATE.selectedItems = [];
    draw();
}

function copySelectedItems() {
    if (STATE.selectedItems.length === 0) return;
    STATE.clipboard = STATE.selectedItems.map(sel => {
        const item = sel.line || sel.shape;
        return {
            type: sel.type,
            item: JSON.parse(JSON.stringify(item))
        };
    });
}

function cutSelectedItems() {
    if (STATE.selectedItems.length === 0) return;
    copySelectedItems();
    deleteSelectedItems();
}

function pasteItems() {
    if (!STATE.clipboard || STATE.clipboard.length === 0) return;
    const activeLayer = getActiveLayer();
    if (!activeLayer) return;

    const addedItems = [];
    const offset = 30;

    STATE.clipboard.forEach(clipItem => {
        const newItem = JSON.parse(JSON.stringify(clipItem.item));

        if (clipItem.type === 'free' || clipItem.type === 'vp') {
            newItem.start.x += offset;
            newItem.start.y += offset;
            newItem.end.x += offset;
            newItem.end.y += offset;
        } else if (newItem.center) {
            newItem.center.x += offset;
            newItem.center.y += offset;
        }

        // Add to layer
        let arr;
        if (clipItem.type === 'free') arr = activeLayer.lines;
        else if (clipItem.type === 'vp') arr = activeLayer.vpLines;
        else if (clipItem.type === 'circle') arr = activeLayer.circles;
        else if (clipItem.type === 'arc') arr = activeLayer.arcs;
        else if (clipItem.type === 'ellipse') arr = activeLayer.ellipses;
        else if (clipItem.type === 'isoArc') arr = activeLayer.isoArcs;

        if (arr) {
            arr.push(newItem);
            addedItems.push({
                layerId: activeLayer.id,
                type: clipItem.type,
                item: newItem,
                index: arr.length - 1
            });
        }
    });

    if (addedItems.length > 0) {
        addAction({
            type: 'add_multi',
            items: addedItems
        });

        STATE.selectedItems = addedItems.map(ai => ({
            layerId: ai.layerId,
            type: ai.type,
            line: (ai.type === 'free' || ai.type === 'vp') ? ai.item : undefined,
            shape: (ai.type !== 'free' && ai.type !== 'vp') ? ai.item : undefined,
            index: ai.index
        }));
    }

    draw();
}

function getItemSnapHandle(item, type, mousePos) {
    if (type === 'free' || type === 'vp') {
        const dStart = Math.hypot(mousePos.x - item.start.x, mousePos.y - item.start.y);
        const dEnd = Math.hypot(mousePos.x - item.end.x, mousePos.y - item.end.y);
        return dStart < dEnd ? { ...item.start } : { ...item.end };
    }
    if (type === 'circle' || type === 'ellipse') {
        return { ...item.center };
    }
    if (type === 'arc' || type === 'isoArc') {
        const center = item.center;
        let start, end;
        if (type === 'arc') {
            start = {
                x: center.x + Math.cos(item.startAngle) * item.radius,
                y: center.y + Math.sin(item.startAngle) * item.radius
            };
            end = {
                x: center.x + Math.cos(item.endAngle) * item.radius,
                y: center.y + Math.sin(item.endAngle) * item.radius
            };
        } else {
            const cosR = Math.cos(item.rotation);
            const sinR = Math.sin(item.rotation);
            const getPt = (ang) => {
                const sx = item.radiusX * Math.cos(ang);
                const sy = item.radiusY * Math.sin(ang);
                return {
                    x: sx * cosR - sy * sinR + center.x,
                    y: sx * sinR + sy * cosR + center.y
                };
            };
            start = getPt(item.startAngle);
            end = getPt(item.endAngle);
        }
        const dCenter = Math.hypot(mousePos.x - center.x, mousePos.y - center.y);
        const dStart = Math.hypot(mousePos.x - start.x, mousePos.y - start.y);
        const dEnd = Math.hypot(mousePos.x - end.x, mousePos.y - end.y);
        const min = Math.min(dCenter, dStart, dEnd);
        if (min === dCenter) return { ...center };
        if (min === dStart) return { ...start };
        return { ...end };
    }
    return { ...mousePos };
}

function findLineAtPoint(x, y, threshold = CONFIG.SNAP_RADIUS_PIXELS / STATE.zoomLevel) {
    let closestLine = null;
    let closestDistance = Infinity;

    // Check all layers (reverse order to check top layer first)
    for (let layerIdx = STATE.layers.length - 1; layerIdx >= 0; layerIdx--) {
        const layer = STATE.layers[layerIdx];
        if (!layer.visible) continue;

        for (let i = layer.vpLines.length - 1; i >= 0; i--) {
            const dist = distanceToLine(x, y, layer.vpLines[i].start, layer.vpLines[i].end);
            if (dist < threshold && dist < closestDistance) {
                closestDistance = dist;
                closestLine = { line: layer.vpLines[i], type: 'vp', index: i, layerId: layer.id };
            }
        }

        if (layer.circles) {
            for (let i = layer.circles.length - 1; i >= 0; i--) {
                const circle = layer.circles[i];
                const distToCenter = Math.sqrt(Math.pow(x - circle.center.x, 2) + Math.pow(y - circle.center.y, 2));
                const dist = Math.abs(distToCenter - circle.radius);
                if (dist < threshold && dist < closestDistance) {
                    closestDistance = dist;
                    closestLine = { shape: circle, type: 'circle', index: i, layerId: layer.id };
                }
            }
        }

        if (layer.arcs) {
            for (let i = layer.arcs.length - 1; i >= 0; i--) {
                const arc = layer.arcs[i];
                const distToCenter = Math.sqrt(Math.pow(x - arc.center.x, 2) + Math.pow(y - arc.center.y, 2));
                const distToCircle = Math.abs(distToCenter - arc.radius);

                if (distToCircle < threshold) {
                    const angle = Math.atan2(y - arc.center.y, x - arc.center.x);
                    if (isAngleInArc(angle, arc) && distToCircle < closestDistance) {
                        closestDistance = distToCircle;
                        closestLine = { shape: arc, type: 'arc', index: i, layerId: layer.id };
                    }
                }
            }
        }

        if (layer.ellipses) {
            for (let i = layer.ellipses.length - 1; i >= 0; i--) {
                const el = layer.ellipses[i];
                // Local coordinates
                const dx = x - el.center.x;
                const dy = y - el.center.y;
                const localX = dx * Math.cos(-el.rotation) - dy * Math.sin(-el.rotation);
                const localY = dx * Math.sin(-el.rotation) + dy * Math.cos(-el.rotation);

                const distRatio = Math.sqrt(Math.pow(localX / el.radiusX, 2) + Math.pow(localY / el.radiusY, 2));
                const dist = Math.abs(distRatio - 1) * Math.min(el.radiusX, el.radiusY);

                if (dist < threshold && dist < closestDistance) {
                    closestDistance = dist;
                    closestLine = { shape: el, type: 'ellipse', index: i, layerId: layer.id };
                }
            }
        }

        if (layer.isoArcs) {
            for (let i = layer.isoArcs.length - 1; i >= 0; i--) {
                const ia = layer.isoArcs[i];
                const dx = x - ia.center.x;
                const dy = y - ia.center.y;
                const localX = dx * Math.cos(-ia.rotation) - dy * Math.sin(-ia.rotation);
                const localY = dx * Math.sin(-ia.rotation) + dy * Math.cos(-ia.rotation);

                const theta = Math.atan2(localY / ia.radiusY, localX / ia.radiusX);
                const distRatio = Math.sqrt(Math.pow(localX / ia.radiusX, 2) + Math.pow(localY / ia.radiusY, 2));
                const dist = Math.abs(distRatio - 1) * Math.min(ia.radiusX, ia.radiusY);

                if (dist < threshold) {
                    let inside = isAngleInArc(theta, ia);

                    if (inside && dist < closestDistance) {
                        closestDistance = dist;
                        closestLine = { shape: ia, type: 'isoArc', index: i, layerId: layer.id };
                    }
                }
            }
        }

        for (let i = layer.lines.length - 1; i >= 0; i--) {
            const dist = distanceToLine(x, y, layer.lines[i].start, layer.lines[i].end);
            if (dist < threshold && dist < closestDistance) {
                closestDistance = dist;
                closestLine = { line: layer.lines[i], type: 'free', index: i, layerId: layer.id };
            }
        }
    }

    return closestLine;
}


/**
 * Find fill at given point (returns {layerId, fillIndex})
 */
function findFillAtPoint(x, y) {
    if (!STATE.fillIndexMap) return null;
    const w = UI.canvas.width;
    // Map world (x,y) to screen (sx, sy)
    const sx = x * STATE.zoomLevel + STATE.panX;
    const sy = y * STATE.zoomLevel + STATE.panY;
    const idx = Math.floor(sy) * w + Math.floor(sx);
    if (idx < 0 || idx >= STATE.fillIndexMap.length) return null;
    const fillData = STATE.fillIndexMap[idx];
    return fillData || null;
}


/**
 * Snap a point on a line (defined by start and dir) to the nearest 2D grid line intersection
 */
function snapPointToGridLines(startPoint, pointOnLine, dirX, dirY) {
    const gridSize = STATE.gridSize2D;
    let candidates = [];

    if (Math.abs(dirX) > CONFIG.EPSILON) {
        const nearestVerticalX = Math.round(pointOnLine.x / gridSize) * gridSize;
        const t = (nearestVerticalX - startPoint.x) / dirX;
        const candidatePoint = {
            x: nearestVerticalX,
            y: startPoint.y + t * dirY
        };
        candidates.push(candidatePoint);
    }

    if (Math.abs(dirY) > CONFIG.EPSILON) {
        const nearestHorizontalY = Math.round(pointOnLine.y / gridSize) * gridSize;
        const t = (nearestHorizontalY - startPoint.y) / dirY;
        const candidatePoint = {
            x: startPoint.x + t * dirX,
            y: nearestHorizontalY
        };
        candidates.push(candidatePoint);
    }

    // 3. Choose the candidate closest to pointOnLine
    let bestPoint = pointOnLine;
    let minDist = Infinity;

    // If no candidates (e.g. 0 length vector), return original
    if (candidates.length === 0) return pointOnLine;

    candidates.forEach(p => {
        const dist = Math.sqrt(Math.pow(p.x - pointOnLine.x, 2) + Math.pow(p.y - pointOnLine.y, 2));
        if (dist < minDist) {
            minDist = dist;
            bestPoint = p;
        }
    });

    return bestPoint;
}

/**
 * Snap end point to grid line along the direction towards VP
 * The point should be snapped to the nearest horizontal or vertical grid line
 * that lies along the direction from start to mouse position
 */
function snapEndPointToGridLine(startPoint, currentMousePos, vp, shouldSnap = true) {
    // Calculate direction towards VP
    const dx = vp.x - startPoint.x;
    const dy = vp.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return startPoint;

    // Normalize direction
    const dirX = dx / length;
    const dirY = dy / length;

    // Calculate how far along the VP direction the mouse is
    const mouseFromStart = {
        x: currentMousePos.x - startPoint.x,
        y: currentMousePos.y - startPoint.y
    };

    // Project mouse position onto the VP direction line
    const projectionLength = (mouseFromStart.x * dirX + mouseFromStart.y * dirY);

    // Calculate the point along the VP direction
    const pointAlongVP = {
        x: startPoint.x + dirX * projectionLength,
        y: startPoint.y + dirY * projectionLength
    };

    if (!shouldSnap) return pointAlongVP;

    const gridSize = STATE.gridSize2D;

    // Find nearest horizontal and vertical grid lines
    const nearestVerticalX = Math.round(pointAlongVP.x / gridSize) * gridSize;
    const nearestHorizontalY = Math.round(pointAlongVP.y / gridSize) * gridSize;

    // Calculate distances to these grid lines
    const distToVertical = Math.abs(pointAlongVP.x - nearestVerticalX);
    const distToHorizontal = Math.abs(pointAlongVP.y - nearestHorizontalY);

    let snappedPoint;
    if (distToVertical < distToHorizontal) {
        // Snap to vertical grid line
        const t = (nearestVerticalX - startPoint.x) / dirX;
        snappedPoint = {
            x: nearestVerticalX,
            y: startPoint.y + dirY * t
        };
    } else {
        // Snap to horizontal grid line
        const t = (nearestHorizontalY - startPoint.y) / dirY;
        snappedPoint = {
            x: startPoint.x + dirX * t,
            y: nearestHorizontalY
        };
    }

    return snappedPoint;
}

function lineIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < CONFIG.EPSILON) return null;

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y)
        };
    }
    return null;
}

function lineCircleIntersections(p1, p2, center, radius) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const fx = p1.x - center.x;
    const fy = p1.y - center.y;

    const a = dx * dx + dy * dy;
    if (a < CONFIG.EPSILON) return []; // Ignore zero-length segments

    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - radius * radius;

    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];

    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);

    const hits = [];
    // Small epsilon for segment boundaries
    if (t1 >= -0.001 && t1 <= 1.001) hits.push({ x: p1.x + t1 * dx, y: p1.y + t1 * dy });
    if (t2 >= -0.001 && t2 <= 1.001) hits.push({ x: p1.x + t2 * dx, y: p1.y + t2 * dy });
    return hits;
}

function circleCircleIntersections(c1, r1, c2, r2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > r1 + r2 || d < Math.abs(r1 - r2) || d === 0) return [];

    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const x2 = c1.x + a * (c2.x - c1.x) / d;
    const y2 = c1.y + a * (c2.y - c1.y) / d;

    const hits = [
        { x: x2 + h * (c2.y - c1.y) / d, y: y2 - h * (c2.x - c1.x) / d },
        { x: x2 - h * (c2.y - c1.y) / d, y: y2 + h * (c2.x - c1.x) / d }
    ];
    if (Math.abs(hits[0].x - hits[1].x) < 0.1 && Math.abs(hits[0].y - hits[1].y) < 0.1) return [hits[0]];
    return hits;
}

function lineEllipseIntersections(p1, p2, center, rx, ry, rotation) {
    const cosR = Math.cos(-rotation);
    const sinR = Math.sin(-rotation);

    const transform = (p) => {
        const tx = p.x - center.x;
        const ty = p.y - center.y;
        return {
            x: (tx * cosR - ty * sinR) / rx,
            y: (tx * sinR + ty * cosR) / ry
        };
    };

    const lp1 = transform(p1);
    const lp2 = transform(p2);

    const hits = lineCircleIntersections(lp1, lp2, { x: 0, y: 0 }, 1);

    const cosR_back = Math.cos(rotation);
    const sinR_back = Math.sin(rotation);

    return hits.map(pt => {
        const x_sc = pt.x * rx;
        const y_sc = pt.y * ry;
        return {
            x: x_sc * cosR_back - y_sc * sinR_back + center.x,
            y: x_sc * sinR_back + y_sc * cosR_back + center.y
        };
    });
}

function circleEllipseIntersections(cCenter, cRadius, eCenter, rx, ry, rotation) {
    const hits = [];
    const segments = 64;
    let prevPt = null;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);

        const px = (rx * cosT) * cosR - (ry * sinT) * sinR + eCenter.x;
        const py = (rx * cosT) * sinR + (ry * sinT) * cosR + eCenter.y;
        const pt = { x: px, y: py };

        if (prevPt) {
            const lineHits = lineCircleIntersections(prevPt, pt, cCenter, cRadius);
            hits.push(...lineHits);
        }
        prevPt = pt;
    }
    return hits;
}

function ellipseEllipseIntersections(c1, rx1, ry1, rot1, c2, rx2, ry2, rot2) {
    const hits = [];
    const segments = 256; // Increased for maximum accuracy with ellipse-ellipse intersections
    let prevPt = null;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const cosR = Math.cos(rot1);
        const sinR = Math.sin(rot1);

        const px = (rx1 * cosT) * cosR - (ry1 * sinT) * sinR + c1.x;
        const py = (rx1 * cosT) * sinR + (ry1 * sinT) * cosR + c1.y;
        const pt = { x: px, y: py };

        if (prevPt) {
            const lineHits = lineEllipseIntersections(prevPt, pt, c2, rx2, ry2, rot2);
            hits.push(...lineHits);
        }
        prevPt = pt;
    }

    prevPt = null;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const cosR = Math.cos(rot2);
        const sinR = Math.sin(rot2);

        const px = (rx2 * cosT) * cosR - (ry2 * sinT) * sinR + c2.x;
        const py = (rx2 * cosT) * sinR + (ry2 * sinT) * cosR + c2.y;
        const pt = { x: px, y: py };

        if (prevPt) {
            const lineHits = lineEllipseIntersections(prevPt, pt, c1, rx1, ry1, rot1);
            hits.push(...lineHits);
        }
        prevPt = pt;
    }

    const uniqueHits = [];
    for (const hit of hits) {
        const isDuplicate = uniqueHits.some(h => {
            const dist = Math.sqrt((h.x - hit.x) ** 2 + (h.y - hit.y) ** 2);
            return dist < 2.0; // 2 pixel tolerance to avoid removing legitimate intersections
        });
        if (!isDuplicate) {
            uniqueHits.push(hit);
        }
    }

    return uniqueHits;
}

function isAngleInArc(angle, arc) {
    if (!Number.isFinite(angle)) return false;
    const s = normalizeAngle(arc.startAngle);
    const e = normalizeAngle(arc.endAngle);
    const a = normalizeAngle(angle);
    const EPS = 0.001;

    let inside = false;
    if (s < e) inside = (a >= s - EPS && a <= e + EPS);
    else inside = (a >= s - EPS || a <= e + EPS);

    return arc.anticlockwise ? !inside : inside;
}

function getItemIntersections(item1, type1, item2, type2) {
    let hits = [];
    const isLinear = t => t === 'free' || t === 'vp';
    const isCircular = t => t === 'circle' || t === 'arc';
    const isElliptical = t => t === 'ellipse' || t === 'isoArc';

    if (isLinear(type1)) {
        if (isLinear(type2)) {
            const hit = lineIntersection(item1.start, item1.end, item2.start, item2.end);
            if (hit) hits.push(hit);
        } else if (isCircular(type2)) {
            hits = lineCircleIntersections(item1.start, item1.end, item2.center, item2.radius);
        } else if (isElliptical(type2)) {
            hits = lineEllipseIntersections(item1.start, item1.end, item2.center, item2.radiusX, item2.radiusY, item2.rotation);
        }
    } else if (isCircular(type1)) {
        if (isLinear(type2)) {
            hits = lineCircleIntersections(item2.start, item2.end, item1.center, item1.radius);
        } else if (isCircular(type2)) {
            hits = circleCircleIntersections(item1.center, item1.radius, item2.center, item2.radius);
        } else if (isElliptical(type2)) {
            hits = circleEllipseIntersections(item1.center, item1.radius, item2.center, item2.radiusX, item2.radiusY, item2.rotation);
        }
    } else if (isElliptical(type1)) {
        if (isLinear(type2)) {
            hits = lineEllipseIntersections(item2.start, item2.end, item1.center, item1.radiusX, item1.radiusY, item1.rotation);
        } else if (isCircular(type2)) {
            hits = circleEllipseIntersections(item2.center, item2.radius, item1.center, item1.radiusX, item1.radiusY, item1.rotation);
        } else if (isElliptical(type2)) {
            hits = ellipseEllipseIntersections(item1.center, item1.radiusX, item1.radiusY, item1.rotation, item2.center, item2.radiusX, item2.radiusY, item2.rotation);
        }
    }

    const filterArc = (hs, it, t) => {
        if (t === 'arc') return hs.filter(h => isAngleInArc(Math.atan2(h.y - it.center.y, h.x - it.center.x), it));
        if (t === 'isoArc') return hs.filter(h => {
            const dx = h.x - it.center.x;
            const dy = h.y - it.center.y;
            const lx = dx * Math.cos(-it.rotation) - dy * Math.sin(-it.rotation);
            const ly = dx * Math.sin(-it.rotation) + dy * Math.cos(-it.rotation);
            return isAngleInArc(Math.atan2(ly / it.radiusY, lx / it.radiusX), it);
        });
        return hs;
    };
    hits = filterArc(hits, item1, type1);
    hits = filterArc(hits, item2, type2);
    return hits;
}

function getTrimIntersections(target, targetType) {
    let intersections = [];
    if (STATE.cuttingBlades.length > 0) {
        STATE.cuttingBlades.forEach(blade => {
            const hits = getItemIntersections(target, targetType, blade.item, blade.type);
            intersections.push(...hits);
        });
    } else {
        STATE.layers.forEach(l => {
            const checkEach = (arr, type) => {
                arr.forEach(item => {
                    if (item === target) return;
                    intersections.push(...getItemIntersections(target, targetType, item, type));
                });
            };
            checkEach(l.lines, 'free');
            checkEach(l.vpLines, 'vp');
            checkEach(l.circles, 'circle');
            checkEach(l.arcs, 'arc');
            checkEach(l.ellipses, 'ellipse');
            checkEach(l.isoArcs, 'isoArc');
        });
    }
    return intersections;
}

function performTrim(found, clickPos) {
    const target = found.line || found.shape;
    const targetType = found.type;
    const layer = STATE.layers.find(l => l.id === found.layerId);
    if (!layer) return;

    let intersections = getTrimIntersections(target, targetType);

    if (intersections.length === 0) {
        return;
    }

    const getParam = (pt) => {
        if (targetType === 'free' || targetType === 'vp') {
            const dx = target.end.x - target.start.x;
            const dy = target.end.y - target.start.y;
            const d2 = dx * dx + dy * dy;
            if (d2 === 0) return 0;
            return ((pt.x - target.start.x) * dx + (pt.y - target.start.y) * dy) / d2;
        } else if (targetType === 'circle' || targetType === 'arc') {
            return normalizeAngle(Math.atan2(pt.y - target.center.y, pt.x - target.center.x));
        } else if (targetType === 'ellipse' || targetType === 'isoArc') {
            const dx = pt.x - target.center.x;
            const dy = pt.y - target.center.y;
            const lx = dx * Math.cos(-target.rotation) - dy * Math.sin(-target.rotation);
            const ly = dx * Math.sin(-target.rotation) + dy * Math.cos(-target.rotation);
            return normalizeAngle(Math.atan2(ly / target.radiusY, lx / target.radiusX));
        }
        return 0;
    };

    let params = intersections.map(getParam);
    const clickParam = getParam(clickPos);

    // Deduplicate params that are extremely close
    const EPS = 1e-7;
    params.sort((a, b) => a - b);
    params = params.filter((p, i) => i === 0 || Math.abs(p - params[i - 1]) > EPS);

    let segments = [];
    if (targetType === 'free' || targetType === 'vp') {
        params = params.filter(p => p > 0.001 && p < 1 - 0.001);
        let pts = [0, ...params, 1];
        for (let i = 0; i < pts.length - 1; i++) {
            if (clickParam >= pts[i] - EPS && clickParam <= pts[i + 1] + EPS) continue;
            segments.push({ start: pts[i], end: pts[i + 1] });
        }
    } else {
        // Circular / Elliptical
        let startBound = 0, endBound = Math.PI * 2;
        if (targetType === 'arc' || targetType === 'isoArc') {
            startBound = normalizeAngle(target.startAngle);
            endBound = normalizeAngle(target.endAngle);
        }

        const isClosed = (targetType === 'circle' || targetType === 'ellipse');

        if (isClosed) {
            if (params.length === 0) return; // Should not happen given check above
            // Closed loop with N intersections creates N segments
            for (let i = 0; i < params.length; i++) {
                let p1 = params[i];
                let p2 = params[(i + 1) % params.length];

                let inSeg = false;
                if (p1 < p2) inSeg = (clickParam >= p1 - EPS && clickParam <= p2 + EPS);
                else inSeg = (clickParam >= p1 - EPS || clickParam <= p2 + EPS);

                if (!inSeg) segments.push({ s: p1, e: p2 });
            }
        } else {
            // Open arc
            let validParams = params.filter(p => isAngleInArc(p, target));
            // Also exclude params too close to boundaries
            const dir = target.anticlockwise ? -1 : 1;
            validParams = validParams.filter(p => {
                const dStart = normalizeAngle(dir * (p - startBound));
                const dEnd = normalizeAngle(dir * (endBound - p));
                return dStart > EPS && dEnd > EPS;
            });

            let pts = [startBound, ...validParams, endBound];

            // Re-sort pts starting from startBound in arc direction
            pts = pts.map(p => ({ p, d: normalizeAngle(dir * (p - startBound)) })).sort((a, b) => a.d - b.d).map(o => o.p);

            for (let i = 0; i < pts.length - 1; i++) {
                let p1 = pts[i];
                let p2 = pts[i + 1];
                let inSeg = false;
                let dTarget = normalizeAngle(dir * (clickParam - p1));
                let dSeg = normalizeAngle(dir * (p2 - p1));
                if (dTarget <= dSeg + EPS) inSeg = true;
                if (!inSeg) segments.push({ s: p1, e: p2 });
            }
        }
    }

    const removeIdx = found.index;
    let targetArr;
    if (targetType === 'vp') targetArr = layer.vpLines;
    else if (targetType === 'circle') targetArr = layer.circles;
    else if (targetType === 'arc') targetArr = layer.arcs;
    else if (targetType === 'ellipse') targetArr = layer.ellipses;
    else if (targetType === 'isoArc') targetArr = layer.isoArcs;
    else targetArr = layer.lines;

    const original = targetArr[removeIdx];
    targetArr.splice(removeIdx, 1);

    const adds = segments.map(seg => {
        let newItem;
        let lineType, shapeType;
        if (targetType === 'free' || targetType === 'vp') {
            newItem = {
                ...target,
                start: {
                    x: target.start.x + (target.end.x - target.start.x) * seg.start,
                    y: target.start.y + (target.end.y - target.start.y) * seg.start
                },
                end: {
                    x: target.start.x + (target.end.x - target.start.x) * seg.end,
                    y: target.start.y + (target.end.y - target.start.y) * seg.end
                }
            };
            if (targetType === 'vp') { layer.vpLines.push(newItem); lineType = 'vp'; }
            else { layer.lines.push(newItem); lineType = 'free'; }
        } else if (targetType === 'circle' || targetType === 'arc') {
            newItem = {
                ...target,
                startAngle: seg.s,
                endAngle: seg.e,
                anticlockwise: (targetType === 'arc' ? target.anticlockwise : false)
            };
            layer.arcs.push(newItem);
            shapeType = 'arc';
        } else if (targetType === 'ellipse' || targetType === 'isoArc') {
            newItem = {
                ...target,
                startAngle: seg.s,
                endAngle: seg.e,
                anticlockwise: (targetType === 'isoArc' ? target.anticlockwise : false)
            };
            layer.isoArcs.push(newItem);
            shapeType = 'isoArc';
        }

        return {
            layerId: layer.id,
            line: lineType ? newItem : undefined,
            shape: shapeType ? newItem : undefined,
            lineType,
            shapeType
        };
    });

    addAction({
        type: 'remove_and_add_multi',
        remove: {
            layerId: layer.id,
            type: targetType,
            item: original,
            index: removeIdx
        },
        adds: adds
    });

    STATE.hoveredLine = null;
    draw();
}


async function performSplit(found) {
    const target = found.line || found.shape;
    const type = found.type;
    const layer = STATE.layers.find(l => l.id === found.layerId);
    if (!layer) return;

    const res = await showSplitDialog(target.helperPoints && target.helperPoints.length > 0);
    if (res === null) return;

    if (res.action === 'clear') {
        const oldPoints = [...(target.helperPoints || [])];
        target.helperPoints = [];
        addAction({
            type: 'clear_points',
            layerId: layer.id,
            item: target,
            itemType: found.type,
            points: oldPoints
        });
        draw();
        return;
    }

    const n = res.n;
    if (isNaN(n) || n < 2) return;

    if (type === 'circle' || type === 'ellipse') {
        STATE.splitSelection = {
            found,
            n,
            mode: res.mode
        };
        draw();
        return;
    }

    executeSplit(found, n, res.mode);
}

function executeSplit(found, n, mode, startPoint = null) {
    const target = found.line || found.shape;
    const type = found.type;
    const layer = STATE.layers.find(l => l.id === found.layerId);
    if (!layer) return;

    let startAngleOffset = 0;
    if (startPoint && (type === 'circle' || type === 'ellipse')) {
        if (type === 'circle') {
            startAngleOffset = Math.atan2(startPoint.y - target.center.y, startPoint.x - target.center.x);
        } else {
            // For ellipse, calculate parametric theta
            const dx = startPoint.x - target.center.x;
            const dy = startPoint.y - target.center.y;
            const cosR = Math.cos(-target.rotation);
            const sinR = Math.sin(-target.rotation);
            const lx = dx * cosR - dy * sinR;
            const ly = dx * sinR + dy * cosR;
            startAngleOffset = Math.atan2(ly / target.radiusY, lx / target.radiusX);
        }
    }

    if (mode === 'points') {
        const addedPoints = [];
        if (type === 'free' || type === 'vp') {
            for (let i = 1; i < n; i++) {
                addedPoints.push({
                    x: target.start.x + (target.end.x - target.start.x) * (i / n),
                    y: target.start.y + (target.end.y - target.start.y) * (i / n)
                });
            }
        } else if (type === 'circle' || type === 'ellipse') {
            for (let i = 0; i < n; i++) {
                const ang = startAngleOffset + (i / n) * Math.PI * 2;
                if (type === 'circle') {
                    addedPoints.push({
                        x: target.center.x + Math.cos(ang) * target.radius,
                        y: target.center.y + Math.sin(ang) * target.radius
                    });
                } else {
                    const cosR = Math.cos(target.rotation);
                    const sinR = Math.sin(target.rotation);
                    const px = target.radiusX * Math.cos(ang);
                    const py = target.radiusY * Math.sin(ang);
                    addedPoints.push({
                        x: px * cosR - py * sinR + target.center.x,
                        y: px * sinR + py * cosR + target.center.y
                    });
                }
            }
        } else if (type === 'arc' || type === 'isoArc') {
            const ccw = target.anticlockwise;
            let diff = normalizeAngle(ccw ? target.startAngle - target.endAngle : target.endAngle - target.startAngle);
            if (diff === 0) diff = Math.PI * 2;
            for (let i = 1; i < n; i++) {
                const ang = target.startAngle + (ccw ? -1 : 1) * (i / n) * diff;
                if (type === 'arc') {
                    addedPoints.push({
                        x: target.center.x + Math.cos(ang) * target.radius,
                        y: target.center.y + Math.sin(ang) * target.radius
                    });
                } else {
                    const cosR = Math.cos(target.rotation);
                    const sinR = Math.sin(target.rotation);
                    const px = target.radiusX * Math.cos(ang);
                    const py = target.radiusY * Math.sin(ang);
                    addedPoints.push({
                        x: px * cosR - py * sinR + target.center.x,
                        y: px * sinR + py * cosR + target.center.y
                    });
                }
            }
        }

        if (addedPoints.length > 0) {
            if (!target.helperPoints) target.helperPoints = [];
            target.helperPoints.push(...addedPoints);
            addAction({
                type: 'add_helper_points',
                layerId: layer.id,
                item: target,
                itemType: found.type,
                points: addedPoints
            });
            STATE.showPoints = true; // Automatically show points
            if (UI.showPointsToggle) UI.showPointsToggle.checked = true;
        }
    } else {
        const addedItems = [];
        if (type === 'free' || type === 'vp') {
            const p1 = target.start;
            const p2 = target.end;
            for (let i = 0; i < n; i++) {
                const start = {
                    x: p1.x + (p2.x - p1.x) * (i / n),
                    y: p1.y + (p2.y - p1.y) * (i / n)
                };
                const end = {
                    x: p1.x + (p2.x - p1.x) * ((i + 1) / n),
                    y: p1.y + (p2.y - p1.y) * ((i + 1) / n)
                };
                addedItems.push({ type, item: { ...target, start, end } });
            }
        } else if (type === 'circle' || type === 'ellipse') {
            const isCircle = type === 'circle';
            for (let i = 0; i < n; i++) {
                const s = startAngleOffset + (i / n) * Math.PI * 2;
                const e = startAngleOffset + ((i + 1) / n) * Math.PI * 2;
                if (isCircle) {
                    addedItems.push({
                        type: 'arc',
                        item: {
                            center: { ...target.center },
                            radius: target.radius,
                            startAngle: normalizeAngle(s),
                            endAngle: normalizeAngle(e),
                            anticlockwise: false,
                            color: target.color,
                            lineWidth: target.lineWidth
                        }
                    });
                } else {
                    addedItems.push({
                        type: 'isoArc',
                        item: {
                            center: { ...target.center },
                            radiusX: target.radiusX,
                            radiusY: target.radiusY,
                            rotation: target.rotation,
                            startAngle: normalizeAngle(s),
                            endAngle: normalizeAngle(e),
                            anticlockwise: false,
                            color: target.color,
                            lineWidth: target.lineWidth
                        }
                    });
                }
            }
        } else if (type === 'arc' || type === 'isoArc') {
            const isArc = type === 'arc';
            const startA = target.startAngle;
            const endA = target.endAngle;
            const ccw = target.anticlockwise;
            let diff = normalizeAngle(ccw ? startA - endA : endA - startA);
            if (diff === 0) diff = Math.PI * 2;

            for (let i = 0; i < n; i++) {
                const s = startA + (ccw ? -1 : 1) * (i / n) * diff;
                const e = startA + (ccw ? -1 : 1) * ((i + 1) / n) * diff;
                if (isArc) {
                    addedItems.push({
                        type: 'arc',
                        item: {
                            ...target,
                            startAngle: normalizeAngle(s),
                            endAngle: normalizeAngle(e)
                        }
                    });
                } else {
                    addedItems.push({
                        type: 'isoArc',
                        item: {
                            ...target,
                            startAngle: normalizeAngle(s),
                            endAngle: normalizeAngle(e)
                        }
                    });
                }
            }
        }

        const arrIdx = found.index;
        let targetArr;
        if (type === 'vp') targetArr = layer.vpLines;
        else if (type === 'circle') targetArr = layer.circles;
        else if (type === 'arc') targetArr = layer.arcs;
        else if (type === 'ellipse') targetArr = layer.ellipses;
        else if (type === 'isoArc') targetArr = layer.isoArcs;
        else targetArr = layer.lines;

        const original = targetArr[arrIdx];
        targetArr.splice(arrIdx, 1);

        const adds = addedItems.map(ai => {
            let lArr;
            if (ai.type === 'vp') lArr = layer.vpLines;
            else if (ai.type === 'free') lArr = layer.lines;
            else if (ai.type === 'circle') lArr = layer.circles;
            else if (ai.type === 'arc') lArr = layer.arcs;
            else if (ai.type === 'ellipse') lArr = layer.ellipses;
            else if (ai.type === 'isoArc') lArr = layer.isoArcs;
            lArr.push(ai.item);

            return {
                layerId: layer.id,
                line: (ai.type === 'free' || ai.type === 'vp') ? ai.item : undefined,
                shape: (ai.type !== 'free' && ai.type !== 'vp') ? ai.item : undefined,
                lineType: (ai.type === 'free' || ai.type === 'vp') ? ai.type : undefined,
                shapeType: (ai.type !== 'free' && ai.type !== 'vp') ? ai.type : undefined
            };
        });

        addAction({
            type: 'remove_and_add_multi',
            remove: {
                layerId: layer.id,
                type: type,
                item: original,
                index: arrIdx
            },
            adds: adds
        });
    }

    STATE.hoveredLine = null;
    STATE.splitSelection = null;
    draw();
}


function drawMeasurement(ctx, start, end) {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const length = Math.sqrt(dx * dx + dy * dy);

    // Choose font
    ctx.save();
    ctx.setLineDash([]);
    ctx.font = 'bold 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text = `X: ${Math.round(dx)} Y: ${Math.round(dy)} L: ${Math.round(length)}`;
    const metrics = ctx.measureText(text);
    const padding = 6;
    const rectW = metrics.width + padding * 2;
    const rectH = 18 + padding;

    // Position label near the midpoint but offset significantly
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;

    // Offset label so it doesn't overlap line or cursor
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    // Increase offset to keep clear of line and cursor
    // 40px offset perpendicular to the line
    const offset = 40;

    // We want the label to stay away from the mouse cursor (end point)
    // If the line is short, we offset it even further or along the line
    let labelX, labelY;
    if (length < 60) {
        // For short lines, place it "above" the whole thing relative to the screen
        labelX = midX;
        labelY = Math.min(start.y, end.y) - 30;
    } else {
        // For longer lines, offset perpendicular
        labelX = midX + Math.cos(angle - Math.PI / 2) * offset;
        labelY = midY + Math.sin(angle - Math.PI / 2) * offset;
    }

    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(labelX - rectW / 2, labelY - rectH / 2, rectW, rectH, 6);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#0052cc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw text
    ctx.fillStyle = '#172b4d';
    ctx.fillText(text, labelX, labelY);

    ctx.restore();
}
function getTrimSegment(target, targetType, clickPos) {
    let intersections = getTrimIntersections(target, targetType);
    if (intersections.length === 0) return null;

    const getParam = (pt) => {
        if (targetType === 'free' || targetType === 'vp') {
            const dx = target.end.x - target.start.x;
            const dy = target.end.y - target.start.y;
            const d2 = dx * dx + dy * dy;
            if (d2 === 0) return 0;
            return ((pt.x - target.start.x) * dx + (pt.y - target.start.y) * dy) / d2;
        } else if (targetType === 'circle' || targetType === 'arc') {
            return normalizeAngle(Math.atan2(pt.y - target.center.y, pt.x - target.center.x));
        } else if (targetType === 'ellipse' || targetType === 'isoArc') {
            const dx = pt.x - target.center.x;
            const dy = pt.y - target.center.y;
            const lx = dx * Math.cos(-target.rotation) - dy * Math.sin(-target.rotation);
            const ly = dx * Math.sin(-target.rotation) + dy * Math.cos(-target.rotation);
            return normalizeAngle(Math.atan2(ly / target.radiusY, lx / target.radiusX));
        }
        return 0;
    };

    let params = intersections.map(getParam);
    const clickParam = getParam(clickPos);

    // Deduplicate params
    const EPS = 1e-7;
    params.sort((a, b) => a - b);
    params = params.filter((p, i) => i === 0 || Math.abs(p - params[i - 1]) > EPS);

    if (targetType === 'free' || targetType === 'vp') {
        params = params.filter(p => p > 0.001 && p < 0.999).sort((a, b) => a - b);
        let pts = [0, ...params, 1];
        for (let i = 0; i < pts.length - 1; i++) {
            if (clickParam >= pts[i] && clickParam <= pts[i + 1]) {
                return { s: pts[i], e: pts[i + 1] };
            }
        }
    } else {
        params = params.sort((a, b) => a - b);
        let startBound = 0, endBound = Math.PI * 2;
        const anticlockwise = (targetType === 'arc' || targetType === 'isoArc') ? !!target.anticlockwise : false;

        if (targetType === 'arc' || targetType === 'isoArc') {
            startBound = normalizeAngle(target.startAngle);
            endBound = normalizeAngle(target.endAngle);
        }

        const isClosed = (targetType === 'circle' || targetType === 'ellipse');
        if (isClosed) {
            for (let i = 0; i < params.length; i++) {
                let p1 = params[i];
                let p2 = params[(i + 1) % params.length];
                let inSeg = false;
                if (p1 < p2) inSeg = (clickParam >= p1 && clickParam <= p2);
                else inSeg = (clickParam >= p1 || clickParam <= p2);
                if (inSeg) return { s: p1, e: p2 };
            }
        } else {
            // Filter intersections that are actually on the arc
            // Using a tiny buffer to avoid edge cases near endpoints
            let validParams = params.filter(p => {
                const s = normalizeAngle(p - 0.0001);
                const e = normalizeAngle(p + 0.0001);
                return isAngleInArc(s, target) && isAngleInArc(e, target);
            });

            let pts = [startBound, ...validParams, endBound];

            // Sort points by distance from start along the arc direction
            if (anticlockwise) {
                pts = pts.map(p => ({ p, d: normalizeAngle(startBound - p) })).sort((a, b) => a.d - b.d).map(o => o.p);
            } else {
                pts = pts.map(p => ({ p, d: normalizeAngle(p - startBound) })).sort((a, b) => a.d - b.d).map(o => o.p);
            }

            for (let i = 0; i < pts.length - 1; i++) {
                let p1 = pts[i];
                let p2 = pts[i + 1];
                let dTarget, dSeg;
                if (anticlockwise) {
                    dTarget = normalizeAngle(p1 - clickParam);
                    dSeg = normalizeAngle(p1 - p2);
                } else {
                    dTarget = normalizeAngle(clickParam - p1);
                    dSeg = normalizeAngle(p2 - p1);
                }
                if (dTarget <= dSeg) return { s: p1, e: p2 };
            }
        }
    }
    return null;
}

function drawSegmentHighlight(ctx, item, type, s, e, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = (item.lineWidth || 2) + CONFIG.ERASER_HOVER_WIDTH_EXTRA + 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    if (type === 'free' || type === 'vp') {
        const x1 = item.start.x + (item.end.x - item.start.x) * s;
        const y1 = item.start.y + (item.end.y - item.start.y) * s;
        const x2 = item.start.x + (item.end.x - item.start.x) * e;
        const y2 = item.start.y + (item.end.y - item.start.y) * e;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
    } else if (type === 'circle' || type === 'arc') {
        const anticlockwise = (type === 'arc' ? !!item.anticlockwise : false);
        ctx.arc(item.center.x, item.center.y, item.radius, s, e, anticlockwise);
    } else if (type === 'ellipse' || type === 'isoArc') {
        const anticlockwise = (type === 'isoArc' ? !!item.anticlockwise : false);
        ctx.ellipse(item.center.x, item.center.y, item.radiusX, item.radiusY, item.rotation, s, e, anticlockwise);
    }
    ctx.stroke();
    ctx.restore();
}


/**
 * Find the nearest intersection point between a line (from start to end) 
 * and any existing lines in the scene.
 * Returns the intersection point closest to the start point, or null if none found.
 */
function findNearestLineIntersection(start, end) {
    let nearestIntersection = null;
    let minDistanceFromStart = Infinity;

    // Calculate minimum distance threshold based on how far start is from existing lines
    let minDistThreshold = CONFIG.INTERSECTION_THRESHOLD_NEAR; // Default threshold in pixels

    const allLines = getAllLines();
    const allVPLines = getAllVPLines();

    let minDistToAnyLine = Infinity;
    for (const line of allLines) {
        const dist = distanceToLine(start.x, start.y, line.start, line.end);
        minDistToAnyLine = Math.min(minDistToAnyLine, dist);
    }
    for (const vpLine of allVPLines) {
        const dist = distanceToLine(start.x, start.y, vpLine.start, vpLine.end);
        minDistToAnyLine = Math.min(minDistToAnyLine, dist);
    }

    const allCircles = getAllCircles();
    for (const circle of allCircles) {
        const d = Math.sqrt(Math.pow(start.x - circle.center.x, 2) + Math.pow(start.y - circle.center.y, 2));
        const dist = Math.abs(d - circle.radius);
        minDistToAnyLine = Math.min(minDistToAnyLine, dist);
    }

    const allArcs = getAllArcs();
    for (const arc of allArcs) {
        const d = Math.sqrt(Math.pow(start.x - arc.center.x, 2) + Math.pow(start.y - arc.center.y, 2));
        const dist = Math.abs(d - arc.radius);
        minDistToAnyLine = Math.min(minDistToAnyLine, dist);
    }

    // If start is very close to a line, use a much smaller threshold
    if (minDistToAnyLine < CONFIG.INTERSECTION_THRESHOLD_NEAR) {
        minDistThreshold = CONFIG.INTERSECTION_THRESHOLD_EXACT; // Very small threshold when starting near a line
    }

    const checkPoint = (pt) => {
        const distFromStart = Math.sqrt(
            Math.pow(pt.x - start.x, 2) +
            Math.pow(pt.y - start.y, 2)
        );
        if (distFromStart < minDistThreshold) return;

        if (distFromStart < minDistanceFromStart) {
            minDistanceFromStart = distFromStart;
            nearestIntersection = pt;
        }
    };

    for (const line of allLines) {
        const intersection = lineIntersection(start, end, line.start, line.end);
        if (intersection) checkPoint(intersection);
    }

    for (const vpLine of allVPLines) {
        const intersection = lineIntersection(start, end, vpLine.start, vpLine.end);
        if (intersection) checkPoint(intersection);
    }

    for (const circle of allCircles) {
        const hits = lineCircleIntersections(start, end, circle.center, circle.radius);
        hits.forEach(checkPoint);
    }

    for (const arc of allArcs) {
        const hits = lineCircleIntersections(start, end, arc.center, arc.radius);
        hits.forEach(hit => {
            const angle = Math.atan2(hit.y - arc.center.y, hit.x - arc.center.x);
            if (isAngleInArc(angle, arc)) checkPoint(hit);
        });
    }

    const allEllipses = getAllEllipses();
    for (const el of allEllipses) {
        const hits = lineEllipseIntersections(start, end, el.center, el.radiusX, el.radiusY, el.rotation);
        hits.forEach(checkPoint);
    }

    const allIsoArcs = getAllIsoArcs();
    for (const ia of allIsoArcs) {
        const hits = lineEllipseIntersections(start, end, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
        hits.forEach(hit => {
            const dx = hit.x - ia.center.x;
            const dy = hit.y - ia.center.y;
            const lx = dx * Math.cos(-ia.rotation) - dy * Math.sin(-ia.rotation);
            const ly = dx * Math.sin(-ia.rotation) + dy * Math.cos(-ia.rotation);
            const theta = Math.atan2(ly / ia.radiusY, lx / ia.radiusX);
            if (isAngleInArc(theta, ia)) checkPoint(hit);
        });
    }

    return nearestIntersection;
}

function getCircularIntersections(center, radius) {
    const intersections = [];
    const allLines = getAllLines();
    const allVPLines = getAllVPLines();
    const allCircles = getAllCircles();
    const allArcs = getAllArcs();
    const segments = [...allLines, ...allVPLines];

    const checkPoint = (pt) => {
        const angle = Math.atan2(pt.y - center.y, pt.x - center.x);
        intersections.push(angle);
    };

    segments.forEach(seg => {
        const hits = lineCircleIntersections(seg.start, seg.end, center, radius);
        hits.forEach(checkPoint);
    });
    allCircles.forEach(circ => {
        const hits = circleCircleIntersections(center, radius, circ.center, circ.radius);
        hits.forEach(checkPoint);
    });
    allArcs.forEach(arc => {
        const hits = circleCircleIntersections(center, radius, arc.center, arc.radius);
        hits.forEach(hit => {
            const angle = Math.atan2(hit.y - arc.center.y, hit.x - arc.center.x);
            if (isAngleInArc(angle, arc)) checkPoint(hit);
        });
    });

    const allEllipses = getAllEllipses();
    allEllipses.forEach(el => {
        // Line-Ellipse is already implemented. Circle-Ellipse?
        // We can treat circle as a line segment? No.
        // For simplicity, let's just do line-ellipse logic if we have segments.
        // But here we want circular path intersections.
    });

    return intersections;
}

/**
 * Find the nearest intersection point on a circular path starting from startAngle.
 * Search is performed in the specified direction (1 for clockwise, -1 for counter-clockwise).
 */
function findNearestIntersectionOnCircularPath(center, radius, startAngle, direction = 1, targetAngle = null, providedIntersections = null) {
    const intersections = providedIntersections || getCircularIntersections(center, radius);

    if (intersections.length === 0) return null;

    const normalize = ang => {
        let a = direction * (ang - startAngle);
        a = a % (Math.PI * 2);
        if (a <= 0.001) a += Math.PI * 2;
        if (a > Math.PI * 2 + 0.001) a -= Math.PI * 2;
        return a;
    };

    let bestAngle = null;
    let minDiff = Infinity;

    const targetDiff = targetAngle !== null ? normalize(targetAngle) : Infinity;

    intersections.forEach(ang => {
        const diff = normalize(ang);
        if (diff < minDiff && (targetAngle === null || diff < targetDiff)) {
            minDiff = diff;
            bestAngle = ang;
        }
    });

    return bestAngle;
}

function getEllipticalIntersections(center, rx, ry, rotation) {
    const intersections = [];
    const allLines = getAllLines();
    const allVPLines = getAllVPLines();
    const allCircles = getAllCircles();
    const allArcs = getAllArcs();
    const allEllipses = getAllEllipses();
    const allIsoArcs = getAllIsoArcs();

    const segments = [...allLines, ...allVPLines];

    const cosR = Math.cos(-rotation);
    const sinR = Math.sin(-rotation);

    const checkPoint = (pt) => {
        const tx = pt.x - center.x;
        const ty = pt.y - center.y;
        const lx = tx * cosR - ty * sinR;
        const ly = tx * sinR + ty * cosR;
        const theta = Math.atan2(ly / ry, lx / rx);
        intersections.push(theta);
    };

    segments.forEach(seg => {
        const hits = lineEllipseIntersections(seg.start, seg.end, center, rx, ry, rotation);
        hits.forEach(checkPoint);
    });

    // Check against existing circles/arcs
    allCircles.forEach(circ => {
        // Requires a circle-ellipse intersection function.
        // Assuming circleEllipseIntersections exists for this context.
        const hits = circleEllipseIntersections(circ.center, circ.radius, center, rx, ry, rotation);
        hits.forEach(checkPoint);
    });

    allArcs.forEach(arc => {
        // Requires a circle-ellipse intersection function.
        // Assuming circleEllipseIntersections exists for this context.
        const hits = circleEllipseIntersections(arc.center, arc.radius, center, rx, ry, rotation);
        hits.forEach(hit => {
            const angle = Math.atan2(hit.y - arc.center.y, hit.x - arc.center.x);
            if (isAngleInArc(angle, arc)) checkPoint(hit);
        });
    });

    // Check against other ellipses
    allEllipses.forEach(el => {
        // Requires an ellipse-ellipse intersection function.
        // Assuming ellipseEllipseIntersections exists for this context.
        if (el !== this) { // Avoid self-intersection
            const hits = ellipseEllipseIntersections(center, rx, ry, rotation, el.center, el.radiusX, el.radiusY, el.rotation);
            hits.forEach(checkPoint);
        }
    });

    // Check against iso-arcs
    allIsoArcs.forEach(ia => {
        // Requires an ellipse-ellipse intersection function.
        // Assuming ellipseEllipseIntersections exists for this context.
        const hits = ellipseEllipseIntersections(center, rx, ry, rotation, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
        hits.forEach(hit => {
            const dx = hit.x - ia.center.x;
            const dy = hit.y - ia.center.y;
            const lx = dx * Math.cos(-ia.rotation) - dy * Math.sin(-ia.rotation);
            const ly = dx * Math.sin(-ia.rotation) + dy * Math.cos(-ia.rotation);
            const theta = Math.atan2(ly / ia.radiusY, lx / ia.radiusX);
            if (isAngleInArc(theta, ia)) checkPoint(hit);
        });
    });

    return intersections;
}

function findNearestIntersectionOnEllipticalPath(center, rx, ry, rotation, startAngle, direction = 1, targetAngle = null, providedIntersections = null) {
    const intersections = providedIntersections || getEllipticalIntersections(center, rx, ry, rotation);

    if (intersections.length === 0) return null;

    const normalize = ang => {
        let a = direction * (ang - startAngle);
        a = a % (Math.PI * 2);
        if (a <= 0.001) a += Math.PI * 2;
        if (a > Math.PI * 2 + 0.001) a -= Math.PI * 2;
        return a;
    };

    let bestAngle = null;
    let minDiff = Infinity;

    const targetDiff = targetAngle !== null ? normalize(targetAngle) : Infinity;

    intersections.forEach(ang => {
        const diff = normalize(ang);
        if (diff < minDiff && (targetAngle === null || diff < targetDiff)) {
            minDiff = diff;
            bestAngle = ang;
        }
    });

    return bestAngle;
}

/**
 * Calculate all intersection points between existing lines
 */
function calculateAllLineIntersections() {
    const intersections = [];

    const allLines = getAllLines();
    const allVPLines = getAllVPLines();
    const allCircles = getAllCircles();
    const allArcs = getAllArcs();
    const allEllipses = getAllEllipses();
    const allIsoArcs = getAllIsoArcs();

    const segments = [...allLines, ...allVPLines];

    // intersection types
    for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
            const intersection = lineIntersection(segments[i].start, segments[i].end, segments[j].start, segments[j].end);
            if (intersection) intersections.push(intersection);
        }
    }

    for (const seg of segments) {
        for (const circ of allCircles) {
            const hits = lineCircleIntersections(seg.start, seg.end, circ.center, circ.radius);
            intersections.push(...hits);
        }
    }

    for (const seg of segments) {
        for (const arc of allArcs) {
            const hits = lineCircleIntersections(seg.start, seg.end, arc.center, arc.radius);
            hits.forEach(hit => {
                const angle = Math.atan2(hit.y - arc.center.y, hit.x - arc.center.x);
                if (isAngleInArc(angle, arc)) intersections.push(hit);
            });
        }
    }

    for (const seg of segments) {
        for (const el of allEllipses) {
            const hits = lineEllipseIntersections(seg.start, seg.end, el.center, el.radiusX, el.radiusY, el.rotation);
            intersections.push(...hits);
        }
    }

    for (const seg of segments) {
        for (const ia of allIsoArcs) {
            const hits = lineEllipseIntersections(seg.start, seg.end, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
            hits.forEach(hit => {
                const dx = hit.x - ia.center.x;
                const dy = hit.y - ia.center.y;
                const lx = dx * Math.cos(-ia.rotation) - dy * Math.sin(-ia.rotation);
                const ly = dx * Math.sin(-ia.rotation) + dy * Math.cos(-ia.rotation);
                const theta = Math.atan2(ly / ia.radiusY, lx / ia.radiusX);
                if (isAngleInArc(theta, ia)) intersections.push(hit);
            });
        }
    }

    for (let i = 0; i < allCircles.length; i++) {
        for (let j = i + 1; j < allCircles.length; j++) {
            const hits = circleCircleIntersections(allCircles[i].center, allCircles[i].radius, allCircles[j].center, allCircles[j].radius);
            intersections.push(...hits);
        }
    }

    for (const circ of allCircles) {
        for (const arc of allArcs) {
            const hits = circleCircleIntersections(circ.center, circ.radius, arc.center, arc.radius);
            hits.forEach(hit => {
                const angle = Math.atan2(hit.y - arc.center.y, hit.x - arc.center.x);
                if (isAngleInArc(angle, arc)) intersections.push(hit);
            });
        }
    }

    for (let i = 0; i < allArcs.length; i++) {
        for (let j = i + 1; j < allArcs.length; j++) {
            const hits = circleCircleIntersections(allArcs[i].center, allArcs[i].radius, allArcs[j].center, allArcs[j].radius);
            hits.forEach(hit => {
                const angle1 = Math.atan2(hit.y - allArcs[i].center.y, hit.x - allArcs[i].center.x);
                const angle2 = Math.atan2(hit.y - allArcs[j].center.y, hit.x - allArcs[j].center.x);
                if (isAngleInArc(angle1, allArcs[i]) && isAngleInArc(angle2, allArcs[j])) {
                    intersections.push(hit);
                }
            });
        }
    }

    for (const circ of allCircles) {
        for (const el of allEllipses) {
            const hits = circleEllipseIntersections(circ.center, circ.radius, el.center, el.radiusX, el.radiusY, el.rotation);
            intersections.push(...hits);
        }
    }

    for (let i = 0; i < allEllipses.length; i++) {
        for (let j = i + 1; j < allEllipses.length; j++) {
            const hits = ellipseEllipseIntersections(allEllipses[i].center, allEllipses[i].radiusX, allEllipses[i].radiusY, allEllipses[i].rotation,
                allEllipses[j].center, allEllipses[j].radiusX, allEllipses[j].radiusY, allEllipses[j].rotation);
            intersections.push(...hits);
        }
    }

    return intersections;
}

/**
 * Find nearest grid-line intersection point to a given point
 * Returns the closest point where a grid line intersects with any drawn line
 */
function findNearestGridLineIntersectionPoint(point, threshold = CONFIG.SNAP_RADIUS_PIXELS / STATE.zoomLevel) {
    const allLines = getAllLines();
    const allVPLines = getAllVPLines();
    const allCircles = getAllCircles();
    const allArcs = getAllArcs();
    const allEllipses = getAllEllipses();
    const allIsoArcs = getAllIsoArcs();

    if (allLines.length === 0 && allVPLines.length === 0 && allCircles.length === 0 && allArcs.length === 0 && allEllipses.length === 0 && allIsoArcs.length === 0) return null;

    let nearestPoint = null;
    let minDistance = Infinity;
    const S = STATE.gridSize2D;
    const H = S * Math.sqrt(3) / 2;
    const m = 1 / Math.sqrt(3);

    const combinedLines = [...allLines, ...allVPLines];

    for (const line of combinedLines) {
        const minX = Math.min(line.start.x, line.end.x);
        const maxX = Math.max(line.start.x, line.end.x);
        const minY = Math.min(line.start.y, line.end.y);
        const maxY = Math.max(line.start.y, line.end.y);

        if (STATE.gridType === 'isometric') {
            const startI = Math.floor(minX / H);
            const endI = Math.ceil(maxX / H);
            for (let i = startI; i <= endI; i++) {
                const x = i * H;
                const intersection = lineIntersection(line.start, line.end, { x, y: 0 }, { x, y: UI.canvas.height });
                if (intersection) {
                    const dist = Math.sqrt(Math.pow(intersection.x - point.x, 2) + Math.pow(intersection.y - point.y, 2));
                    if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = intersection; }
                }
            }

            const minB30 = minY - m * maxX;
            const maxB30 = maxY - m * minX;
            const startJ30 = Math.floor(minB30 / S);
            const endJ30 = Math.ceil(maxB30 / S);
            for (let j = startJ30; j <= endJ30; j++) {
                const b = j * S;
                const intersection = lineIntersection(line.start, line.end, { x: 0, y: b }, { x: 1, y: m + b });
                if (intersection) {
                    const dist = Math.sqrt(Math.pow(intersection.x - point.x, 2) + Math.pow(intersection.y - point.y, 2));
                    if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = intersection; }
                }
            }

            const minB150 = minY + m * minX;
            const maxB150 = maxY + m * maxX;
            const startJ150 = Math.floor(minB150 / S);
            const endJ150 = Math.ceil(maxB150 / S);
            for (let j = startJ150; j <= endJ150; j++) {
                const b = j * S;
                const intersection = lineIntersection(line.start, line.end, { x: 0, y: b }, { x: 1, y: -m + b });
                if (intersection) {
                    const dist = Math.sqrt(Math.pow(intersection.x - point.x, 2) + Math.pow(intersection.y - point.y, 2));
                    if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = intersection; }
                }
            }
        } else {
            const startGridX = Math.floor(minX / S) * S;
            const endGridX = Math.ceil(maxX / S) * S;
            for (let gridX = startGridX; gridX <= endGridX; gridX += S) {
                const intersection = lineIntersection(line.start, line.end, { x: gridX, y: 0 }, { x: gridX, y: UI.canvas.height });
                if (intersection) {
                    const dist = Math.sqrt(Math.pow(intersection.x - point.x, 2) + Math.pow(intersection.y - point.y, 2));
                    if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = intersection; }
                }
            }
            const startGridY = Math.floor(minY / S) * S;
            const endGridY = Math.ceil(maxY / S) * S;
            for (let gridY = startGridY; gridY <= endGridY; gridY += S) {
                const intersection = lineIntersection(line.start, line.end, { x: 0, y: gridY }, { x: UI.canvas.width, y: gridY });
                if (intersection) {
                    const dist = Math.sqrt(Math.pow(intersection.x - point.x, 2) + Math.pow(intersection.y - point.y, 2));
                    if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = intersection; }
                }
            }
        }
    }

    for (const circle of allCircles) {
        const minX = circle.center.x - circle.radius;
        const maxX = circle.center.x + circle.radius;
        const minY = circle.center.y - circle.radius;
        const maxY = circle.center.y + circle.radius;

        if (STATE.gridType === 'isometric') {
            // Check vertical isometric lines
            const startI = Math.floor(minX / H);
            const endI = Math.ceil(maxX / H);
            for (let i = startI; i <= endI; i++) {
                const x = i * H;
                const dx = Math.abs(x - circle.center.x);
                if (dx <= circle.radius) {
                    const dy = Math.sqrt(circle.radius * circle.radius - dx * dx);
                    const hits = [{ x, y: circle.center.y + dy }, { x, y: circle.center.y - dy }];
                    hits.forEach(hit => {
                        const dist = Math.sqrt(Math.pow(hit.x - point.x, 2) + Math.pow(hit.y - point.y, 2));
                        if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = hit; }
                    });
                }
            }
            // (Slanted lines could be added here later)
        } else {
            const startGridX = Math.floor(minX / S) * S;
            const endGridX = Math.ceil(maxX / S) * S;
            for (let gridX = startGridX; gridX <= endGridX; gridX += S) {
                const dx = Math.abs(gridX - circle.center.x);
                if (dx <= circle.radius) {
                    const dy = Math.sqrt(circle.radius * circle.radius - dx * dx);
                    const hits = [{ x: gridX, y: circle.center.y + dy }, { x: gridX, y: circle.center.y - dy }];
                    hits.forEach(hit => {
                        const dist = Math.sqrt(Math.pow(hit.x - point.x, 2) + Math.pow(hit.y - point.y, 2));
                        if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = hit; }
                    });
                }
            }
            const startGridY = Math.floor(minY / S) * S;
            const endGridY = Math.ceil(maxY / S) * S;
            for (let gridY = startGridY; gridY <= endGridY; gridY += S) {
                const dy = Math.abs(gridY - circle.center.y);
                if (dy <= circle.radius) {
                    const dx = Math.sqrt(circle.radius * circle.radius - dy * dy);
                    const hits = [{ x: circle.center.x + dx, y: gridY }, { x: circle.center.x - dx, y: gridY }];
                    hits.forEach(hit => {
                        const dist = Math.sqrt(Math.pow(hit.x - point.x, 2) + Math.pow(hit.y - point.y, 2));
                        if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = hit; }
                    });
                }
            }
        }
    }

    for (const arc of allArcs) {
        const minX = arc.center.x - arc.radius;
        const maxX = arc.center.x + arc.radius;
        const minY = arc.center.y - arc.radius;
        const maxY = arc.center.y + arc.radius;

        const checkHit = (hit) => {
            const angle = Math.atan2(hit.y - arc.center.y, hit.x - arc.center.x);
            if (isAngleInArc(angle, arc)) {
                const dist = Math.sqrt(Math.pow(hit.x - point.x, 2) + Math.pow(hit.y - point.y, 2));
                if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = hit; }
            }
        };

        if (STATE.gridType === 'isometric') {
            const startI = Math.floor(minX / H);
            const endI = Math.ceil(maxX / H);
            for (let i = startI; i <= endI; i++) {
                const x = i * H;
                const dx = Math.abs(x - arc.center.x);
                if (dx <= arc.radius) {
                    const dy = Math.sqrt(arc.radius * arc.radius - dx * dx);
                    checkHit({ x, y: arc.center.y + dy });
                    checkHit({ x, y: arc.center.y - dy });
                }
            }
        } else {
            const startGridX = Math.floor(minX / S) * S;
            const endGridX = Math.ceil(maxX / S) * S;
            for (let gridX = startGridX; gridX <= endGridX; gridX += S) {
                const dx = Math.abs(gridX - arc.center.x);
                if (dx <= arc.radius) {
                    const dy = Math.sqrt(arc.radius * arc.radius - dx * dx);
                    checkHit({ x: gridX, y: arc.center.y + dy });
                    checkHit({ x: gridX, y: arc.center.y - dy });
                }
            }
            const startGridY = Math.floor(minY / S) * S;
            const endGridY = Math.ceil(maxY / S) * S;
            for (let gridY = startGridY; gridY <= endGridY; gridY += S) {
                const dy = Math.abs(gridY - arc.center.y);
                if (dy <= arc.radius) {
                    const dx = Math.sqrt(arc.radius * arc.radius - dy * dy);
                    checkHit({ x: arc.center.x + dx, y: gridY });
                    checkHit({ x: arc.center.x - dx, y: gridY });
                }
            }
        }
    }

    for (const el of allEllipses) {
        const minX = el.center.x - Math.max(el.radiusX, el.radiusY);
        const maxX = el.center.x + Math.max(el.radiusX, el.radiusY);
        const minY = el.center.y - Math.max(el.radiusX, el.radiusY);
        const maxY = el.center.y + Math.max(el.radiusX, el.radiusY);

        const checkHit = (hit) => {
            const dist = Math.sqrt(Math.pow(hit.x - point.x, 2) + Math.pow(hit.y - point.y, 2));
            if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = hit; }
        };

        if (STATE.gridType === 'isometric') {
            const startI = Math.floor(minX / H);
            const endI = Math.ceil(maxX / H);
            for (let i = startI; i <= endI; i++) {
                const x = i * H;
                const hits = lineEllipseIntersections({ x, y: 0 }, { x, y: UI.canvas.height }, el.center, el.radiusX, el.radiusY, el.rotation);
                hits.forEach(checkHit);
            }
            const minB30 = minY - m * maxX;
            const maxB30 = maxY - m * minX;
            const startJ30 = Math.floor(minB30 / S);
            const endJ30 = Math.ceil(maxB30 / S);
            for (let j = startJ30; j <= endJ30; j++) {
                const b = j * S;
                const hits = lineEllipseIntersections({ x: 0, y: b }, { x: 1, y: m + b }, el.center, el.radiusX, el.radiusY, el.rotation);
                hits.forEach(checkHit);
            }
            const minB150 = minY + m * minX;
            const maxB150 = maxY + m * maxX;
            const startJ150 = Math.floor(minB150 / S);
            const endJ150 = Math.ceil(maxB150 / S);
            for (let j = startJ150; j <= endJ150; j++) {
                const b = j * S;
                const hits = lineEllipseIntersections({ x: 0, y: b }, { x: 1, y: -m + b }, el.center, el.radiusX, el.radiusY, el.rotation);
                hits.forEach(checkHit);
            }
        } else {
            const startGridX = Math.floor(minX / S) * S;
            const endGridX = Math.ceil(maxX / S) * S;
            for (let gridX = startGridX; gridX <= endGridX; gridX += S) {
                const hits = lineEllipseIntersections({ x: gridX, y: 0 }, { x: gridX, y: UI.canvas.height }, el.center, el.radiusX, el.radiusY, el.rotation);
                hits.forEach(checkHit);
            }
            const startGridY = Math.floor(minY / S) * S;
            const endGridY = Math.ceil(maxY / S) * S;
            for (let gridY = startGridY; gridY <= endGridY; gridY += S) {
                const hits = lineEllipseIntersections({ x: 0, y: gridY }, { x: UI.canvas.width, y: gridY }, el.center, el.radiusX, el.radiusY, el.rotation);
                hits.forEach(checkHit);
            }
        }
    }

    for (const ia of allIsoArcs) {
        const minX = ia.center.x - Math.max(ia.radiusX, ia.radiusY);
        const maxX = ia.center.x + Math.max(ia.radiusX, ia.radiusY);
        const minY = ia.center.y - Math.max(ia.radiusX, ia.radiusY);
        const maxY = ia.center.y + Math.max(ia.radiusX, ia.radiusY);

        const checkHit = (hit) => {
            const dx = hit.x - ia.center.x;
            const dy = hit.y - ia.center.y;
            const lx = dx * Math.cos(-ia.rotation) - dy * Math.sin(-ia.rotation);
            const ly = dx * Math.sin(-ia.rotation) + dy * Math.cos(-ia.rotation);
            const theta = Math.atan2(ly / ia.radiusY, lx / ia.radiusX);
            if (isAngleInArc(theta, ia)) {
                const dist = Math.sqrt(Math.pow(hit.x - point.x, 2) + Math.pow(hit.y - point.y, 2));
                if (dist < threshold && dist < minDistance) { minDistance = dist; nearestPoint = hit; }
            }
        };

        if (STATE.gridType === 'isometric') {
            const startI = Math.floor(minX / H);
            const endI = Math.ceil(maxX / H);
            for (let i = startI; i <= endI; i++) {
                const x = i * H;
                const hits = lineEllipseIntersections({ x, y: 0 }, { x, y: UI.canvas.height }, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
                hits.forEach(checkHit);
            }
            const startJ30 = Math.floor((minY - m * maxX) / S);
            const endJ30 = Math.ceil((maxY - m * minX) / S);
            for (let j = startJ30; j <= endJ30; j++) {
                const b = j * S;
                const hits = lineEllipseIntersections({ x: 0, y: b }, { x: 1, y: m + b }, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
                hits.forEach(checkHit);
            }
            const startJ150 = Math.floor((minY + m * minX) / S);
            const endJ150 = Math.ceil((maxY + m * maxX) / S);
            for (let j = startJ150; j <= endJ150; j++) {
                const b = j * S;
                const hits = lineEllipseIntersections({ x: 0, y: b }, { x: 1, y: -m + b }, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
                hits.forEach(checkHit);
            }
        } else {
            const startGridX = Math.floor(minX / S) * S;
            const endGridX = Math.ceil(maxX / S) * S;
            for (let gridX = startGridX; gridX <= endGridX; gridX += S) {
                const hits = lineEllipseIntersections({ x: gridX, y: 0 }, { x: gridX, y: UI.canvas.height }, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
                hits.forEach(checkHit);
            }
            const startGridY = Math.floor(minY / S) * S;
            const endGridY = Math.ceil(maxY / S) * S;
            for (let gridY = startGridY; gridY <= endGridY; gridY += S) {
                const hits = lineEllipseIntersections({ x: 0, y: gridY }, { x: UI.canvas.width, y: gridY }, ia.center, ia.radiusX, ia.radiusY, ia.rotation);
                hits.forEach(checkHit);
            }
        }
    }

    return nearestPoint;
}

/**
 * Find nearest line intersection point to a given point
 */
function findNearestLineIntersectionPoint(point, threshold = CONFIG.SNAP_RADIUS_PIXELS / STATE.zoomLevel) {
    if (STATE.lineIntersectionPoints.length === 0) return null;

    let nearestPoint = null;
    let minDistance = Infinity;

    for (const intersection of STATE.lineIntersectionPoints) {
        const distance = Math.sqrt(
            Math.pow(point.x - intersection.x, 2) +
            Math.pow(point.y - intersection.y, 2)
        );
        if (distance < minDistance && distance < threshold) {
            minDistance = distance;
            nearestPoint = intersection;
        }
    }

    return nearestPoint;
}

// --- Grid Management ---

/**
 * Main function for drawing grids.
 */
function drawGrids() {
    if (STATE.show2DGrid) {
        if (STATE.gridType === 'isometric') {
            drawIsometricGrid();
        } else {
            draw2DGrid();
        }
    }
}

/**
 * Draws a standard 2D grid.
 */
function draw2DGrid() {
    ctx.strokeStyle = '#c5c5c5';
    ctx.lineWidth = 0.5 / STATE.zoomLevel; // Keep line width constant regardless of zoom
    const gridSize = STATE.gridSize2D;

    // Calculate visible area in world coordinates
    const left = -STATE.panX / STATE.zoomLevel;
    const top = -STATE.panY / STATE.zoomLevel;
    const right = (UI.canvas.width - STATE.panX) / STATE.zoomLevel;
    const bottom = (UI.canvas.height - STATE.panY) / STATE.zoomLevel;

    const startX = Math.floor(left / gridSize) * gridSize;
    const endX = Math.ceil(right / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }

    const startY = Math.floor(top / gridSize) * gridSize;
    const endY = Math.ceil(bottom / gridSize) * gridSize;

    for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.stroke();
    }
}

/**
 * Draws an isometric grid (30 degree angles).
 */
function drawIsometricGrid() {
    ctx.strokeStyle = '#c5c5c5';
    ctx.lineWidth = 0.5 / STATE.zoomLevel;
    const S = STATE.gridSize2D;
    const H = S * Math.sqrt(3) / 2;

    const left = -STATE.panX / STATE.zoomLevel;
    const top = -STATE.panY / STATE.zoomLevel;
    const right = (UI.canvas.width - STATE.panX) / STATE.zoomLevel;
    const bottom = (UI.canvas.height - STATE.panY) / STATE.zoomLevel;

    // 1. Vertical lines
    const startI = Math.floor(left / H);
    const endI = Math.ceil(right / H);

    for (let i = startI; i <= endI; i++) {
        const x = i * H;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
    }

    // Slopes
    const m = 1 / Math.sqrt(3);

    // 2. 30 degree lines (y = m*x + b)
    // b = y - m*x
    // We want lines to pass through nodes (0, j*S)
    const minB30 = top - m * right;
    const maxB30 = bottom - m * left;
    const startJ30 = Math.floor(minB30 / (S / 2));
    const endJ30 = Math.ceil(maxB30 / (S / 2));

    for (let j = startJ30; j <= endJ30; j++) {
        const b = j * (S / 2);
        // We only want lines through actual nodes.
        // Nodes are at (i*H, k*S + (i%2)*S/2)
        // For i=0, node is (0, k*S).
        // y = m*x + b -> j*S = m*0 + b -> b = j*S
        // For i=1, node is (H, k*S + S/2).
        // k*S + S/2 = m*H + b = (1/sqrt(3))*(S*sqrt(3)/2) + b = S/2 + b -> b = k*S
        // So b must be a multiple of S.
        if (j % 2 !== 0) continue;

        const x1 = left;
        const y1 = m * x1 + b;
        const x2 = right;
        const y2 = m * x2 + b;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    const minB150 = top + m * left;
    const maxB150 = bottom + m * right;
    const startJ150 = Math.floor(minB150 / (S / 2));
    const endJ150 = Math.ceil(maxB150 / (S / 2));

    for (let j = startJ150; j <= endJ150; j++) {
        const b = j * (S / 2);
        if (j % 2 !== 0) continue;

        const x1 = left;
        const y1 = -m * x1 + b;
        const x2 = right;
        const y2 = -m * x2 + b;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}


// --- Vanishing Point (VP) Logic ---
function setVanishingPoint(e) {
    const rect = UI.canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    x = (x - STATE.panX) / STATE.zoomLevel;
    y = (y - STATE.panY) / STATE.zoomLevel;

    for (let i = 0; i < STATE.vanishingPoints.length; i++) {
        const vp = STATE.vanishingPoints[i];
        const dist = Math.sqrt((x - vp.x) ** 2 + (y - vp.y) ** 2);
        if (dist < CONFIG.SNAP_RADIUS_PIXELS / STATE.zoomLevel) { // Snap radius in canvas coordinates
            // Clear activeVP if we're removing it
            if (STATE.activeVP === vp) {
                STATE.activeVP = null;
            }
            STATE.vanishingPoints.splice(i, 1);
            draw();
            return;
        }
    }

    x = Math.round(x / STATE.gridSize2D) * STATE.gridSize2D;
    y = Math.round(y / STATE.gridSize2D) * STATE.gridSize2D;

    const pos = { x, y };
    STATE.vanishingPoints.push(pos);
    draw();
}

function drawVanishingPoints() {
    if (!STATE.showVPs) return;

    STATE.vanishingPoints.forEach(vp => {
        const isActive = (vp === STATE.activeVP);

        // Draw outer ring for active VP
        if (isActive) {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(vp.x, vp.y, 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = isActive ? '#00ff00' : 'red';
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.strokeStyle = isActive ? '#00ff00' : 'red';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(vp.x - 10, vp.y);
        ctx.lineTo(vp.x + 10, vp.y);
        ctx.moveTo(vp.x, vp.y - 10);
        ctx.lineTo(vp.x, vp.y + 10);
        ctx.stroke();
    });
}

// --- Mouse Event Handlers ---
function getMousePos(evt, useSnap) {
    const rect = UI.canvas.getBoundingClientRect();
    let x = evt.clientX - rect.left;
    let y = evt.clientY - rect.top;

    x = (x - STATE.panX) / STATE.zoomLevel;
    y = (y - STATE.panY) / STATE.zoomLevel;

    if (useSnap && STATE.snapToEndpoint && (STATE.drawingTool === 'free' || STATE.drawingTool === 'parallel' || STATE.drawingTool === 'vp-line' || STATE.drawingTool === 'circle' || STATE.drawingTool === 'arc' || STATE.drawingTool === 'iso-circle' || STATE.drawingTool === 'iso-arc' || STATE.drawingTool === 'rect' || STATE.drawingTool === 'vp-rect' || STATE.drawingTool === 'select')) {
        const nearestEndpoint = findNearestEndpoint({ x, y });
        if (nearestEndpoint) {
            return nearestEndpoint;
        }
    }

    if (useSnap && STATE.snapToLineIntersection && (STATE.drawingTool === 'free' || STATE.drawingTool === 'parallel' || STATE.drawingTool === 'vp-line' || STATE.drawingTool === 'circle' || STATE.drawingTool === 'arc' || STATE.drawingTool === 'iso-circle' || STATE.drawingTool === 'iso-arc' || STATE.drawingTool === 'rect' || STATE.drawingTool === 'vp-rect' || STATE.drawingTool === 'select')) {
        const nearestIntersection = findNearestLineIntersectionPoint({ x, y });
        if (nearestIntersection) {
            return nearestIntersection;
        }
    }

    if (useSnap && STATE.snapToGridLineIntersection && (STATE.drawingTool === 'free' || STATE.drawingTool === 'parallel' || STATE.drawingTool === 'vp-line' || STATE.drawingTool === 'circle' || STATE.drawingTool === 'arc' || STATE.drawingTool === 'iso-circle' || STATE.drawingTool === 'iso-arc' || STATE.drawingTool === 'rect' || STATE.drawingTool === 'vp-rect' || STATE.drawingTool === 'select')) {
        const nearestGridLineIntersection = findNearestGridLineIntersectionPoint({ x, y });
        if (nearestGridLineIntersection) {
            return nearestGridLineIntersection;
        }
    }

    if (useSnap && STATE.snapGrid) {
        if (STATE.gridType === 'isometric') {
            const S = STATE.gridSize2D;
            const H = S * Math.sqrt(3) / 2;

            const i = Math.round(x / H);
            const j = Math.round((y - (Math.abs(i) % 2) * (S / 2)) / S);

            x = i * H;
            y = j * S + (Math.abs(i) % 2) * (S / 2);
        } else {
            x = Math.round(x / STATE.gridSize2D) * STATE.gridSize2D;
            y = Math.round(y / STATE.gridSize2D) * STATE.gridSize2D;
        }
    }
    return { x, y };
}




UI.canvas.addEventListener('mousedown', (e) => {
    // Handle panning with middle mouse or Space+left click
    if (e.button === 1 || (e.button === 0 && STATE.isSpacePressed)) {
        e.preventDefault();
        STATE.isPanning = true;
        STATE.panStartX = e.clientX - STATE.panX;
        STATE.panStartY = e.clientY - STATE.panY;
        UI.canvas.style.cursor = 'grabbing';
        return;
    }

    if (STATE.drawingTool === 'select') {
        const pos = getMousePos(e, false);
        const itemAtPos = findLineAtPoint(pos.x, pos.y);

        if (itemAtPos) {
            const isAlreadySelected = isItemSelected(itemAtPos.line || itemAtPos.shape, itemAtPos.type);

            if (STATE.isShiftPressed) {
                // Toggle selection
                if (isAlreadySelected) {
                    const idx = STATE.selectedItems.findIndex(sel => (sel.line || sel.shape) === (itemAtPos.line || itemAtPos.shape));
                    STATE.selectedItems.splice(idx, 1);
                } else {
                    STATE.selectedItems.push(itemAtPos);
                }
            } else {
                if (!isAlreadySelected) {
                    STATE.selectedItems = [itemAtPos];
                }
                STATE.isMovingSelection = true;
                STATE.moveStartPos = pos;
                STATE.moveCurrentPos = pos;
                STATE.movingAnchorItem = itemAtPos;
                STATE.moveSnapHandle = getItemSnapHandle(itemAtPos.line || itemAtPos.shape, itemAtPos.type, pos);
            }
            draw();
        } else {
            if (!STATE.isShiftPressed) {
                STATE.selectedItems = [];
            }
            STATE.isMarqueeSelecting = true;
            STATE.marqueeStart = pos;
            STATE.marqueeEnd = pos;
            draw();
        }
        return;
    }

    if (STATE.drawingTool === 'vp-tool') {
        setVanishingPoint(e);
        return;
    }

    // VP Line & VP Rect Tool - clicking on a VP selects it as active
    if ((STATE.drawingTool === 'vp-line' || STATE.drawingTool === 'vp-rect') && !STATE.isDrawing) {
        const rect = UI.canvas.getBoundingClientRect();
        let x = (e.clientX - rect.left - STATE.panX) / STATE.zoomLevel;
        let y = (e.clientY - rect.top - STATE.panY) / STATE.zoomLevel;

        for (const vp of STATE.vanishingPoints) {
            const dist = Math.sqrt((x - vp.x) ** 2 + (y - vp.y) ** 2);
            if (dist < CONFIG.VP_SELECTION_RADIUS / STATE.zoomLevel) {
                STATE.activeVP = (STATE.activeVP === vp) ? null : vp;
                draw();
                return;
            }
        }
    }

    if (STATE.drawingTool === 'eraser') {
        const pos = getMousePos(e, false);
        const foundLine = findLineAtPoint(pos.x, pos.y);
        if (foundLine) {
            const layer = STATE.layers.find(l => l.id === foundLine.layerId);
            if (layer) {
                if (foundLine.type === 'vp') {
                    layer.vpLines.splice(foundLine.index, 1);
                    addAction({ type: 'remove', layerId: layer.id, lineType: 'vp', line: foundLine.line, index: foundLine.index });
                } else if (foundLine.type === 'circle') {
                    layer.circles.splice(foundLine.index, 1);
                    addAction({ type: 'remove', layerId: layer.id, shapeType: 'circle', shape: foundLine.shape, index: foundLine.index });
                } else if (foundLine.type === 'arc') {
                    layer.arcs.splice(foundLine.index, 1);
                    addAction({ type: 'remove', layerId: layer.id, shapeType: 'arc', shape: foundLine.shape, index: foundLine.index });
                } else if (foundLine.type === 'ellipse') {
                    layer.ellipses.splice(foundLine.index, 1);
                    addAction({ type: 'remove', layerId: layer.id, shapeType: 'ellipse', shape: foundLine.shape, index: foundLine.index });
                } else if (foundLine.type === 'isoArc') {
                    layer.isoArcs.splice(foundLine.index, 1);
                    addAction({ type: 'remove', layerId: layer.id, shapeType: 'isoArc', shape: foundLine.shape, index: foundLine.index });
                } else {
                    layer.lines.splice(foundLine.index, 1);
                    addAction({ type: 'remove', layerId: layer.id, lineType: 'free', line: foundLine.line, index: foundLine.index });
                }
                STATE.hoveredLine = null;
                draw();
            }
        } else {
            const fillData = findFillAtPoint(pos.x, pos.y);
            if (fillData) {
                const layer = STATE.layers.find(l => l.id === fillData.layerId);
                if (layer) {
                    const deletedFill = layer.fills.splice(fillData.fillIndex, 1)[0];
                    addAction({ type: 'remove', layerId: layer.id, fillType: 'fill', fill: deletedFill, index: fillData.fillIndex });
                    draw();
                }
            }
        }
        return;
    }

    if (STATE.drawingTool === 'parallel' && !STATE.isDrawing) {
        const needsShift = !!STATE.referenceLine;
        if (!needsShift || STATE.isShiftPressed) {
            const pos = getMousePos(e, false);
            const found = findLineAtPoint(pos.x, pos.y);
            const isLine = found && (found.type === 'free' || found.type === 'vp');
            if (isLine) {
                STATE.referenceLine = found.line || found.shape;
                draw();
                return;
            }
        }
    }

    // Pipette tool
    if (STATE.drawingTool === 'pipette') {
        const rect = UI.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const pixel = ctx.getImageData(screenX, screenY, 1, 1).data;
        const toHex = (n) => n.toString(16).padStart(2, '0');
        const hex = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
        STATE.currentColor = hex;
        UI.colorPicker.value = hex;
        return;
    }

    // Bucket tool
    if (STATE.drawingTool === 'bucket') {
        const pos = getMousePos(e, false);
        const newFill = { x: Math.round(pos.x), y: Math.round(pos.y), color: STATE.currentColor };
        const activeLayer = getActiveLayer();
        activeLayer.fills.push(newFill);
        addAction({ type: 'add', layerId: activeLayer.id, fillType: 'fill', fill: newFill });
        draw();
        return;
    }

    // Split tool
    if (STATE.drawingTool === 'split') {
        const pos = getMousePos(e, true);
        if (STATE.splitSelection) {
            executeSplit(STATE.splitSelection.found, STATE.splitSelection.n, STATE.splitSelection.mode, pos);
            return;
        }
        const found = findLineAtPoint(pos.x, pos.y);
        if (found) {
            performSplit(found);
        }
        return;
    }

    // Trim tool
    if (STATE.drawingTool === 'trim') {
        const pos = getMousePos(e, false);
        const found = findLineAtPoint(pos.x, pos.y);

        if (STATE.isShiftPressed) {
            if (found) {
                const item = found.line || found.shape;
                const idx = STATE.cuttingBlades.findIndex(b => b.item === item);
                if (idx > -1) {
                    STATE.cuttingBlades.splice(idx, 1);
                } else {
                    STATE.cuttingBlades.push({ item, type: found.type });
                }
                draw();
            }
        } else {
            if (found) {
                performTrim(found, pos);
            }
        }
        return;
    }

    // Line drawing tools
    if (!STATE.isDrawing) {
        STATE.isDrawing = true;
        STATE.startCoords = getMousePos(e, true);
        STATE.currentCoords = STATE.startCoords;
        if (STATE.drawingTool === 'arc' || STATE.drawingTool === 'iso-arc') {
            STATE.arcStep = 1;
            STATE.arcCenter = STATE.startCoords;
            STATE.arcStart = null;
        } else if (STATE.drawingTool === 'vp-rect') {
            STATE.vpRectStep = 0;
            STATE.vpRectPoint2 = null;
        }
    } else {
        if (STATE.drawingTool === 'arc' || STATE.drawingTool === 'iso-arc') {
            if (STATE.arcStep === 1) {
                STATE.arcStart = getMousePos(e, true);
                STATE.arcStep = 2;
                draw();
            } else if (STATE.arcStep === 2) {
                finishDrawing(e);
            }
        } else if (STATE.drawingTool === 'vp-rect') {
            if (STATE.isShiftPressed && STATE.vpRectStep === 0) {
                STATE.vpRectPoint2 = getMousePos(e, true);
                STATE.vpRectStep = 1;
                draw();
            } else {
                finishDrawing(e);
            }
        } else {
            finishDrawing(e);
        }
    }
});

function drawHandDrawnLine(ctx, line, isPreview = false) {
    const { start, end } = line;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}

function drawShapePoints(item, type) {
    const points = [];
    if (type === 'free' || type === 'vp') {
        points.push(item.start, item.end);
    } else if (type === 'circle' || type === 'ellipse') {
        points.push(item.center);
    } else if (type === 'arc' || type === 'isoArc') {
        points.push(item.center);
        const center = item.center;
        if (type === 'arc') {
            points.push({
                x: center.x + Math.cos(item.startAngle) * item.radius,
                y: center.y + Math.sin(item.startAngle) * item.radius
            });
            points.push({
                x: center.x + Math.cos(item.endAngle) * item.radius,
                y: center.y + Math.sin(item.endAngle) * item.radius
            });
        } else {
            const cosR = Math.cos(item.rotation);
            const sinR = Math.sin(item.rotation);
            const getPt = (ang) => {
                const sx = item.radiusX * Math.cos(ang);
                const sy = item.radiusY * Math.sin(ang);
                return {
                    x: sx * cosR - sy * sinR + center.x,
                    y: sx * sinR + sy * cosR + center.y
                };
            };
            points.push(getPt(item.startAngle));
            points.push(getPt(item.endAngle));
        }
    }

    points.forEach(p => {
        ctx.fillStyle = '#007bff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 / STATE.zoomLevel, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 / STATE.zoomLevel;
        ctx.stroke();
    });

    if (item.helperPoints) {
        item.helperPoints.forEach(p => {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 / STATE.zoomLevel, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1 / STATE.zoomLevel;
            ctx.stroke();
        });
    }
}

function finishDrawing(e) {
    STATE.isDrawing = false;

    if (STATE.drawingTool === 'vp-line') {
        let endPoint = STATE.currentCoords;
        if (STATE.snapToIntersection) {
            const intersection = findNearestLineIntersection(STATE.startCoords, endPoint);
            if (intersection) endPoint = intersection;
        }
        const newLine = {
            start: STATE.startCoords,
            end: endPoint,
            color: STATE.currentColor,
            lineWidth: STATE.currentLineWidth
        };
        const activeLayer = getActiveLayer();
        activeLayer.vpLines.push(newLine);
        addAction({ type: 'add', layerId: activeLayer.id, lineType: 'vp', line: newLine });
    } else if (STATE.drawingTool === 'parallel') {
        let endPoint = STATE.currentCoords;
        if (STATE.snapToIntersection) {
            const intersection = findNearestLineIntersection(STATE.startCoords, endPoint);
            if (intersection) endPoint = intersection;
        }
        const newLine = {
            start: STATE.startCoords,
            end: endPoint,
            color: STATE.currentColor,
            lineWidth: STATE.currentLineWidth
        };
        const activeLayer = getActiveLayer();
        activeLayer.lines.push(newLine);
        addAction({ type: 'add', layerId: activeLayer.id, lineType: 'free', line: newLine });
    } else if (STATE.drawingTool === 'free') {
        let endPoint = getMousePos(e, true);
        if (STATE.snapToIntersection) {
            const intersection = findNearestLineIntersection(STATE.startCoords, endPoint);
            if (intersection) endPoint = intersection;
        }
        const newLine = {
            start: STATE.startCoords,
            end: endPoint,
            color: STATE.currentColor,
            lineWidth: STATE.currentLineWidth
        };
        const activeLayer = getActiveLayer();
        activeLayer.lines.push(newLine);
        addAction({ type: 'add', layerId: activeLayer.id, lineType: 'free', line: newLine });
    } else if (STATE.drawingTool === 'rect') {
        const x1 = STATE.startCoords.x;
        const y1 = STATE.startCoords.y;
        const x2 = STATE.currentCoords.x;
        const y2 = STATE.currentCoords.y;

        const activeLayer = getActiveLayer();
        const addedItems = [];

        // Define 4 lines of the rectangle
        const rectLines = [
            { start: { x: x1, y: y1 }, end: { x: x2, y: y1 } },
            { start: { x: x2, y: y1 }, end: { x: x2, y: y2 } },
            { start: { x: x2, y: y2 }, end: { x: x1, y: y2 } },
            { start: { x: x1, y: y2 }, end: { x: x1, y: y1 } }
        ];

        rectLines.forEach(lineData => {
            const newLine = {
                ...lineData,
                color: STATE.currentColor,
                lineWidth: STATE.currentLineWidth
            };
            activeLayer.lines.push(newLine);
            addedItems.push({
                layerId: activeLayer.id,
                type: 'free',
                item: newLine,
                index: activeLayer.lines.length - 1
            });
        });

        addAction({
            type: 'add_multi',
            items: addedItems
        });
    } else if (STATE.drawingTool === 'vp-rect') {
        const p0 = STATE.startCoords;
        const p1 = (STATE.vpRectStep === 1) ? STATE.vpRectPoint2 : STATE.currentCoords;
        const p2 = (STATE.vpRectStep === 1) ? STATE.currentCoords : null;

        const corners = getVPRectCorners(p0, p1, p2);

        // Reset state
        STATE.vpRectStep = 0;
        STATE.vpRectPoint2 = null;

        if (corners) {
            const activeLayer = getActiveLayer();
            const addedItems = [];
            const rectLines = [
                { start: corners[0], end: corners[1] },
                { start: corners[1], end: corners[2] },
                { start: corners[2], end: corners[3] },
                { start: corners[3], end: corners[0] }
            ];

            rectLines.forEach(lineData => {
                const newLine = {
                    ...lineData,
                    color: STATE.currentColor,
                    lineWidth: STATE.currentLineWidth
                };
                activeLayer.lines.push(newLine);
                addedItems.push({
                    layerId: activeLayer.id,
                    type: 'free',
                    item: newLine,
                    index: activeLayer.lines.length - 1
                });
            });

            addAction({
                type: 'add_multi',
                items: addedItems
            });
        }
    } else if (STATE.drawingTool === 'circle') {
        const radiusPoint = STATE.currentCoords; // radius is determined by currentCoords (mouse + grid snap)
        const radius = Math.sqrt(
            Math.pow(STATE.startCoords.x - radiusPoint.x, 2) +
            Math.pow(STATE.startCoords.y - radiusPoint.y, 2)
        );

        const activeLayer = getActiveLayer();
        const refAngle = Math.atan2(radiusPoint.y - STATE.startCoords.y, radiusPoint.x - STATE.startCoords.x);

        if (STATE.snapToIntersection) {
            const intersections = getCircularIntersections(STATE.startCoords, radius);
            const foundIntersection = intersections.find(ang => {
                let d = (ang - refAngle + Math.PI * 2) % (Math.PI * 2);
                if (d > Math.PI) d = Math.PI * 2 - d;
                return d < 0.02;
            });

            const direction = STATE.isShiftPressed ? -1 : 1;
            let startAngle, endAngle;
            let anticlockwise = false;

            if (foundIntersection !== undefined) {
                // Pointing at intersection: select segment STARTING at this intersection
                startAngle = foundIntersection;
                endAngle = findNearestIntersectionOnCircularPath(STATE.startCoords, radius, startAngle, direction, null, intersections);
                anticlockwise = (direction === -1);
            } else {
                startAngle = findNearestIntersectionOnCircularPath(STATE.startCoords, radius, refAngle, -1, null, intersections);
                endAngle = findNearestIntersectionOnCircularPath(STATE.startCoords, radius, refAngle, 1, null, intersections);
                anticlockwise = false;
            }

            if (startAngle !== null && endAngle !== null && startAngle !== endAngle) {
                const newArc = {
                    center: { ...STATE.startCoords },
                    radius: radius,
                    startAngle: startAngle,
                    endAngle: endAngle,
                    anticlockwise: anticlockwise,
                    color: STATE.currentColor,
                    lineWidth: STATE.currentLineWidth
                };
                if (!activeLayer.arcs) activeLayer.arcs = [];
                activeLayer.arcs.push(newArc);
                addAction({ type: 'add', layerId: activeLayer.id, shapeType: 'arc', shape: newArc });
                draw();
                return;
            }
        }

        const newCircle = {
            center: { ...STATE.startCoords },
            radius: radius,
            color: STATE.currentColor,
            lineWidth: STATE.currentLineWidth
        };
        if (!activeLayer.circles) activeLayer.circles = [];
        activeLayer.circles.push(newCircle);
        addAction({ type: 'add', layerId: activeLayer.id, shapeType: 'circle', shape: newCircle });
    }
    else if (STATE.drawingTool === 'iso-circle') {
        const dx = STATE.currentCoords.x - STATE.startCoords.x;
        const dy = STATE.currentCoords.y - STATE.startCoords.y;

        let rotation = 0;
        if (STATE.isoPlane === 'right') rotation = Math.PI / 3;
        else if (STATE.isoPlane === 'left') rotation = 2 * Math.PI / 3;

        const lx = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
        const ly = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
        const radius = Math.sqrt(lx * lx + Math.pow(ly / 0.57735, 2));

        const radiusX = radius;
        const radiusY = radius * 0.57735;
        const activeLayer = getActiveLayer();

        if (STATE.snapToIntersection) {
            const intersections = getEllipticalIntersections(STATE.startCoords, radiusX, radiusY, rotation);
            const refAngle = Math.atan2(ly / radiusY, lx / radiusX);

            const foundIntersection = intersections.find(ang => {
                let d = (ang - refAngle + Math.PI * 2) % (Math.PI * 2);
                if (d > Math.PI) d = Math.PI * 2 - d;
                return d < 0.02;
            });

            const direction = STATE.isShiftPressed ? -1 : 1;
            let startAngle, endAngle;
            let anticlockwise = false;

            if (foundIntersection !== undefined) {
                // Pointing at intersection: select segment STARTING at this intersection
                startAngle = foundIntersection;
                endAngle = findNearestIntersectionOnEllipticalPath(STATE.startCoords, radiusX, radiusY, rotation, startAngle, direction, null, intersections);
                anticlockwise = (direction === -1);
            } else {
                // Pointing at segment: find BOUNDARIES of current segment
                startAngle = findNearestIntersectionOnEllipticalPath(STATE.startCoords, radiusX, radiusY, rotation, refAngle, -1, null, intersections);
                endAngle = findNearestIntersectionOnEllipticalPath(STATE.startCoords, radiusX, radiusY, rotation, refAngle, 1, null, intersections);
                anticlockwise = false;
            }

            if (startAngle !== null && endAngle !== null && startAngle !== endAngle) {
                const newIsoArc = {
                    center: { ...STATE.startCoords },
                    radiusX: radiusX,
                    radiusY: radiusY,
                    rotation: rotation,
                    startAngle: startAngle,
                    endAngle: endAngle,
                    anticlockwise: anticlockwise,
                    color: STATE.currentColor,
                    lineWidth: STATE.currentLineWidth
                };
                if (!activeLayer.isoArcs) activeLayer.isoArcs = [];
                activeLayer.isoArcs.push(newIsoArc);
                addAction({ type: 'add', layerId: activeLayer.id, shapeType: 'isoArc', shape: newIsoArc });
                draw();
                return;
            }
        }

        const newEllipse = {
            center: { ...STATE.startCoords },
            radiusX: radiusX,
            radiusY: radiusY,
            rotation: rotation,
            color: STATE.currentColor,
            lineWidth: STATE.currentLineWidth
        };
        if (!activeLayer.ellipses) activeLayer.ellipses = [];
        activeLayer.ellipses.push(newEllipse);
        addAction({ type: 'add', layerId: activeLayer.id, shapeType: 'ellipse', shape: newEllipse });
    }
    else if (STATE.drawingTool === 'arc') {
        const anticlockwise = STATE.isShiftPressed;
        let radiusPoint = STATE.arcStart;
        const radius = Math.sqrt(
            Math.pow(STATE.arcCenter.x - radiusPoint.x, 2) +
            Math.pow(STATE.arcCenter.y - radiusPoint.y, 2)
        );
        const startAngle = Math.atan2(radiusPoint.y - STATE.arcCenter.y, radiusPoint.x - STATE.arcCenter.x);

        let endPoint = STATE.currentCoords;
        let endAngle = Math.atan2(endPoint.y - STATE.arcCenter.y, endPoint.x - STATE.arcCenter.x);

        if (STATE.snapToIntersection) {
            const dir = anticlockwise ? -1 : 1;
            const intersectAngle = findNearestIntersectionOnCircularPath(STATE.arcCenter, radius, startAngle, dir, endAngle);
            if (intersectAngle !== null) {
                endAngle = intersectAngle;
            }
        }

        const newArc = {
            center: { ...STATE.arcCenter },
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            anticlockwise: anticlockwise,
            color: STATE.currentColor,
            lineWidth: STATE.currentLineWidth
        };
        const activeLayer = getActiveLayer();
        if (!activeLayer.arcs) activeLayer.arcs = [];
        activeLayer.arcs.push(newArc);
        addAction({ type: 'add', layerId: activeLayer.id, shapeType: 'arc', shape: newArc });
        STATE.arcStep = 0;
    }
    else if (STATE.drawingTool === 'iso-arc') {
        const anticlockwise = STATE.isShiftPressed;
        let radiusPoint = STATE.arcStart;
        const dx = radiusPoint.x - STATE.arcCenter.x;
        const dy = radiusPoint.y - STATE.arcCenter.y;

        let rotation = 0;
        if (STATE.isoPlane === 'right') rotation = Math.PI / 3;
        else if (STATE.isoPlane === 'left') rotation = 2 * Math.PI / 3;

        const rx = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
        const ry = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
        const radius = Math.sqrt(rx * rx + Math.pow(ry / 0.57735, 2));

        function getEllipseTheta(px, py, cx, cy, rx, ry, rot) {
            const tx = px - cx;
            const ty = py - cy;
            const ux = tx * Math.cos(-rot) - ty * Math.sin(-rot);
            const uy = tx * Math.sin(-rot) + ty * Math.cos(-rot);
            return Math.atan2(uy / ry, ux / rx);
        }

        const radiusX = radius;
        const radiusY = radius * 0.57735;

        const startTheta = getEllipseTheta(radiusPoint.x, radiusPoint.y, STATE.arcCenter.x, STATE.arcCenter.y, radiusX, radiusY, rotation);
        let endTheta = getEllipseTheta(STATE.currentCoords.x, STATE.currentCoords.y, STATE.arcCenter.x, STATE.arcCenter.y, radiusX, radiusY, rotation);

        if (STATE.snapToIntersection) {
            const direction = anticlockwise ? -1 : 1;
            const intersectAngle = findNearestIntersectionOnEllipticalPath(STATE.arcCenter, radiusX, radiusY, rotation, startTheta, direction, endTheta);
            if (intersectAngle !== null) {
                endTheta = intersectAngle;
            }
        }

        const newIsoArc = {
            center: { ...STATE.arcCenter },
            radiusX: radiusX,
            radiusY: radiusY,
            rotation: rotation,
            startAngle: startTheta,
            endAngle: endTheta,
            anticlockwise: anticlockwise,
            color: STATE.currentColor,
            lineWidth: STATE.currentLineWidth
        };
        const activeLayer = getActiveLayer();
        if (!activeLayer.isoArcs) activeLayer.isoArcs = [];
        activeLayer.isoArcs.push(newIsoArc);
        addAction({ type: 'add', layerId: activeLayer.id, shapeType: 'isoArc', shape: newIsoArc });
        STATE.arcStep = 0;
    }
    draw();
}

function drawHandDrawnCircle(ctx, circle) {
    const { center, radius } = circle;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
}

function drawHandDrawnArc(ctx, arc) {
    const { center, radius, startAngle, endAngle, anticlockwise } = arc;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, startAngle, endAngle, anticlockwise);
    ctx.stroke();
}

/**
 * Draws an ellipse (used for isometric circles)
 */
function drawHandDrawnEllipse(ctx, ellipse) {
    const { center, radiusX, radiusY, rotation } = ellipse;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radiusX, radiusY, rotation, 0, Math.PI * 2);
    ctx.stroke();
}

/**
 * Draws an isometric arc
 */
function drawHandDrawnIsoArc(ctx, isoArc) {
    const { center, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise } = isoArc;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise);
    ctx.stroke();
}


UI.canvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e, STATE.drawingTool !== 'select' || STATE.isMovingSelection);
    STATE.currentCoords = pos;
    STATE.rawMousePos = getMousePos(e, false);

    if (STATE.isPanning) {
        STATE.panX = e.clientX - STATE.panStartX;
        STATE.panY = e.clientY - STATE.panStartY;
        draw();
        return;
    }

    if (STATE.isMarqueeSelecting) {
        STATE.marqueeEnd = getMousePos(e, false);
        draw();
        return;
    }

    if (STATE.isMovingSelection && STATE.movingAnchorItem) {
        const mousePosRaw = getMousePos(e, false);
        const handle = STATE.moveSnapHandle;

        const potX = handle.x + (mousePosRaw.x - STATE.moveStartPos.x);
        const potY = handle.y + (mousePosRaw.y - STATE.moveStartPos.y);

        const rect = UI.canvas.getBoundingClientRect();
        const fakeEvt = {
            clientX: potX * STATE.zoomLevel + STATE.panX + rect.left,
            clientY: potY * STATE.zoomLevel + STATE.panY + rect.top
        };
        const snappedHandle = getMousePos(fakeEvt, true);

        const diffX = snappedHandle.x - handle.x;
        const diffY = snappedHandle.y - handle.y;

        STATE.moveCurrentPos = {
            x: STATE.moveStartPos.x + diffX,
            y: STATE.moveStartPos.y + diffY
        };

        draw();
        return;
    }

    if ((STATE.drawingTool === 'eraser' || STATE.drawingTool === 'trim' || STATE.drawingTool === 'split' || (STATE.drawingTool === 'parallel' && (!STATE.referenceLine || STATE.isShiftPressed))) && !STATE.isDrawing) {
        const useSnap = (STATE.drawingTool === 'split' && !!STATE.splitSelection);
        const pos = getMousePos(e, useSnap);
        const foundLine = findLineAtPoint(pos.x, pos.y);
        STATE.hoveredLine = foundLine;
        draw();
        return;
    }

    if (!STATE.isDrawing) {
        return;
    }

    if (STATE.drawingTool === 'vp-line') {
        const mousePos = getMousePos(e, false);
        const selectedVP = selectVPByDirection(STATE.startCoords, mousePos);

        if (selectedVP) {
            // 1. Projection and optional Grid Snap
            STATE.currentCoords = snapEndPointToGridLine(STATE.startCoords, mousePos, selectedVP, STATE.snapGrid);
        } else {
            // Fallback to mouse position if no VP exists
            STATE.currentCoords = mousePos;
        }
        draw();
    } else if (STATE.drawingTool === 'parallel') {
        if (STATE.referenceLine && STATE.referenceLine.start && STATE.referenceLine.end) {
            const refDx = STATE.referenceLine.end.x - STATE.referenceLine.start.x;
            const refDy = STATE.referenceLine.end.y - STATE.referenceLine.start.y;
            const refLength = Math.sqrt(refDx * refDx + refDy * refDy);

            if (refLength > 0) {
                const dirX = refDx / refLength;
                const dirY = refDy / refLength;
                const mousePos = getMousePos(e, false);
                const sx = STATE.startCoords.x;
                const sy = STATE.startCoords.y;
                const mx = mousePos.x;
                const my = mousePos.y;
                const v1x = mx - sx;
                const v1y = my - sy;
                const dot = v1x * dirX + v1y * dirY;

                STATE.currentCoords = {
                    x: sx + dot * dirX,
                    y: sy + dot * dirY
                };

                if (STATE.snapGrid) {
                    STATE.currentCoords = snapPointToGridLines(STATE.startCoords, STATE.currentCoords, dirX, dirY);
                }
            } else {
                STATE.currentCoords = getMousePos(e, true);
            }
        } else {
            STATE.currentCoords = getMousePos(e, true);
        }
        draw();
    } else {
        STATE.currentCoords = getMousePos(e, true);
        draw();
    }
});

UI.canvas.addEventListener('mouseup', (e) => {
    if (STATE.isPanning) {
        STATE.isPanning = false;
        UI.canvas.style.cursor = 'default';
    }

    if (STATE.isMarqueeSelecting) {
        STATE.isMarqueeSelecting = false;
        const start = STATE.marqueeStart;
        const end = STATE.marqueeEnd;

        STATE.layers.forEach(layer => {
            if (!layer.visible) return;

            layer.lines.forEach((line, i) => {
                if (isShapeInMarquee(line, 'free', start, end)) {
                    if (!isItemSelected(line, 'free')) STATE.selectedItems.push({ type: 'free', line: line, index: i, layerId: layer.id });
                }
            });
            layer.vpLines.forEach((line, i) => {
                if (isShapeInMarquee(line, 'vp', start, end)) {
                    if (!isItemSelected(line, 'vp')) STATE.selectedItems.push({ type: 'vp', line: line, index: i, layerId: layer.id });
                }
            });
            (layer.circles || []).forEach((circle, i) => {
                if (isShapeInMarquee(circle, 'circle', start, end)) {
                    if (!isItemSelected(circle, 'circle')) STATE.selectedItems.push({ type: 'circle', shape: circle, index: i, layerId: layer.id });
                }
            });
            (layer.arcs || []).forEach((arc, i) => {
                if (isShapeInMarquee(arc, 'arc', start, end)) {
                    if (!isItemSelected(arc, 'arc')) STATE.selectedItems.push({ type: 'arc', shape: arc, index: i, layerId: layer.id });
                }
            });
            (layer.ellipses || []).forEach((el, i) => {
                if (isShapeInMarquee(el, 'ellipse', start, end)) {
                    if (!isItemSelected(el, 'ellipse')) STATE.selectedItems.push({ type: 'ellipse', shape: el, index: i, layerId: layer.id });
                }
            });
            (layer.isoArcs || []).forEach((ia, i) => {
                if (isShapeInMarquee(ia, 'isoArc', start, end)) {
                    if (!isItemSelected(ia, 'isoArc')) STATE.selectedItems.push({ type: 'isoArc', shape: ia, index: i, layerId: layer.id });
                }
            });
        });

        STATE.marqueeStart = null;
        STATE.marqueeEnd = null;
        draw();
    }

    if (STATE.isMovingSelection) {
        STATE.isMovingSelection = false;
        const dx = STATE.moveCurrentPos.x - STATE.moveStartPos.x;
        const dy = STATE.moveCurrentPos.y - STATE.moveStartPos.y;

        if (dx !== 0 || dy !== 0) {
            STATE.selectedItems.forEach(sel => {
                const item = sel.line || sel.shape;
                if (sel.type === 'free' || sel.type === 'vp') {
                    item.start = { x: item.start.x + dx, y: item.start.y + dy };
                    item.end = { x: item.end.x + dx, y: item.end.y + dy };
                } else if (sel.type === 'circle' || sel.type === 'arc' || sel.type === 'ellipse' || sel.type === 'isoArc') {
                    item.center = { x: item.center.x + dx, y: item.center.y + dy };
                }
                if (item.helperPoints) {
                    item.helperPoints.forEach(p => {
                        p.x += dx;
                        p.y += dy;
                    });
                }
            });

            addAction({
                type: 'move',
                items: STATE.selectedItems.map(sel => ({
                    type: sel.type,
                    item: sel.line || sel.shape
                })),
                dx: dx,
                dy: dy
            });
        }
        STATE.moveStartPos = null;
        STATE.moveCurrentPos = null;
        STATE.movingAnchorItem = null;
        draw();
    }
});

// --- UI Event Handlers ---
UI.colorPicker.addEventListener('change', () => {
    STATE.currentColor = UI.colorPicker.value;
});

UI.undoButton.addEventListener('click', performUndo);

function performUndo() {
    const lastAction = STATE.actionHistory.pop();
    if (!lastAction) return;

    STATE.redoHistory.push(lastAction);

    if (lastAction.type === 'move') {
        lastAction.items.forEach(at => {
            if (at.type === 'free' || at.type === 'vp') {
                at.item.start.x -= lastAction.dx;
                at.item.start.y -= lastAction.dy;
                at.item.end.x -= lastAction.dx;
                at.item.end.y -= lastAction.dy;
            } else if (at.type === 'circle' || at.type === 'arc' || at.type === 'ellipse' || at.type === 'isoArc') {
                at.item.center.x -= lastAction.dx;
                at.item.center.y -= lastAction.dy;
            }
            if (at.item.helperPoints) {
                at.item.helperPoints.forEach(p => {
                    p.x -= lastAction.dx;
                    p.y -= lastAction.dy;
                });
            }
        });
        draw();
        return;
    }

    if (lastAction.type === 'add_helper_points') {
        if (lastAction.item && lastAction.item.helperPoints) {
            lastAction.points.forEach(p => {
                const idx = lastAction.item.helperPoints.indexOf(p);
                if (idx > -1) lastAction.item.helperPoints.splice(idx, 1);
            });
        }
        draw();
        return;
    }

    if (lastAction.type === 'clear_points') {
        if (lastAction.item) {
            lastAction.item.helperPoints = lastAction.points;
        }
        draw();
        return;
    }

    if (lastAction.type === 'add_points') {
        const layer = STATE.layers.find(l => l.id === lastAction.layerId);
        if (layer && layer.points) {
            lastAction.points.forEach(p => {
                const idx = layer.points.indexOf(p);
                if (idx > -1) layer.points.splice(idx, 1);
            });
        }
        draw();
        return;
    }

    if (lastAction.type === 'remove_and_add_multi') {
        lastAction.adds.forEach(add => {
            const l = STATE.layers.find(ly => ly.id === add.layerId);
            if (!l) return;
            let a;
            if (add.lineType === 'vp') a = l.vpLines;
            else if (add.lineType === 'free') a = l.lines;
            else if (add.shapeType === 'circle') a = l.circles;
            else if (add.shapeType === 'arc') a = l.arcs;
            else if (add.shapeType === 'ellipse') a = l.ellipses;
            else if (add.shapeType === 'isoArc') a = l.isoArcs;

            if (a) {
                const idx = a.indexOf(add.line || add.shape);
                if (idx > -1) a.splice(idx, 1);
            }
        });

        const layer = STATE.layers.find(l => l.id === lastAction.remove.layerId);
        if (layer) {
            const info = lastAction.remove;
            if (info.type === 'vp') layer.vpLines.splice(info.index, 0, info.item);
            else if (info.type === 'free') layer.lines.splice(info.index, 0, info.item);
            else if (info.type === 'circle') layer.circles.splice(info.index, 0, info.item);
            else if (info.type === 'arc') layer.arcs.splice(info.index, 0, info.item);
            else if (info.type === 'ellipse') layer.ellipses.splice(info.index, 0, info.item);
            else if (info.type === 'isoArc') layer.isoArcs.splice(info.index, 0, info.item);
        }
        draw();
        return;
    }
    if (lastAction.type === 'add_multi') {
        lastAction.items.forEach(info => {
            const layer = STATE.layers.find(l => l.id === info.layerId);
            if (!layer) return;
            let arr;
            if (info.type === 'vp') arr = layer.vpLines;
            else if (info.type === 'free') arr = layer.lines;
            else if (info.type === 'circle') arr = layer.circles;
            else if (info.type === 'arc') arr = layer.arcs;
            else if (info.type === 'ellipse') arr = layer.ellipses;
            else if (info.type === 'isoArc') arr = layer.isoArcs;

            if (arr) {
                const idx = arr.indexOf(info.item);
                if (idx > -1) arr.splice(idx, 1);
            }
        });
        draw();
        return;
    }

    if (lastAction.type === 'remove_multi') {
        const sorted = [...lastAction.items].sort((a, b) => a.index - b.index);
        sorted.forEach(info => {
            const layer = STATE.layers.find(l => l.id === info.layerId);
            if (!layer) return;

            if (info.type === 'vp') layer.vpLines.splice(info.index, 0, info.item);
            else if (info.type === 'free') layer.lines.splice(info.index, 0, info.item);
            else if (info.type === 'circle') layer.circles.splice(info.index, 0, info.item);
            else if (info.type === 'arc') layer.arcs.splice(info.index, 0, info.item);
            else if (info.type === 'ellipse') layer.ellipses.splice(info.index, 0, info.item);
            else if (info.type === 'isoArc') layer.isoArcs.splice(info.index, 0, info.item);
        });
        draw();
        return;
    }

    const layer = STATE.layers.find(l => l.id === lastAction.layerId);
    if (!layer) {
        draw();
        return;
    }

    if (lastAction.type === 'add') {
        if (lastAction.lineType === 'vp') {
            const idx = layer.vpLines.indexOf(lastAction.line);
            if (idx > -1) layer.vpLines.splice(idx, 1);
        } else if (lastAction.lineType === 'free') {
            const idx = layer.lines.indexOf(lastAction.line);
            if (idx > -1) layer.lines.splice(idx, 1);
        } else if (lastAction.fillType === 'fill') {
            const idx = layer.fills.indexOf(lastAction.fill);
            if (idx > -1) layer.fills.splice(idx, 1);
        } else if (lastAction.shapeType === 'circle') {
            const idx = layer.circles.indexOf(lastAction.shape);
            if (idx > -1) layer.circles.splice(idx, 1);
        } else if (lastAction.shapeType === 'arc') {
            const idx = layer.arcs.indexOf(lastAction.shape);
            if (idx > -1) layer.arcs.splice(idx, 1);
        } else if (lastAction.shapeType === 'ellipse') {
            const idx = layer.ellipses.indexOf(lastAction.shape);
            if (idx > -1) layer.ellipses.splice(idx, 1);
        } else if (lastAction.shapeType === 'isoArc') {
            const idx = layer.isoArcs.indexOf(lastAction.shape);
            if (idx > -1) layer.isoArcs.splice(idx, 1);
        }
    } else if (lastAction.type === 'remove') {
        if (lastAction.lineType === 'vp') {
            layer.vpLines.splice(lastAction.index, 0, lastAction.line);
        } else if (lastAction.lineType === 'free') {
            layer.lines.splice(lastAction.index, 0, lastAction.line);
        } else if (lastAction.fillType === 'fill') {
            layer.fills.splice(lastAction.index, 0, lastAction.fill);
        } else if (lastAction.shapeType === 'circle') {
            layer.circles.splice(lastAction.index, 0, lastAction.shape);
        } else if (lastAction.shapeType === 'arc') {
            layer.arcs.splice(lastAction.index, 0, lastAction.shape);
        } else if (lastAction.shapeType === 'ellipse') {
            layer.ellipses.splice(lastAction.index, 0, lastAction.shape);
        } else if (lastAction.shapeType === 'isoArc') {
            layer.isoArcs.splice(lastAction.index, 0, lastAction.shape);
        }
    }

    draw();
}

function performRedo() {
    const nextAction = STATE.redoHistory.pop();
    if (!nextAction) return;

    STATE.actionHistory.push(nextAction);

    if (nextAction.type === 'move') {
        nextAction.items.forEach(at => {
            if (at.type === 'free' || at.type === 'vp') {
                at.item.start.x += nextAction.dx;
                at.item.start.y += nextAction.dy;
                at.item.end.x += nextAction.dx;
                at.item.end.y += nextAction.dy;
            } else if (at.type === 'circle' || at.type === 'arc' || at.type === 'ellipse' || at.type === 'isoArc') {
                at.item.center.x += nextAction.dx;
                at.item.center.y += nextAction.dy;
            }
            if (at.item.helperPoints) {
                at.item.helperPoints.forEach(p => {
                    p.x += nextAction.dx;
                    p.y += nextAction.dy;
                });
            }
        });
        draw();
        return;
    }

    if (nextAction.type === 'add_helper_points') {
        if (nextAction.item) {
            if (!nextAction.item.helperPoints) nextAction.item.helperPoints = [];
            nextAction.item.helperPoints.push(...nextAction.points);
        }
        draw();
        return;
    }

    if (nextAction.type === 'clear_points') {
        if (nextAction.item) {
            nextAction.item.helperPoints = [];
        }
        draw();
        return;
    }

    if (nextAction.type === 'add_points') {
        const layer = STATE.layers.find(l => l.id === nextAction.layerId);
        if (layer) {
            if (!layer.points) layer.points = [];
            layer.points.push(...nextAction.points);
        }
        draw();
        return;
    }

    if (nextAction.type === 'remove_multi') {
        const sorted = [...nextAction.items].sort((a, b) => b.index - a.index);
        sorted.forEach(info => {
            const layer = STATE.layers.find(l => l.id === info.layerId);
            if (!layer) return;

            let arr;
            if (info.type === 'vp') arr = layer.vpLines;
            else if (info.type === 'free') arr = layer.lines;
            else if (info.type === 'circle') arr = layer.circles;
            else if (info.type === 'arc') arr = layer.arcs;
            else if (info.type === 'ellipse') arr = layer.ellipses;
            else if (info.type === 'isoArc') arr = layer.isoArcs;

            if (arr) {
                const idx = arr.indexOf(info.item);
                if (idx > -1) arr.splice(idx, 1);
            }
        });
        draw();
        return;
    }
    if (nextAction.type === 'add_multi') {
        nextAction.items.forEach(info => {
            const layer = STATE.layers.find(l => l.id === info.layerId);
            if (!layer) return;
            if (info.type === 'vp') layer.vpLines.push(info.item);
            else if (info.type === 'free') layer.lines.push(info.item);
            else if (info.type === 'circle') layer.circles.push(info.item);
            else if (info.type === 'arc') layer.arcs.push(info.item);
            else if (info.type === 'ellipse') layer.ellipses.push(info.item);
            else if (info.type === 'isoArc') layer.isoArcs.push(info.item);
        });
        draw();
        return;
    }

    if (nextAction.type === 'remove_and_add_multi') {
        const layerR = STATE.layers.find(l => l.id === nextAction.remove.layerId);
        if (layerR) {
            const item = nextAction.remove.item;
            let r;
            if (nextAction.remove.type === 'vp') r = layerR.vpLines;
            else if (nextAction.remove.type === 'free') r = layerR.lines;
            else if (nextAction.remove.type === 'circle') r = layerR.circles;
            else if (nextAction.remove.type === 'arc') r = layerR.arcs;
            else if (nextAction.remove.type === 'ellipse') r = layerR.ellipses;
            else if (nextAction.remove.type === 'isoArc') r = layerR.isoArcs;
            if (r) {
                const idx = r.indexOf(item);
                if (idx > -1) r.splice(idx, 1);
            }
        }

        nextAction.adds.forEach(add => {
            const l = STATE.layers.find(ly => ly.id === add.layerId);
            if (!l) return;
            if (add.lineType === 'vp') l.vpLines.push(add.line);
            else if (add.lineType === 'free') l.lines.push(add.line);
            else if (add.shapeType === 'circle') l.circles.push(add.shape);
            else if (add.shapeType === 'arc') l.arcs.push(add.shape);
            else if (add.shapeType === 'ellipse') l.ellipses.push(add.shape);
            else if (add.shapeType === 'isoArc') l.isoArcs.push(add.shape);
        });
        draw();
        return;
    }

    const layer = STATE.layers.find(l => l.id === nextAction.layerId);
    if (!layer) {
        draw();
        return;
    }

    if (nextAction.type === 'add') {
        if (nextAction.lineType === 'vp') {
            layer.vpLines.push(nextAction.line);
        } else if (nextAction.lineType === 'free') {
            layer.lines.push(nextAction.line);
        } else if (nextAction.fillType === 'fill') {
            layer.fills.push(nextAction.fill);
        } else if (nextAction.shapeType === 'circle') {
            layer.circles.push(nextAction.shape);
        } else if (nextAction.shapeType === 'arc') {
            layer.arcs.push(nextAction.shape);
        } else if (nextAction.shapeType === 'ellipse') {
            layer.ellipses.push(nextAction.shape);
        } else if (nextAction.shapeType === 'isoArc') {
            layer.isoArcs.push(nextAction.shape);
        }
    } else if (nextAction.type === 'remove') {
        if (nextAction.lineType === 'vp') {
            const idx = layer.vpLines.indexOf(nextAction.line);
            if (idx > -1) layer.vpLines.splice(idx, 1);
        } else if (nextAction.lineType === 'free') {
            const idx = layer.lines.indexOf(nextAction.line);
            if (idx > -1) layer.lines.splice(idx, 1);
        } else if (nextAction.fillType === 'fill') {
            const idx = layer.fills.indexOf(nextAction.fill);
            if (idx > -1) layer.fills.splice(idx, 1);
        } else if (nextAction.shapeType === 'circle') {
            const idx = layer.circles.indexOf(nextAction.shape);
            if (idx > -1) layer.circles.splice(idx, 1);
        } else if (nextAction.shapeType === 'arc') {
            const idx = layer.arcs.indexOf(nextAction.shape);
            if (idx > -1) layer.arcs.splice(idx, 1);
        } else if (nextAction.shapeType === 'ellipse') {
            const idx = layer.ellipses.indexOf(nextAction.shape);
            if (idx > -1) layer.ellipses.splice(idx, 1);
        } else if (nextAction.shapeType === 'isoArc') {
            const idx = layer.isoArcs.indexOf(nextAction.shape);
            if (idx > -1) layer.isoArcs.splice(idx, 1);
        }
    }
    draw();
}

UI.redoButton.addEventListener('click', performRedo);

window.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
        STATE.isShiftPressed = true;
        if ((STATE.drawingTool === 'arc' || STATE.drawingTool === 'circle' || STATE.drawingTool === 'iso-arc' || STATE.drawingTool === 'iso-circle') && STATE.isDrawing) draw();
    }

    if (e.code === 'Space' && !e.repeat) {
        STATE.isSpacePressed = true;
        if (!STATE.isPanning && !STATE.isDrawing) {
            UI.canvas.style.cursor = 'grab';
        }
        // Prevent space from scrolling the page and triggering focused buttons
        e.preventDefault();
    }

    // Check for Ctrl+Z (Undo) and Ctrl+Y (Redo)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        performUndo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        performRedo();
    }
    if (e.key === 'Escape') {
        if (STATE.isDrawing) {
            STATE.isDrawing = false;
            STATE.referenceLine = null;
            draw();
        }
        if (STATE.selectedItems.length > 0) {
            STATE.selectedItems = [];
            draw();
        }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete if not in an input field (already handled by browser generally, but good to be safe)
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            deleteSelectedItems();
        }
    }

    // Clipboard shortcuts: Ctrl+C, Ctrl+X, Ctrl+V
    if ((e.ctrlKey || e.metaKey) && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        if (e.key.toLowerCase() === 'c') {
            e.preventDefault();
            copySelectedItems();
        } else if (e.key.toLowerCase() === 'x') {
            e.preventDefault();
            cutSelectedItems();
        } else if (e.key.toLowerCase() === 'v') {
            e.preventDefault();
            pasteItems();
        }
    }

    if (e.key.toLowerCase() === 't' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const planes = ['top', 'left', 'right'];
        const currentIdx = planes.indexOf(STATE.isoPlane);
        const nextIdx = (currentIdx + 1) % planes.length;
        STATE.isoPlane = planes[nextIdx];

        // Update UI
        UI.isoPlaneRadios.forEach(radio => {
            radio.checked = (radio.value === STATE.isoPlane);
        });

        draw();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') {
        STATE.isShiftPressed = false;
        if ((STATE.drawingTool === 'arc' || STATE.drawingTool === 'circle' || STATE.drawingTool === 'iso-arc' || STATE.drawingTool === 'iso-circle') && STATE.isDrawing) draw();
    }
    if (e.code === 'Space') {
        STATE.isSpacePressed = false;
        if (!STATE.isPanning) {
            UI.canvas.style.cursor = 'default';
        }
    }
});

UI.toolRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        STATE.drawingTool = radio.value;
        STATE.isDrawing = false; // Abort drawing on tool switch
        STATE.arcStep = 0;
        STATE.hoveredLine = null; // Clear hover when switching tools
        STATE.referenceLine = null; // Clear reference line
        // Clear active VP when switching away from vp-line tool
        if (STATE.drawingTool !== 'vp-line') {
            STATE.activeVP = null;
        }

        if (STATE.drawingTool === 'iso-circle' || STATE.drawingTool === 'iso-arc') {
            UI.isoPlanesGroup.style.display = 'block';
        } else {
            UI.isoPlanesGroup.style.display = 'none';
        }
        STATE.cuttingBlades = [];
        STATE.splitSelection = null;
        draw();
    });
});

UI.isoPlaneRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        STATE.isoPlane = radio.value;
        draw();
    });
});

const toolGroups = document.querySelectorAll('.tool-group-container');
let longPressTimer = null;

toolGroups.forEach(group => {
    const btn = group.querySelector('.group-btn');
    const menu = group.querySelector('.sub-tool-menu');
    const radio = btn.querySelector('input[type="radio"]');
    const options = group.querySelectorAll('.sub-tool-option');

    const openMenu = () => {
        // Close all other menus first
        document.querySelectorAll('.tool-group-container').forEach(g => g.classList.remove('menu-open'));

        // Calculate position since sidebar has overflow: auto
        const rect = btn.getBoundingClientRect();
        menu.style.top = `${rect.top + rect.height / 2}px`;
        menu.style.left = `${rect.right + 10}px`;

        group.classList.add('menu-open');
    };

    const closeMenu = () => {
        group.classList.remove('menu-open');
    };

    btn.addEventListener('mousedown', (e) => {
        longPressTimer = setTimeout(openMenu, 500);
    });

    const cancelLongPress = () => {
        clearTimeout(longPressTimer);
    };

    btn.addEventListener('mouseup', cancelLongPress);
    btn.addEventListener('mouseleave', cancelLongPress);

    // Also support right-click to open menu immediately
    btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openMenu();
    });

    options.forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const value = opt.dataset.value;
            const title = opt.title;
            const iconClass = opt.dataset.icon;
            const iconType = opt.dataset.type; // 'regular' or 'solid'

            // Update main button
            radio.value = value;
            btn.title = title;

            const mainIcon = btn.querySelector('i, svg');
            const subIcon = opt.querySelector('i, svg');
            if (mainIcon && subIcon) {
                const newIcon = subIcon.cloneNode(true);
                mainIcon.replaceWith(newIcon);
            }

            // Check the radio and trigger change
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));

            // Update active state in menu
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            closeMenu();
        });
    });
});

// Close tool menus when clicking outside
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.tool-group-container')) {
        document.querySelectorAll('.tool-group-container').forEach(g => g.classList.remove('menu-open'));
    }
});

// Close tool menus on sidebar scroll
UI.sidebar = document.getElementById('sidebar');
if (UI.sidebar) {
    UI.sidebar.addEventListener('scroll', () => {
        document.querySelectorAll('.tool-group-container').forEach(g => g.classList.remove('menu-open'));
    });
}



// New and updated listeners
UI.snapToggle.addEventListener('change', () => { STATE.snapGrid = UI.snapToggle.checked; });
UI.snapEndpointToggle.addEventListener('change', () => { STATE.snapToEndpoint = UI.snapEndpointToggle.checked; });
UI.snapLineIntersectionToggle.addEventListener('change', () => {
    STATE.snapToLineIntersection = UI.snapLineIntersectionToggle.checked;
    if (STATE.snapToLineIntersection) {
        STATE.lineIntersectionPoints = calculateAllLineIntersections();
    }
});
UI.snapGridLineIntersectionToggle.addEventListener('change', () => { STATE.snapToGridLineIntersection = UI.snapGridLineIntersectionToggle.checked; });
UI.snapIntersectionToggle.addEventListener('change', () => { STATE.snapToIntersection = UI.snapIntersectionToggle.checked; });
UI.grid2DToggle.addEventListener('change', () => { STATE.show2DGrid = UI.grid2DToggle.checked; draw(); });
UI.gridOnTopToggle.addEventListener('change', () => { STATE.gridOnTop = UI.gridOnTopToggle.checked; draw(); });
UI.showVPsToggle.addEventListener('change', () => { STATE.showVPs = UI.showVPsToggle.checked; draw(); });
UI.showPointsToggle.addEventListener('change', () => { STATE.showPoints = UI.showPointsToggle.checked; draw(); });
UI.showMeasurementsToggle.addEventListener('change', () => { STATE.showMeasurements = UI.showMeasurementsToggle.checked; draw(); });

UI.gridHalveButton.addEventListener('click', () => {
    const newSize = Math.max(CONFIG.GRID_SIZE_MIN, Math.floor(STATE.gridSize2D / 2));
    STATE.gridSize2D = newSize;
    UI.grid2DDensityValue.textContent = `${STATE.gridSize2D}px`;
    draw();
});

UI.gridDoubleButton.addEventListener('click', () => {
    const newSize = Math.min(CONFIG.GRID_SIZE_MAX, STATE.gridSize2D * 2);
    STATE.gridSize2D = newSize;
    UI.grid2DDensityValue.textContent = `${STATE.gridSize2D}px`;
    draw();
});

UI.grid2DDensityValue.addEventListener('click', () => {
    STATE.gridSize2D = CONFIG.DEFAULT_GRID_SIZE;
    UI.grid2DDensityValue.textContent = `${STATE.gridSize2D}px`;
    draw();
});

UI.gridTypeSelect.addEventListener('change', () => {
    STATE.gridType = UI.gridTypeSelect.value;
    draw();
});

UI.lineWidthSlider.addEventListener('input', () => {
    STATE.currentLineWidth = parseInt(UI.lineWidthSlider.value);
    UI.lineWidthValue.textContent = `${STATE.currentLineWidth}px`;
    // No need to redraw yet, only affects new lines
});

UI.zoomInButton.addEventListener('click', () => {
    STATE.zoomLevel = Math.min(STATE.zoomLevel * CONFIG.ZOOM_FACTOR_BUTTON, CONFIG.ZOOM_MAX);
    UI.zoomValue.textContent = `${Math.round(STATE.zoomLevel * 100)}%`;
    draw();
});

UI.zoomOutButton.addEventListener('click', () => {
    STATE.zoomLevel = Math.max(STATE.zoomLevel / CONFIG.ZOOM_FACTOR_BUTTON, CONFIG.ZOOM_MIN);
    // Auto-center when returning to 100%
    if (STATE.zoomLevel === CONFIG.ZOOM_MIN) {
        STATE.panX = 0;
        STATE.panY = 0;
    }
    UI.zoomValue.textContent = `${Math.round(STATE.zoomLevel * 100)}%`;
    draw();
});

UI.zoomValue.addEventListener('click', () => {
    STATE.zoomLevel = CONFIG.ZOOM_MIN;
    STATE.panX = 0;
    STATE.panY = 0;
    UI.zoomValue.textContent = '100%';
    draw();
});

// Mouse wheel zoom
UI.canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = UI.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate world position before zoom
    const worldX = (mouseX - STATE.panX) / STATE.zoomLevel;
    const worldY = (mouseY - STATE.panY) / STATE.zoomLevel;

    // Update zoom level
    const zoomFactor = e.deltaY < 0 ? CONFIG.ZOOM_FACTOR_WHEEL : (1 / CONFIG.ZOOM_FACTOR_WHEEL);
    const oldZoom = STATE.zoomLevel;
    STATE.zoomLevel = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, STATE.zoomLevel * zoomFactor));

    // Auto-center when returning to 100%
    if (STATE.zoomLevel === CONFIG.ZOOM_MIN) {
        STATE.panX = 0;
        STATE.panY = 0;
    } else {
        // Adjust pan to keep mouse position stable
        STATE.panX = mouseX - worldX * STATE.zoomLevel;
        STATE.panY = mouseY - worldY * STATE.zoomLevel;
    }

    UI.zoomValue.textContent = `${Math.round(STATE.zoomLevel * 100)}%`;
    draw();
}, { passive: false });


UI.clearCanvasButton.addEventListener('click', async () => {
    const confirmed = await showConfirmDialog("Haluatko varmasti tyhjentää koko piirroksen?", "Vahvista tyhjentäminen");
    if (confirmed) {
        // Reset layers to initial state
        STATE.layers = [
            {
                id: 1,
                name: "Layer 1",
                visible: true,
                selected: false,
                lines: [],
                vpLines: [],
                circles: [],
                arcs: [],
                ellipses: [],
                isoArcs: [],
                fills: []
            }
        ];
        STATE.activeLayerId = 1;
        STATE.nextLayerId = 2;
        STATE.actionHistory.length = 0;
        STATE.redoHistory.length = 0;
        STATE.hoveredLine = null;
        STATE.referenceLine = null;
        updateLayersList();
        rebuildFillLayer();
        draw();
    }
});

// Layer management
UI.addLayerButton.addEventListener('click', () => {
    const newLayer = {
        id: STATE.nextLayerId++,
        name: `Layer ${STATE.nextLayerId - 1}`,
        visible: true,
        selected: false,
        lines: [],
        vpLines: [],
        circles: [],
        arcs: [],
        ellipses: [],
        isoArcs: [],
        fills: []
    };
    STATE.layers.push(newLayer);
    STATE.activeLayerId = newLayer.id;
    updateLayersList();
});

UI.mergeLayersButton.addEventListener('click', mergeSelectedLayers);

async function mergeSelectedLayers() {
    const selectedLayers = STATE.layers.filter(l => l.selected);
    if (selectedLayers.length < 2) {
        await showAlertDialog("Valitse vähintään kaksi tasoa yhdistettäväksi!", "Huomio");
        return;
    }

    const confirmed = await showConfirmDialog(`Haluatko varmasti yhdistää ${selectedLayers.length} tasoa?`, "Vahvista yhdistäminen");
    if (!confirmed) return;

    // Sort selected layers by their index in STATE.layers to find the bottom-most one
    const layerIndices = selectedLayers.map(l => STATE.layers.indexOf(l)).sort((a, b) => a - b);
    const baseLayerIndex = layerIndices[0];
    const baseLayer = STATE.layers[baseLayerIndex];

    // Combine content
    for (let i = 1; i < layerIndices.length; i++) {
        const sourceLayer = STATE.layers[layerIndices[i]];
        baseLayer.lines.push(...sourceLayer.lines);
        baseLayer.vpLines.push(...sourceLayer.vpLines);
        baseLayer.circles.push(...(sourceLayer.circles || []));
        baseLayer.arcs.push(...(sourceLayer.arcs || []));
        baseLayer.ellipses.push(...(sourceLayer.ellipses || []));
        baseLayer.isoArcs.push(...(sourceLayer.isoArcs || []));
        baseLayer.fills.push(...sourceLayer.fills);
    }

    // Remove merged layers (except base)
    for (let i = layerIndices.length - 1; i >= 1; i--) {
        STATE.layers.splice(layerIndices[i], 1);
    }

    // Set base layer as active if any of the merged layers was active
    if (selectedLayers.some(l => l.id === STATE.activeLayerId)) {
        STATE.activeLayerId = baseLayer.id;
    }

    // Reset selection
    STATE.layers.forEach(l => l.selected = false);

    updateLayersList();
    rebuildFillLayer();
    draw();
}

// --- Project Management ---

UI.saveJsonButton.addEventListener('click', () => {
    const projectData = {
        version: "2.0", // Layer version
        layers: STATE.layers,
        vanishingPoints: STATE.vanishingPoints,
        activeLayerId: STATE.activeLayerId,
        nextLayerId: STATE.nextLayerId,
        actionHistory: STATE.actionHistory,
        redoHistory: STATE.redoHistory
    };

    let filename = prompt("Anna tiedoston nimi:", "projekti.json");
    if (!filename) return;
    if (!filename.toLowerCase().endsWith(".json")) filename += ".json";

    const json = JSON.stringify(projectData);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 100);
});

UI.loadJsonButton.addEventListener('click', () => {
    UI.jsonFileInput.click();
});

UI.jsonFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (data.version === "2.0" && data.layers) {
                STATE.layers.length = 0;
                STATE.layers.push(...data.layers);
                STATE.activeLayerId = data.activeLayerId || STATE.layers[0]?.id || 1;
                STATE.nextLayerId = data.nextLayerId || (Math.max(...STATE.layers.map(l => l.id)) + 1);
            } else {
                STATE.layers.length = 0;
                STATE.layers.push({
                    id: 1,
                    name: "Layer 1",
                    visible: true,
                    selected: false,
                    lines: data.lines || [],
                    vpLines: data.vpLines || [],
                    circles: data.circles || [],
                    arcs: data.arcs || [],
                    ellipses: data.ellipses || [],
                    isoArcs: data.isoArcs || [],
                    fills: data.fills || []
                });
                STATE.activeLayerId = 1;
                STATE.nextLayerId = 2;
            }

            STATE.vanishingPoints.length = 0;
            STATE.vanishingPoints.push(...(data.vanishingPoints || []));

            STATE.actionHistory.length = 0;
            if (data.actionHistory) STATE.actionHistory.push(...data.actionHistory);

            STATE.redoHistory.length = 0;
            if (data.redoHistory) STATE.redoHistory.push(...data.redoHistory);

            updateLayersList();
            rebuildFillLayer();
            draw();
        } catch (err) {
            showAlertDialog("Virhe tiedoston latauksessa: " + err.message, "Latausvirhe");
        }
    };
    reader.readAsText(file);
    // Reset file input so same file can be loaded again if needed
    e.target.value = '';
});

UI.exportImageButton.addEventListener('click', () => {
    // Save as image file.
    // Let's create a temporary canvas to draw a "clean" version.

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = UI.canvas.width;
    exportCanvas.height = UI.canvas.height;
    const exCtx = exportCanvas.getContext('2d');
    exCtx.lineCap = 'round';
    exCtx.lineJoin = 'round';

    exCtx.fillStyle = '#ffffff';
    exCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exCtx.drawImage(fillCanvas, 0, 0);

    // 4. Draw Lines from all visible layers
    STATE.layers.forEach(layer => {
        if (!layer.visible) return;

        layer.lines.forEach(line => {
            exCtx.strokeStyle = line.color || '#000000';
            exCtx.lineWidth = line.lineWidth || 2;
            drawHandDrawnLine(exCtx, { ...line });
        });

        layer.vpLines.forEach(vpLine => {
            exCtx.strokeStyle = vpLine.color || '#000000';
            exCtx.lineWidth = vpLine.lineWidth || 2;
            drawHandDrawnLine(exCtx, { ...vpLine });
        });

        (layer.circles || []).forEach(circle => {
            exCtx.strokeStyle = circle.color || '#000000';
            exCtx.lineWidth = circle.lineWidth || 2;
            drawHandDrawnCircle(exCtx, { ...circle });
        });

        (layer.arcs || []).forEach(arc => {
            exCtx.strokeStyle = arc.color || '#000000';
            exCtx.lineWidth = arc.lineWidth || 2;
            drawHandDrawnArc(exCtx, { ...arc });
        });
    });

    // Generate link and download
    const dataURL = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.style.display = 'none';
    link.download = `piirros_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
    }, 100);
});


function draw() {
    ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, UI.canvas.width, UI.canvas.height);
    ctx.save();
    ctx.translate(STATE.panX, STATE.panY);
    ctx.scale(STATE.zoomLevel, STATE.zoomLevel);

    rebuildFillLayer();
    if (!STATE.gridOnTop) {
        drawGrids();
    }

    // Draw fill layer in SCREEN SPACE (reset transform temporarily)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(fillCanvas, 0, 0);
    ctx.restore();

    ctx.imageSmoothingEnabled = true;

    if (STATE.gridOnTop) {
        drawGrids();
    }

    // Update line intersection points cache if snap to line intersections is enabled
    if (STATE.snapToLineIntersection) {
        STATE.lineIntersectionPoints = calculateAllLineIntersections();
    }

    if (STATE.showVPs) {
        drawVanishingPoints();
    }
    const moveDx = STATE.isMovingSelection ? STATE.moveCurrentPos.x - STATE.moveStartPos.x : 0;
    const moveDy = STATE.isMovingSelection ? STATE.moveCurrentPos.y - STATE.moveStartPos.y : 0;

    STATE.layers.forEach(layer => {
        if (!layer.visible) return;

        // Draw free lines
        ctx.lineCap = 'round';
        layer.lines.forEach(line => {
            const selected = isItemSelected(line, 'free');
            ctx.save();
            if (selected && STATE.isMovingSelection) {
                ctx.translate(moveDx, moveDy);
            }
            if (selected) {
                drawItemHighlight(ctx, line, 'free', 'rgba(0, 123, 255, 0.4)');
            }
            ctx.strokeStyle = line.color || '#555';
            ctx.lineWidth = line.lineWidth || 2;
            drawHandDrawnLine(ctx, { ...line });
            if (STATE.showPoints) drawShapePoints(line, 'free');
            ctx.restore();
        });

        // Draw VP lines
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        layer.vpLines.forEach(vpLine => {
            const selected = isItemSelected(vpLine, 'vp');
            ctx.save();
            if (selected && STATE.isMovingSelection) {
                ctx.translate(moveDx, moveDy);
            }
            if (selected) {
                drawItemHighlight(ctx, vpLine, 'vp', 'rgba(0, 123, 255, 0.4)');
            }
            ctx.strokeStyle = vpLine.color || '#00aa00';
            ctx.lineWidth = vpLine.lineWidth || 2;
            drawHandDrawnLine(ctx, { ...vpLine });
            if (STATE.showPoints) drawShapePoints(vpLine, 'vp');
            ctx.restore();
        });

        // Draw circles
        (layer.circles || []).forEach(circle => {
            const selected = isItemSelected(circle, 'circle');
            ctx.save();
            if (selected && STATE.isMovingSelection) {
                ctx.translate(moveDx, moveDy);
            }
            if (selected) {
                drawItemHighlight(ctx, circle, 'circle', 'rgba(0, 123, 255, 0.4)');
            }
            ctx.strokeStyle = circle.color || '#555';
            ctx.lineWidth = circle.lineWidth || 2;
            drawHandDrawnCircle(ctx, { ...circle });
            if (STATE.showPoints) drawShapePoints(circle, 'circle');
            ctx.restore();
        });

        // Draw arcs
        (layer.arcs || []).forEach(arc => {
            const selected = isItemSelected(arc, 'arc');
            ctx.save();
            if (selected && STATE.isMovingSelection) {
                ctx.translate(moveDx, moveDy);
            }
            if (selected) {
                drawItemHighlight(ctx, arc, 'arc', 'rgba(0, 123, 255, 0.4)');
            }
            ctx.strokeStyle = arc.color || '#555';
            ctx.lineWidth = arc.lineWidth || 2;
            drawHandDrawnArc(ctx, { ...arc });
            if (STATE.showPoints) drawShapePoints(arc, 'arc');
            ctx.restore();
        });

        // Draw ellipses
        (layer.ellipses || []).forEach(el => {
            const selected = isItemSelected(el, 'ellipse');
            ctx.save();
            if (selected && STATE.isMovingSelection) {
                ctx.translate(moveDx, moveDy);
            }
            if (selected) {
                drawItemHighlight(ctx, el, 'ellipse', 'rgba(0, 123, 255, 0.4)');
            }
            ctx.strokeStyle = el.color || '#555';
            ctx.lineWidth = el.lineWidth || 2;
            drawHandDrawnEllipse(ctx, { ...el });
            if (STATE.showPoints) drawShapePoints(el, 'ellipse');
            ctx.restore();
        });

        // Draw iso arcs
        (layer.isoArcs || []).forEach(ia => {
            const selected = isItemSelected(ia, 'isoArc');
            ctx.save();
            if (selected && STATE.isMovingSelection) {
                ctx.translate(moveDx, moveDy);
            }
            if (selected) {
                drawItemHighlight(ctx, ia, 'isoArc', 'rgba(0, 123, 255, 0.4)');
            }
            ctx.strokeStyle = ia.color || '#555';
            ctx.lineWidth = ia.lineWidth || 2;
            drawHandDrawnIsoArc(ctx, { ...ia });
            if (STATE.showPoints) drawShapePoints(ia, 'isoArc');
            ctx.restore();
        });

        // Draw standalone points
        if (STATE.showPoints) {
            (layer.points || []).forEach(p => {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4 / STATE.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1 / STATE.zoomLevel;
                ctx.stroke();
            });
        }
    });

    // Draw cutting blades highlight
    if (STATE.drawingTool === 'trim' && STATE.cuttingBlades.length > 0) {
        // Bug fix: remove blades that no longer exist in any layer
        const allItems = new Set();
        STATE.layers.forEach(layer => {
            layer.lines.forEach(l => allItems.add(l));
            layer.vpLines.forEach(l => allItems.add(l));
            layer.circles.forEach(l => allItems.add(l));
            layer.arcs.forEach(l => allItems.add(l));
            layer.ellipses.forEach(l => allItems.add(l));
            layer.isoArcs.forEach(l => allItems.add(l));
        });
        STATE.cuttingBlades = STATE.cuttingBlades.filter(blade => allItems.has(blade.item));

        STATE.cuttingBlades.forEach(blade => {
            drawItemHighlight(ctx, blade.item, blade.type, 'rgba(255, 140, 0, 0.9)', true); // Orange dashed
        });
    }

    // Draw marquee box
    if (STATE.isMarqueeSelecting && STATE.marqueeStart && STATE.marqueeEnd) {
        ctx.strokeStyle = '#007bff';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const x = STATE.marqueeStart.x;
        const y = STATE.marqueeStart.y;
        const w = STATE.marqueeEnd.x - x;
        const h = STATE.marqueeEnd.y - y;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(0, 123, 255, 0.1)';
        ctx.fillRect(x, y, w, h);
        ctx.setLineDash([]);
    }

    if (STATE.hoveredLine) {
        const shapeFound = STATE.hoveredLine;
        const item = shapeFound.line || shapeFound.shape;

        if (STATE.drawingTool === 'eraser') {
            drawItemHighlight(ctx, item, shapeFound.type, 'rgba(255, 0, 0, 0.4)');
        } else if (STATE.drawingTool === 'parallel') {
            const isLine = shapeFound.type === 'free' || shapeFound.type === 'vp';
            const canSelect = (!STATE.referenceLine || STATE.isShiftPressed) && isLine;
            if (canSelect) {
                drawItemHighlight(ctx, item, shapeFound.type, 'rgba(0, 255, 0, 0.4)');
            }
        } else if (STATE.drawingTool === 'trim' || STATE.drawingTool === 'split') {
            if (STATE.drawingTool === 'trim' && STATE.isShiftPressed) {
                const isBlade = STATE.cuttingBlades.some(b => b.item === item);
                const color = isBlade ? 'rgba(200, 50, 0, 0.7)' : 'rgba(255, 165, 0, 0.7)';
                drawItemHighlight(ctx, item, shapeFound.type, color);
            } else if (STATE.drawingTool === 'split') {
                drawItemHighlight(ctx, item, shapeFound.type, 'rgba(0, 123, 255, 0.4)');
            } else {
                const seg = getTrimSegment(item, shapeFound.type, STATE.rawMousePos);
                if (seg) {
                    drawSegmentHighlight(ctx, item, shapeFound.type, seg.s, seg.e, 'rgba(255, 0, 0, 0.5)');
                } else {
                    drawItemHighlight(ctx, item, shapeFound.type, 'rgba(200, 200, 200, 0.3)');
                }
            }
        }
    }

    // Draw split preview
    if (STATE.drawingTool === 'split' && STATE.splitSelection) {
        const sel = STATE.splitSelection;
        const target = sel.found.line || sel.found.shape;
        const type = sel.found.type;
        const n = sel.n;
        const worldPos = STATE.currentCoords;

        let startAngle = 0;
        if (type === 'circle') {
            startAngle = Math.atan2(worldPos.y - target.center.y, worldPos.x - target.center.x);
        } else if (type === 'ellipse') {
            const dx = worldPos.x - target.center.x;
            const dy = worldPos.y - target.center.y;
            const cosR = Math.cos(-target.rotation);
            const sinR = Math.sin(-target.rotation);
            const lx = dx * cosR - dy * sinR;
            const ly = dx * sinR + dy * cosR;
            startAngle = Math.atan2(ly / target.radiusY, lx / target.radiusX);
        }

        for (let i = 0; i < n; i++) {
            const ang = startAngle + (i / n) * Math.PI * 2;
            let px, py;
            if (type === 'circle') {
                px = target.center.x + Math.cos(ang) * target.radius;
                py = target.center.y + Math.sin(ang) * target.radius;
            } else {
                const cosR = Math.cos(target.rotation);
                const sinR = Math.sin(target.rotation);
                const ex = target.radiusX * Math.cos(ang);
                const ey = target.radiusY * Math.sin(ang);
                px = ex * cosR - ey * sinR + target.center.x;
                py = ex * sinR + ey * cosR + target.center.y;
            }

            if (i === 0) {
                // Main selection point
                ctx.fillStyle = '#007bff';
                ctx.beginPath();
                ctx.arc(px, py, 6 / STATE.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1 / STATE.zoomLevel;
                ctx.stroke();

                // Selection line from center
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'rgba(0, 123, 255, 0.5)';
                ctx.beginPath();
                ctx.moveTo(target.center.x, target.center.y);
                ctx.lineTo(px, py);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // Faint result points
                ctx.fillStyle = 'rgba(0, 123, 255, 0.3)';
                ctx.beginPath();
                ctx.arc(px, py, 3 / STATE.zoomLevel, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }


    // Draw reference line for parallel tool
    if (STATE.drawingTool === 'parallel' && STATE.referenceLine) {
        ctx.strokeStyle = '#00cc00'; // Green for reference
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(STATE.referenceLine.start.x, STATE.referenceLine.start.y);
        ctx.lineTo(STATE.referenceLine.end.x, STATE.referenceLine.end.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (STATE.isDrawing) {
        ctx.strokeStyle = STATE.currentColor;
        ctx.lineWidth = STATE.currentLineWidth;
        if (STATE.drawingTool === 'vp-line') {
            let drawEnd = STATE.currentCoords;
            let intersection = null;

            if (STATE.snapToIntersection) {
                intersection = findNearestLineIntersection(STATE.startCoords, STATE.currentCoords);
                if (intersection) {
                    drawEnd = intersection;
                }
            }

            ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]);
            drawHandDrawnLine(ctx, {
                start: STATE.startCoords,
                end: drawEnd
            });

            if (intersection) {
                ctx.strokeStyle = '#ff7700';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(intersection.x, intersection.y);
                ctx.lineTo(STATE.currentCoords.x, STATE.currentCoords.y);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(intersection.x, intersection.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1.0;

            // Measurement
            if (STATE.showMeasurements) drawMeasurement(ctx, STATE.startCoords, drawEnd);

            // Markers
            ctx.fillStyle = STATE.currentColor;
            ctx.beginPath();
            ctx.arc(STATE.startCoords.x, STATE.startCoords.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(drawEnd.x, drawEnd.y, 4, 0, Math.PI * 2);
            ctx.fill();
        } else if (STATE.drawingTool === 'rect') {
            const x1 = STATE.startCoords.x;
            const y1 = STATE.startCoords.y;
            const x2 = STATE.currentCoords.x;
            const y2 = STATE.currentCoords.y;

            ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
            ctx.setLineDash([]);

            const rectLines = [
                { start: { x: x1, y: y1 }, end: { x: x2, y: y1 } },
                { start: { x: x2, y: y1 }, end: { x: x2, y: y2 } },
                { start: { x: x2, y: y2 }, end: { x: x1, y: y2 } },
                { start: { x: x1, y: y2 }, end: { x: x1, y: y1 } }
            ];

            rectLines.forEach((line, i) => {
                drawHandDrawnLine(ctx, {
                    ...line
                });
            });

            ctx.globalAlpha = 1.0;
            if (STATE.showMeasurements) drawMeasurement(ctx, STATE.startCoords, STATE.currentCoords);
        } else if (STATE.drawingTool === 'vp-rect') {
            const p0 = STATE.startCoords;
            const p1 = (STATE.vpRectStep === 1) ? STATE.vpRectPoint2 : STATE.currentCoords;
            const p2 = (STATE.vpRectStep === 1) ? STATE.currentCoords : null;

            const corners = getVPRectCorners(p0, p1, p2);
            if (corners) {
                ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
                ctx.setLineDash([]);
                const rectLines = [
                    { start: corners[0], end: corners[1] },
                    { start: corners[1], end: corners[2] },
                    { start: corners[2], end: corners[3] },
                    { start: corners[3], end: corners[0] }
                ];
                rectLines.forEach((line, i) => {
                    drawHandDrawnLine(ctx, {
                        ...line
                    });
                });
                ctx.globalAlpha = 1.0;
                if (STATE.showMeasurements) drawMeasurement(ctx, STATE.startCoords, STATE.currentCoords);
            }
        }
        else if (STATE.drawingTool === 'parallel') {
            let drawEnd = STATE.currentCoords;
            let intersection = null;

            if (STATE.snapToIntersection) {
                intersection = findNearestLineIntersection(STATE.startCoords, STATE.currentCoords);
                if (intersection) {
                    drawEnd = intersection;
                }
            }

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]);
            drawHandDrawnLine(ctx, {
                start: STATE.startCoords,
                end: drawEnd
            });

            if (intersection) {
                // Draw dashed line for the cut off part
                ctx.strokeStyle = '#ff7700';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(intersection.x, intersection.y);
                ctx.lineTo(STATE.currentCoords.x, STATE.currentCoords.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Intersection point
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(intersection.x, intersection.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Measurement
            if (STATE.showMeasurements) drawMeasurement(ctx, STATE.startCoords, drawEnd);
        } else if (STATE.drawingTool === 'free') {
            if (STATE.snapToIntersection && STATE.drawingTool === 'free') {
                const intersection = findNearestLineIntersection(STATE.startCoords, STATE.currentCoords);

                if (intersection) {
                    // Draw solid line from start to intersection (this will be saved)
                    ctx.strokeStyle = '#007bff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([]); // Solid line
                    drawHandDrawnLine(ctx, {
                        start: STATE.startCoords,
                        end: intersection
                    });

                    // Draw dashed line from intersection to current position (this will be discarded)
                    ctx.strokeStyle = '#ff7700';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]); // Dashed line
                    ctx.beginPath();
                    ctx.moveTo(intersection.x, intersection.y);
                    ctx.lineTo(STATE.currentCoords.x, STATE.currentCoords.y);
                    ctx.stroke();
                    ctx.setLineDash([]); // Reset to solid

                    // Draw small circle at intersection point
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(intersection.x, intersection.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // No intersection, draw normal preview
                    ctx.strokeStyle = '#007bff';
                    ctx.lineWidth = 2;
                    drawHandDrawnLine(ctx, {
                        start: STATE.startCoords,
                        end: STATE.currentCoords
                    });
                }
            } else {
                // Normal free line preview (no intersection snapping)
                ctx.strokeStyle = '#007bff';
                ctx.lineWidth = 2;
                drawHandDrawnLine(ctx, {
                    start: STATE.startCoords,
                    end: STATE.currentCoords
                });
            }

            // Measurement
            if (STATE.showMeasurements) drawMeasurement(ctx, STATE.startCoords, STATE.currentCoords);
        } else if (STATE.drawingTool === 'circle') {
            const radiusPoint = STATE.currentCoords;
            const radius = Math.sqrt(
                Math.pow(STATE.startCoords.x - radiusPoint.x, 2) +
                Math.pow(STATE.startCoords.y - radiusPoint.y, 2)
            );

            const refAngle = Math.atan2(radiusPoint.y - STATE.startCoords.y, radiusPoint.x - STATE.startCoords.x);
            let drawStartAngle = refAngle;
            let drawEndAngle = refAngle + Math.PI * 2;
            let pathIntersectionStart = null;
            let pathIntersectionEnd = null;
            let drawAnticlockwise = false;

            if (STATE.snapToIntersection) {
                const intersections = getCircularIntersections(STATE.startCoords, radius);
                const foundIntersection = intersections.find(ang => {
                    let d = (ang - refAngle + Math.PI * 2) % (Math.PI * 2);
                    if (d > Math.PI) d = Math.PI * 2 - d;
                    return d < 0.02;
                });

                const direction = STATE.isShiftPressed ? -1 : 1;
                let startAngle, endAngle;

                if (foundIntersection !== undefined) {
                    startAngle = foundIntersection;
                    endAngle = findNearestIntersectionOnCircularPath(STATE.startCoords, radius, startAngle, direction, null, intersections);
                    drawAnticlockwise = (direction === -1);
                } else {
                    startAngle = findNearestIntersectionOnCircularPath(STATE.startCoords, radius, refAngle, -1, null, intersections);
                    endAngle = findNearestIntersectionOnCircularPath(STATE.startCoords, radius, refAngle, 1, null, intersections);
                    drawAnticlockwise = false;
                }

                if (startAngle !== null && endAngle !== null && startAngle !== endAngle) {
                    drawStartAngle = startAngle;
                    drawEndAngle = endAngle;

                    pathIntersectionStart = {
                        x: STATE.startCoords.x + Math.cos(startAngle) * radius,
                        y: STATE.startCoords.y + Math.sin(startAngle) * radius
                    };
                    pathIntersectionEnd = {
                        x: STATE.startCoords.x + Math.cos(endAngle) * radius,
                        y: STATE.startCoords.y + Math.sin(endAngle) * radius
                    };
                }
            }

            ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
            drawHandDrawnArc(ctx, {
                center: STATE.startCoords,
                radius: radius,
                startAngle: drawStartAngle,
                endAngle: drawEndAngle,
                anticlockwise: drawAnticlockwise
            });

            if (pathIntersectionStart) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(pathIntersectionStart.x, pathIntersectionStart.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            if (pathIntersectionEnd) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(pathIntersectionEnd.x, pathIntersectionEnd.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalAlpha = 1.0;
        } else if (STATE.drawingTool === 'arc') {
            if (STATE.arcStep === 1) {
                ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(STATE.arcCenter.x, STATE.arcCenter.y, radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1.0;
            } else if (STATE.arcStep === 2) {
                // Showing arc preview
                const anticlockwise = STATE.isShiftPressed;
                const radius = Math.sqrt(
                    Math.pow(STATE.arcCenter.x - STATE.arcStart.x, 2) +
                    Math.pow(STATE.arcCenter.y - STATE.arcStart.y, 2)
                );
                const startAngle = Math.atan2(STATE.arcStart.y - STATE.arcCenter.y, STATE.arcStart.x - STATE.arcCenter.x);
                let endAngle = Math.atan2(STATE.currentCoords.y - STATE.arcCenter.y, STATE.currentCoords.x - STATE.arcCenter.x);
                let pathIntersection = null;

                if (STATE.snapToIntersection) {
                    const dir = anticlockwise ? -1 : 1;
                    const intersectAngle = findNearestIntersectionOnCircularPath(STATE.arcCenter, radius, startAngle, dir, endAngle);
                    if (intersectAngle !== null) {
                        endAngle = intersectAngle;
                        pathIntersection = {
                            x: STATE.arcCenter.x + Math.cos(intersectAngle) * radius,
                            y: STATE.arcCenter.y + Math.sin(intersectAngle) * radius
                        };
                    }
                }

                ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
                drawHandDrawnArc(ctx, {
                    center: STATE.arcCenter,
                    radius: radius,
                    startAngle: startAngle,
                    endAngle: endAngle,
                    anticlockwise: anticlockwise
                });

                if (pathIntersection) {
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(pathIntersection.x, pathIntersection.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;
            }
        } else if (STATE.drawingTool === 'iso-circle') {
            const dx = STATE.currentCoords.x - STATE.startCoords.x;
            const dy = STATE.currentCoords.y - STATE.startCoords.y;

            let rotation = 0;
            if (STATE.isoPlane === 'right') rotation = Math.PI / 3;
            else if (STATE.isoPlane === 'left') rotation = 2 * Math.PI / 3;

            const lx = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
            const ly = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
            const radius = Math.sqrt(lx * lx + Math.pow(ly / 0.57735, 2));

            const radiusX = radius;
            const radiusY = radius * 0.57735;

            let drawStartAngle = 0;
            let drawEndAngle = Math.PI * 2;
            let drawAnticlockwise = false;
            let pathIntersectionStart = null;
            let pathIntersectionEnd = null;

            if (STATE.snapToIntersection) {
                const intersections = getEllipticalIntersections(STATE.startCoords, radiusX, radiusY, rotation);
                const refAngle = Math.atan2(ly / radiusY, lx / radiusX);

                const foundIntersection = intersections.find(ang => {
                    let d = (ang - refAngle + Math.PI * 2) % (Math.PI * 2);
                    if (d > Math.PI) d = Math.PI * 2 - d;
                    return d < 0.02;
                });

                const direction = STATE.isShiftPressed ? -1 : 1;
                let startAngle, endAngle;

                if (foundIntersection !== undefined) {
                    startAngle = foundIntersection;
                    endAngle = findNearestIntersectionOnEllipticalPath(STATE.startCoords, radiusX, radiusY, rotation, startAngle, direction, null, intersections);
                    drawAnticlockwise = (direction === -1);
                } else {
                    startAngle = findNearestIntersectionOnEllipticalPath(STATE.startCoords, radiusX, radiusY, rotation, refAngle, -1, null, intersections);
                    endAngle = findNearestIntersectionOnEllipticalPath(STATE.startCoords, radiusX, radiusY, rotation, refAngle, 1, null, intersections);
                    drawAnticlockwise = false;
                }

                if (startAngle !== null && endAngle !== null && startAngle !== endAngle) {
                    drawStartAngle = startAngle;
                    drawEndAngle = endAngle;

                    const cosR = Math.cos(rotation);
                    const sinR = Math.sin(rotation);
                    const getPt = (ang) => {
                        const x = radiusX * Math.cos(ang);
                        const y = radiusY * Math.sin(ang);
                        return {
                            x: x * cosR - y * sinR + STATE.startCoords.x,
                            y: x * sinR + y * cosR + STATE.startCoords.y
                        };
                    };
                    pathIntersectionStart = getPt(startAngle);
                    pathIntersectionEnd = getPt(endAngle);
                }
            }

            ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
            drawHandDrawnIsoArc(ctx, {
                center: STATE.startCoords,
                radiusX: radiusX,
                radiusY: radiusY,
                rotation: rotation,
                startAngle: drawStartAngle,
                endAngle: drawEndAngle,
                anticlockwise: drawAnticlockwise
            });

            if (pathIntersectionStart) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(pathIntersectionStart.x, pathIntersectionStart.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            if (pathIntersectionEnd) {
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(pathIntersectionEnd.x, pathIntersectionEnd.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
        } else if (STATE.drawingTool === 'iso-arc') {
            if (STATE.arcStep === 1) {
                const radiusPoint = STATE.currentCoords;
                let rotation = 0;
                if (STATE.isoPlane === 'right') rotation = Math.PI / 3;
                else if (STATE.isoPlane === 'left') rotation = 2 * Math.PI / 3;

                const dx = radiusPoint.x - STATE.arcCenter.x;
                const dy = radiusPoint.y - STATE.arcCenter.y;
                const rx = dx * Math.cos(-rotation) - dy * Math.sin(-rotation);
                const ry = dx * Math.sin(-rotation) + dy * Math.cos(-rotation);
                const radius = Math.sqrt(rx * rx + Math.pow(ry / 0.57735, 2));

                ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.ellipse(STATE.arcCenter.x, STATE.arcCenter.y, radius, radius * 0.57735, rotation, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1.0;
            } else if (STATE.arcStep === 2) {
                const anticlockwise = STATE.isShiftPressed;
                let rotation = 0;
                if (STATE.isoPlane === 'right') rotation = Math.PI / 3;
                else if (STATE.isoPlane === 'left') rotation = 2 * Math.PI / 3;

                const dx_r = STATE.arcStart.x - STATE.arcCenter.x;
                const dy_r = STATE.arcStart.y - STATE.arcCenter.y;
                const rx_r = dx_r * Math.cos(-rotation) - dy_r * Math.sin(-rotation);
                const ry_r = dx_r * Math.sin(-rotation) + dy_r * Math.cos(-rotation);
                const radius = Math.sqrt(rx_r * rx_r + Math.pow(ry_r / 0.57735, 2));

                function getEllipseTheta(px, py, cx, cy, rx, ry, rot) {
                    const tx = px - cx;
                    const ty = py - cy;
                    const ux = tx * Math.cos(-rot) - ty * Math.sin(-rot);
                    const uy = tx * Math.sin(-rot) + ty * Math.cos(-rot);
                    return Math.atan2(uy / ry, ux / rx);
                }
                const radiusX = radius;
                const radiusY = radius * 0.57735;
                const startTheta = getEllipseTheta(STATE.arcStart.x, STATE.arcStart.y, STATE.arcCenter.x, STATE.arcCenter.y, radiusX, radiusY, rotation);
                let endTheta = getEllipseTheta(STATE.currentCoords.x, STATE.currentCoords.y, STATE.arcCenter.x, STATE.arcCenter.y, radiusX, radiusY, rotation);
                let pathIntersection = null;

                if (STATE.snapToIntersection) {
                    const direction = anticlockwise ? -1 : 1;
                    const intersectAngle = findNearestIntersectionOnEllipticalPath(STATE.arcCenter, radiusX, radiusY, rotation, startTheta, direction, endTheta);
                    if (intersectAngle !== null) {
                        endTheta = intersectAngle;
                        const cosR = Math.cos(rotation);
                        const sinR = Math.sin(rotation);
                        const bx = radiusX * Math.cos(endTheta);
                        const by = radiusY * Math.sin(endTheta);
                        pathIntersection = {
                            x: bx * cosR - by * sinR + STATE.arcCenter.x,
                            y: bx * sinR + by * cosR + STATE.arcCenter.y
                        };
                    }
                }

                ctx.globalAlpha = CONFIG.PREVIEW_ALPHA;
                drawHandDrawnIsoArc(ctx, {
                    center: STATE.arcCenter,
                    radiusX: radiusX,
                    radiusY: radiusY,
                    rotation: rotation,
                    startAngle: startTheta,
                    endAngle: endTheta,
                    anticlockwise: anticlockwise
                });
                if (pathIntersection) {
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(pathIntersection.x, pathIntersection.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.globalAlpha = 1.0;
            }
        }

    }

    // Restore context after transformations
    ctx.restore();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
updateLayersList(); // Initialize layers list on startup


function rebuildFillLayer() {
    // We render the fill layer in SCREEN SPACE to match the current zoom/pan perfectly.
    fillCtx.clearRect(0, 0, fillCanvas.width, fillCanvas.height);

    const allFills = getAllFills();
    if (allFills.length === 0) {
        STATE.fillIndexMap = null;
        return;
    }

    const w = UI.canvas.width;
    const h = UI.canvas.height;

    // Create a boundary mask that matches the screen exactly
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');

    // Apply current transformation to mask
    maskCtx.save();
    maskCtx.translate(STATE.panX, STATE.panY);
    maskCtx.scale(STATE.zoomLevel, STATE.zoomLevel);

    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'miter';
    maskCtx.miterLimit = 100;

    const allLines = getAllLines();
    const allVPLines = getAllVPLines();
    const allCircles = getAllCircles();
    const allArcs = getAllArcs();
    const allEllipses = getAllEllipses();
    const allIsoArcs = getAllIsoArcs();

    // Draw boundaries to mask. 
    // Constant 1px screen-space width for the mask ensures the fill 
    // has room to enter corners and the dilation has room to work.
    const drawToMask = (items, drawFn) => {
        items.forEach(item => {
            maskCtx.strokeStyle = '#000000';
            maskCtx.lineWidth = 1.0 / STATE.zoomLevel;
            drawFn(maskCtx, item);
        });
    };

    drawToMask(allLines, (c, i) => {
        c.beginPath();
        c.moveTo(i.start.x, i.start.y);
        c.lineTo(i.end.x, i.end.y);
        c.stroke();
    });
    drawToMask(allVPLines, (c, i) => {
        c.beginPath();
        c.moveTo(i.start.x, i.start.y);
        c.lineTo(i.end.x, i.end.y);
        c.stroke();
    });
    drawToMask(allCircles, (c, i) => {
        c.beginPath();
        c.arc(i.center.x, i.center.y, i.radius, 0, Math.PI * 2);
        c.stroke();
    });
    drawToMask(allArcs, (c, i) => {
        c.beginPath();
        c.arc(i.center.x, i.center.y, i.radius, i.startAngle, i.endAngle, i.anticlockwise);
        c.stroke();
    });
    drawToMask(allEllipses, (c, i) => {
        c.beginPath();
        c.ellipse(i.center.x, i.center.y, i.radiusX, i.radiusY, i.rotation, 0, Math.PI * 2);
        c.stroke();
    });
    drawToMask(allIsoArcs, (c, i) => {
        c.beginPath();
        c.ellipse(i.center.x, i.center.y, i.radiusX, i.radiusY, i.rotation, i.startAngle, i.endAngle, i.anticlockwise);
        c.stroke();
    });

    maskCtx.restore();

    const maskData = maskCtx.getImageData(0, 0, w, h).data;
    const buffer = new Uint8Array(w * h);
    for (let i = 0; i < buffer.length; i++) {
        // Threshold: pixels with some opacity in mask become the boundary
        if (maskData[i * 4 + 3] > 40) buffer[i] = 1;
    }

    const fillPixels = fillCtx.createImageData(w, h);
    const outData = new Uint32Array(fillPixels.data.buffer);
    STATE.fillIndexMap = new Array(w * h).fill(null);

    STATE.layers.forEach(layer => {
        if (!layer.visible) return;

        layer.fills.forEach((fill, fillIdx) => {
            const r = parseInt(fill.color.substr(1, 2), 16);
            const g = parseInt(fill.color.substr(3, 2), 16);
            const b = parseInt(fill.color.substr(5, 2), 16);
            const color32 = (255 << 24) | (b << 16) | (g << 8) | r;

            // MULTI-SEED STRATEGY: Find the first available seed that's on camera.
            // This prevents the fill from disappearing when the original click point is off-screen.
            if (!fill.seeds) fill.seeds = [{ x: fill.x, y: fill.y }];

            let startX, startY;
            let foundSeed = false;

            for (const s of fill.seeds) {
                const sx = Math.round(s.x * STATE.zoomLevel + STATE.panX);
                const sy = Math.round(s.y * STATE.zoomLevel + STATE.panY);

                if (sx >= 0 && sx < w && sy >= 0 && sy < h && buffer[sy * w + sx] === 0) {
                    startX = sx;
                    startY = sy;
                    foundSeed = true;
                    break;
                }
            }

            if (!foundSeed) return;

            const startIdx = startY * w + startX;
            const q = [startIdx];
            const processed = new Uint8Array(w * h);
            processed[startIdx] = 1;

            outData[startIdx] = color32;
            STATE.fillIndexMap[startIdx] = { layerId: layer.id, fillIndex: fillIdx };

            let head = 0;
            while (head < q.length) {
                const curr = q[head++];
                const cx = curr % w;
                const cy = (curr / w) | 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = cx + dx;
                        const ny = cy + dy;

                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            const ni = ny * w + nx;
                            if (buffer[ni] === 0 && processed[ni] === 0) {
                                processed[ni] = 1;
                                outData[ni] = color32;
                                STATE.fillIndexMap[ni] = { layerId: layer.id, fillIndex: fillIdx };
                                q.push(ni);
                            }
                        }
                    }
                }
            }

            // UPDATE BREADCRUMBS: Sample the currently visible area to find up to 20 robust seeds 
            // for the next frame. This "drags" the seed along as the user pans.
            if (q.length > 0) {
                const newSeeds = [{ x: fill.x, y: fill.y }]; // Always keep the master seed
                const sampleCount = 20;
                const step = Math.max(1, Math.floor(q.length / sampleCount));
                for (let i = 0; i < q.length && newSeeds.length < sampleCount; i += step) {
                    const idx = q[i];
                    newSeeds.push({
                        x: (idx % w - STATE.panX) / STATE.zoomLevel,
                        y: ((idx / w | 0) - STATE.panY) / STATE.zoomLevel
                    });
                }
                fill.seeds = newSeeds;
            }
        });
    });

    // HALO REMOVAL: Expand color into the boundary pixels (dilation)
    // 3 passes ensure the color goes deep under the line edges.
    // Limited to buffer[ni] === 1 so it NEVER leaks across lines.
    for (let pass = 0; pass < 3; pass++) {
        const originalData = new Uint32Array(outData);
        const originalMap = STATE.fillIndexMap.slice();
        for (let i = 0; i < w * h; i++) {
            if (originalData[i] !== 0) {
                const color = originalData[i];
                const fIdx = originalMap[i];
                const cx = i % w;
                const cy = (i / w) | 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = cx + dx;
                        const ny = cy + dy;
                        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                            const ni = ny * w + nx;
                            if (outData[ni] === 0 && buffer[ni] === 1) {
                                outData[ni] = color;
                                STATE.fillIndexMap[ni] = fIdx;
                            }
                        }
                    }
                }
            }
        }
    }

    fillCtx.putImageData(fillPixels, 0, 0);
}

