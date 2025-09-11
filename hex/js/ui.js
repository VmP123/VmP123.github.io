import { GameStatus, PlayerType, SpecialPhaseType, TurnPhase, CombatResultsTable } from './constants.js';
import { on, trigger } from './state.js';

export class InfoArea {
    constructor(gameState, hexGrid, zoomFunction) {
        this.gameState = gameState;
        this.hexGrid = hexGrid;
        this.zoomFunction = zoomFunction;
        this.svg = null;

        on('combatResultUpdated', () => {
            this.refreshCombatResultText();
            this.highlightCrtResult();
        });
        on('winnerUpdated', this.refreshStatusText.bind(this));
        on('currentSpecialPhaseUpdated', this.updatePhaseText.bind(this));
        on('currentSpecialPhaseUpdated', this.refreshStatusText.bind(this));
        on('currentSpecialPhaseUpdated', this.refreshEndPhaseButton.bind(this));

        on('phaseChanged', () => {
            this.updatePhaseText();
            this.updatePlayerText();
            this.highlightCrtResult(); // Clear highlight on phase change
        });
    }

    updatePhaseText() {
        let currentPhase = null;

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            currentPhase = currentSpecialPhase.toUpperCase();
        }
        else if (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE) {
            currentPhase = "assign".toUpperCase();
        }
        else {
            currentPhase = this.gameState.currentTurnPhase.toUpperCase();
        }

        this.svg.querySelector('.phase').textContent = "PHASE: " + currentPhase;
    }

    updatePlayerText() {
        this.svg.querySelector('.turn').textContent = "PLAYER: " + this.gameState.activePlayer.toUpperCase();
    }

    refreshCombatResultText() {
        const value = this.gameState.crtColumn != null && this.gameState.d6Value != null 
            ? this.gameState.crtColumn.ratioText + ", " + 
              this.gameState.d6Value + ", " + 
              this.gameState.crtColumn[this.gameState.d6Value]
            : '-';

        this.svg.querySelector('.combatResult').textContent = "COMBAT: " + value;
    }

    refreshStatusText() {
        const statusText = this.svg.querySelector('.statusText');

        if (this.gameState.winner !== null) {
            statusText.textContent = this.gameState.winner.toUpperCase() + " PLAYER WON";
        }
        else if (this.gameState.getCurrentSpecialPhase() === SpecialPhaseType.ATTACKER_DAMAGE) {
            statusText.textContent = `Assign damage to attacker, ${this.gameState.unassignedDamagePoints} left`;
        }
        else if (this.gameState.getCurrentSpecialPhase() === SpecialPhaseType.ADVANCE) {
            statusText.textContent = `Advance to vacated hex?`;
        }
        else {
            statusText.textContent = "";
        }
    }

    refreshEndPhaseButton() {
        const endPhaseButtonText = this.svg.querySelector('.endPhaseButton .buttonText');

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();
        const color = currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE ? "grey" : "black";
        endPhaseButtonText.setAttribute('fill', color);
    }

    endPhase() {
        trigger('endPhaseRequested');
    }

    draw() {
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const svgNS = 'http://www.w3.org/2000/svg';

        const createTextElement = (content, className) => {
            const textElement = document.createElementNS(svgNS, 'text');
            textElement.setAttribute('fill', 'black');
            textElement.setAttribute('font-family', "Arial, sans-serif");
            textElement.setAttribute('font-size', '22px');
            textElement.style.userSelect = 'none';
            if (className) {
                textElement.setAttribute('class', className);
            }
            textElement.textContent = content;
            return textElement;
        };

        const createSeparator = (y) => {
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', 20);
            line.setAttribute('y1', y);
            line.setAttribute('x2', 330);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', '#ccc');
            line.setAttribute('stroke-width', '1');
            return line;
        };

        const x = 50;
        let currentY = 40;

        // --- 1. Game Status Group ---
        const playerText = createTextElement("PLAYER: " + this.gameState.activePlayer.toUpperCase(), 'turn');
        playerText.setAttribute('x', x);
        playerText.setAttribute('y', currentY);
        this.svg.appendChild(playerText);
        currentY += 30;

        const phaseText = createTextElement("PHASE: " + this.gameState.currentTurnPhase.toUpperCase(), 'phase');
        phaseText.setAttribute('x', x);
        phaseText.setAttribute('y', currentY);
        this.svg.appendChild(phaseText);
        currentY += 30;

        const combatResultText = createTextElement("COMBAT: -", 'combatResult');
        combatResultText.setAttribute('x', x);
        combatResultText.setAttribute('y', currentY);
        this.svg.appendChild(combatResultText);
        currentY += 30;

        // --- 2. Action Group ---
        const statusText = createTextElement("", 'statusText');
        statusText.setAttribute('x', x);
        statusText.setAttribute('y', currentY);
        // statusText.setAttribute('font-style', 'italic');
        statusText.setAttribute('font-size', '20px');
        statusText.setAttribute('fill', 'red');
        this.svg.appendChild(statusText);
        this.refreshStatusText(); // Initial population
        currentY += 40;

        const endPhaseButton = this.createButtonSVG(120, 35, "End Phase");
        endPhaseButton.setAttribute('class', 'endPhaseButton');
        endPhaseButton.setAttribute('x', x - 2);
        endPhaseButton.setAttribute('y', currentY);
        this.svg.appendChild(endPhaseButton);
        endPhaseButton.addEventListener('click', () => this.endPhase());
        currentY += 55;

        this.svg.appendChild(createSeparator(currentY));
        currentY += 40;

        // --- 3. Combat Info Group ---
        const crt = this.drawCrt(x, currentY);
        this.svg.appendChild(crt);
        const crtHeight = crt.getBBox().height;
        currentY += crtHeight + 30;

        // --- 4. View Controls Group (at bottom) ---
        const zoomButton = this.createButtonSVG(100, 30, "Zoom");
        zoomButton.setAttribute('x', x - 2);
        zoomButton.setAttribute('y', 880 - 60);
        this.svg.appendChild(zoomButton);
        zoomButton.addEventListener('click', () => this.zoomFunction());
    }

    highlightCrtResult() {
        const highlightsGroup = this.svg.querySelector('.crt-highlights');
        if (!highlightsGroup) return;

        // Clear previous highlights
        while (highlightsGroup.firstChild) {
            highlightsGroup.removeChild(highlightsGroup.firstChild);
        }

        if (!this.gameState.crtColumn || !this.gameState.d6Value) {
            return;
        }

        const rowIndex = CombatResultsTable.indexOf(this.gameState.crtColumn);
        const colIndex = this.gameState.d6Value; // d6Value is 1-6

        if (rowIndex === -1) return;

        const { x, y, colWidth, rowHeight, firstColWidth } = this.svg.querySelector('.crt-table').dataset;

        const highlightX = parseFloat(x) + parseFloat(firstColWidth) + (colIndex - 1) * parseFloat(colWidth);
        const highlightY = parseFloat(y) + (rowIndex + 1) * parseFloat(rowHeight);

        const highlightRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        highlightRect.setAttribute('x', highlightX);
        highlightRect.setAttribute('y', highlightY);
        highlightRect.setAttribute('width', colWidth);
        highlightRect.setAttribute('height', rowHeight);
        highlightRect.setAttribute('fill', 'yellow');
        highlightRect.setAttribute('opacity', '0.4');
        highlightRect.style.pointerEvents = 'none'; // Make sure it doesn't block clicks
        
        highlightsGroup.appendChild(highlightRect);
    }

    drawCrt(x, y) {
        const svgNS = 'http://www.w3.org/2000/svg';
        const crtGroup = document.createElementNS(svgNS, 'g');
        crtGroup.style.userSelect = 'none';
        crtGroup.setAttribute('class', 'crt-table');

        // --- Style and Layout Constants ---
        const colWidth = 40;
        const rowHeight = 25;
        const firstColWidth = 55;
        const header = ['Ratio', '1', '2', '3', '4', '5', '6'];
        const tableWidth = firstColWidth + (header.length - 1) * colWidth;
        const tableHeight = (CombatResultsTable.length + 1) * rowHeight;
        const FONT_SIZE = '14px';
        const HEADER_FILL = '#ebf2fa';
        const BORDER_COLOR = 'black';
        const ROW_FILL_ODD = '#f0f0f0';
        const ROW_FILL_EVEN = '#ffffff';
        const PADDING = 5;
        const BORDER_RADIUS = 6;

        // Store layout in dataset for highlighter
        crtGroup.dataset.x = x;
        crtGroup.dataset.y = y;
        crtGroup.dataset.colWidth = colWidth;
        crtGroup.dataset.rowHeight = rowHeight;
        crtGroup.dataset.firstColWidth = firstColWidth;

        // --- Create layer groups for ordering ---
        const backgroundsGroup = document.createElementNS(svgNS, 'g');
        const highlightsGroup = document.createElementNS(svgNS, 'g');
        highlightsGroup.setAttribute('class', 'crt-highlights');
        const contentGroup = document.createElementNS(svgNS, 'g');
        crtGroup.append(backgroundsGroup, highlightsGroup, contentGroup);

        // --- Elements ---

        // Title
        const title = document.createElementNS(svgNS, 'text');
        title.setAttribute('x', x);
        title.setAttribute('y', y - PADDING * 2);
        title.setAttribute('font-size', '16px');
        title.setAttribute('font-weight', 'bold');
        title.textContent = "Combat Results Table";
        contentGroup.appendChild(title);

        // Header Background (Path for rounded top corners)
        const headerBgPath = document.createElementNS(svgNS, 'path');
        const pathData = `
            M ${x},${y + rowHeight}
            L ${x},${y + BORDER_RADIUS}
            A ${BORDER_RADIUS},${BORDER_RADIUS} 0 0 1 ${x + BORDER_RADIUS},${y}
            L ${x + tableWidth - BORDER_RADIUS},${y}
            A ${BORDER_RADIUS},${BORDER_RADIUS} 0 0 1 ${x + tableWidth},${y + BORDER_RADIUS}
            L ${x + tableWidth},${y + rowHeight}
            Z
        `;
        headerBgPath.setAttribute('d', pathData);
        headerBgPath.setAttribute('fill', HEADER_FILL);
        backgroundsGroup.appendChild(headerBgPath);

        // Row Backgrounds
        CombatResultsTable.forEach((row, rowIndex) => {
            const yPos = y + (rowIndex + 1) * rowHeight;
            const rowBg = document.createElementNS(svgNS, 'rect');
            rowBg.setAttribute('x', x);
            rowBg.setAttribute('y', yPos);
            rowBg.setAttribute('width', tableWidth);
            rowBg.setAttribute('height', rowHeight);
            rowBg.setAttribute('fill', rowIndex % 2 === 0 ? ROW_FILL_ODD : ROW_FILL_EVEN);
            backgroundsGroup.appendChild(rowBg);
        });

        // Header Text
        header.forEach((text, i) => {
            const currentCellWidth = i === 0 ? firstColWidth : colWidth;
            const cellX = x + (i === 0 ? 0 : firstColWidth + (i - 1) * colWidth);
            const headerCell = document.createElementNS(svgNS, 'text');
            headerCell.setAttribute('x', cellX + currentCellWidth / 2);
            headerCell.setAttribute('y', y + rowHeight / 2);
            headerCell.setAttribute('font-size', FONT_SIZE);
            headerCell.setAttribute('font-weight', 'bold');
            headerCell.setAttribute('dominant-baseline', 'middle');
            headerCell.setAttribute('text-anchor', 'middle');
            headerCell.textContent = text;
            contentGroup.appendChild(headerCell);
        });

        // Row and Cell Text
        CombatResultsTable.forEach((row, rowIndex) => {
            const yPos = y + (rowIndex + 1) * rowHeight;
            // Ratio cell text
            const ratioCell = document.createElementNS(svgNS, 'text');
            ratioCell.setAttribute('x', x + firstColWidth / 2);
            ratioCell.setAttribute('y', yPos + rowHeight / 2);
            ratioCell.setAttribute('font-size', FONT_SIZE);
            ratioCell.setAttribute('dominant-baseline', 'middle');
            ratioCell.setAttribute('text-anchor', 'middle');
            ratioCell.textContent = row.ratioText;
            contentGroup.appendChild(ratioCell);

            // Result cells text
            for (let i = 1; i <= 6; i++) {
                const cellX = x + firstColWidth + (i - 1) * colWidth;
                const resultCell = document.createElementNS(svgNS, 'text');
                resultCell.setAttribute('x', cellX + colWidth / 2);
                resultCell.setAttribute('y', yPos + rowHeight / 2);
                resultCell.setAttribute('font-size', FONT_SIZE);
                resultCell.setAttribute('dominant-baseline', 'middle');
                resultCell.setAttribute('text-anchor', 'middle');
                resultCell.textContent = row[i.toString()];
                contentGroup.appendChild(resultCell);
            }
        });

        // Main border (drawn on top of backgrounds)
        const borderRect = document.createElementNS(svgNS, 'rect');
        borderRect.setAttribute('x', x);
        borderRect.setAttribute('y', y);
        borderRect.setAttribute('width', tableWidth);
        borderRect.setAttribute('height', tableHeight);
        borderRect.setAttribute('fill', 'none');
        borderRect.setAttribute('stroke', BORDER_COLOR);
        borderRect.setAttribute('stroke-width', '2'); // Match unit selection
        borderRect.setAttribute('rx', BORDER_RADIUS);
        contentGroup.appendChild(borderRect);

        // Internal grid lines (drawn on top of backgrounds)
        for (let i = 1; i < header.length; i++) {
            const lineX = x + (i === 1 ? firstColWidth : firstColWidth + (i - 1) * colWidth);
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', lineX);
            line.setAttribute('y1', y);
            line.setAttribute('x2', lineX);
            line.setAttribute('y2', y + tableHeight);
            line.setAttribute('stroke', BORDER_COLOR);
            line.setAttribute('stroke-width', '1');
            contentGroup.appendChild(line);
        }
        const headerLine = document.createElementNS(svgNS, 'line');
        headerLine.setAttribute('x1', x);
        headerLine.setAttribute('y1', y + rowHeight);
        headerLine.setAttribute('x2', x + tableWidth);
        headerLine.setAttribute('y2', y + rowHeight);
        headerLine.setAttribute('stroke', BORDER_COLOR);
        headerLine.setAttribute('stroke-width', '1');
        contentGroup.appendChild(headerLine);

        return crtGroup;
    }

    createButtonSVG(width, height, text) {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        
        svg.setAttribute("width", width + 4);
        svg.setAttribute("height", height + 4);

        const rect = document.createElementNS(svgNS, "rect");
        rect.setAttribute("x", 2);
        rect.setAttribute("y", 2);
        rect.setAttribute("width", width);
        rect.setAttribute("height", height);
        rect.setAttribute("fill", "#ebf2fa");
        rect.setAttribute("rx", 5);
        rect.setAttribute('stroke', 'black');
        rect.setAttribute('stroke-width', 2);

        const buttonText = document.createElementNS(svgNS, "text");
        buttonText.setAttribute("x", width / 2 + 2);
        buttonText.setAttribute("y", height / 2 + 2);
        buttonText.setAttribute("class", "buttonText");
        buttonText.setAttribute("dominant-baseline", "middle");
        buttonText.setAttribute("text-anchor", "middle");
        buttonText.setAttribute("font-family", "Arial");
        buttonText.setAttribute("font-size", "16px");
        buttonText.style.userSelect = 'none';
        buttonText.textContent = text;

        svg.appendChild(rect);
        svg.appendChild(buttonText);
        svg.setAttribute("x", 10);
        svg.setAttribute("y", 10);

        return svg;
    }
}