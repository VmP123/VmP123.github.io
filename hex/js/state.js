import { GameStatus, PlayerType, TurnPhase } from './constants.js';

const listeners = {};

export function on(eventName, callback) {
  if (!listeners[eventName]) {
    listeners[eventName] = [];
  }
  listeners[eventName].push(callback);
}

export function trigger(eventName, data) {
  if (listeners[eventName]) {
    listeners[eventName].forEach(callback => callback(data));
  }
}

export class GameState {
    constructor() {
        this.status = GameStatus.EDITOR;
        this.winner = null;
        this.activePlayer = PlayerType.GREY;
        this.currentTurnPhase = TurnPhase.MOVE;
        this.unassignedDamagePoints = 0;
        this.vacatedHex = null;
        this.specialPhaseQueue = [];
        this.crtColumn = null;
        this.d6Value = null;
        this.isAnimating = false;
        this.selectedUnits = [];
        this.attackers = [];
    }

    setCombatResult(crtColumn, d6Value) {
        this.crtColumn = crtColumn;
        this.d6Value = d6Value;
        trigger('combatResultUpdated', this);
    }

    setWinner(winner) {
        this.winner = winner;
        trigger('winnerUpdated', this);
    }

    getCurrentSpecialPhase() {
        return this.specialPhaseQueue.length > 0 ? this.specialPhaseQueue[0] : null;
    }

    pushSpecialPhaseQueue(specialPhase) {
        this.specialPhaseQueue.push(specialPhase);

        if (this.specialPhaseQueue.length > 0) {
            trigger('currentSpecialPhaseUpdated', this);
        }
    }

    shiftSpecialPhaseQueue() {
        this.specialPhaseQueue.shift();
        trigger('currentSpecialPhaseUpdated', this);
    }

    selectUnit(unit, isMultiSelect) {
        if (isMultiSelect) {
            const index = this.selectedUnits.indexOf(unit);
            if (index > -1) {
                this.selectedUnits.splice(index, 1); // Deselect if already selected
            } else {
                this.selectedUnits.push(unit); // Select if not already selected
            }
        } else {
            if (unit === null) {
                this.selectedUnits = [];
            } else {
                // In single-select mode, deselect if clicking the same unit, otherwise select the new one.
                this.selectedUnits = (this.selectedUnits.length === 1 && this.selectedUnits[0] === unit) ? [] : [unit];
            }
        }
        trigger('selectionChanged', { selectedUnits: this.selectedUnits });
    }
}