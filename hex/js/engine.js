import { GameStatus, TurnPhase, PlayerType, SpecialPhaseType, HealthStatus, CombatResultsTable, CombatResultTableValueEffect, UnitProperties, TerrainProperties } from './constants.js';
import { trigger, on } from './state.js';
import { getAdjacentHexes } from './utils.js';

export class GameEngine {
    constructor(gameState, hexGrid) {
        this.gameState = gameState;
        this.hexGrid = hexGrid;

        on('unitClicked', (data) => this.handleUnitClick(data.unit));
        on('endPhaseRequested', () => this.endCurrentPhase());
    }

    handleUnitClick(unit) {
        if (this.gameState.status !== GameStatus.GAMEON || this.gameState.isAnimating) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();
        
        if (currentSpecialPhase === SpecialPhaseType.ATTACKER_DAMAGE && this.gameState.attackers.includes(unit)) {
            this.handleAttackerDamageSelection(unit);
        }

        else if (currentSpecialPhase === SpecialPhaseType.ADVANCE && this.gameState.attackers.includes(unit) && 
            (this.gameState.selectedUnits.length === 0 || this.gameState.selectedUnits[0] === unit)) {
                this.handleAdvanceSelection(unit);
        }

        else if (this.gameState.currentTurnPhase === TurnPhase.ATTACK && currentSpecialPhase === null) {
            this.handleAttackPhaseSelection(unit);
        }

        else if (this.gameState.currentTurnPhase === TurnPhase.MOVE && currentSpecialPhase === null &&
            (this.gameState.selectedUnits.length === 0 || this.gameState.selectedUnits[0] === unit) && 
            unit.player == this.gameState.activePlayer && !unit.moved) {
                this.handleMovePhaseSelection(unit);
        }
    }

    handleAttackerDamageSelection(unit) {
        this.applyDamage(unit);
        this.gameState.unassignedDamagePoints--;
        trigger('unitUpdated', { unit: unit });

        const deadUnits = this.hexGrid.removeDeadUnits();
        deadUnits.forEach(deadUnit => trigger('unitRemoved', { unit: deadUnit }));

        if (this.gameState.unassignedDamagePoints === 0) {
            this.endSpecialPhase();
        }
    }

    handleAdvanceSelection(unit) {
        this.gameState.selectUnit(unit, false);
    }

    handleAttackPhaseSelection(unit) {
        if (unit.player === this.gameState.activePlayer && !unit.attacked) {
            this.gameState.selectUnit(unit, true);
        } else {
            const attackers = this.gameState.selectedUnits;
            if (attackers && attackers.length > 0) {
                // Check if the target is adjacent to any of the attackers
                const isAdjacent = attackers.some(attacker => {
                    const adjacentHexes = getAdjacentHexes(attacker.x, attacker.y, this.hexGrid.rows, this.hexGrid.cols);
                    return adjacentHexes.some(h => h.x === unit.x && h.y === unit.y);
                });
                if (isAdjacent) {
                    this.attack(attackers, unit);
                }
            }
        }
    }

    handleMovePhaseSelection(unit) {
        this.gameState.selectUnit(unit, false);
    }

    applyDamage(unit) {
        if (unit.healthStatus === HealthStatus.FULL) {
            unit.healthStatus = HealthStatus.REDUCED;
        }
        else if (unit.healthStatus === HealthStatus.REDUCED) {
            unit.healthStatus = HealthStatus.DEAD;
        }
    }

    moveUnit(unit, gridX, gridY) {
        const startHex = this.hexGrid.getHex(unit.x, unit.y);
        const endHex = this.hexGrid.getHex(gridX, gridY);
        const path = this.hexGrid.findPath(startHex, endHex, unit);
  
        if (path) {
            unit.moved = true;
            trigger('unitMoving', { unit: unit, path: path });
        }
    }

    attack(attackers, defender) {
        attackers.forEach(a => {
            a.attacked = true;
        });

        const defenderHex = this.hexGrid.getHex(defender.x, defender.y);

        const attackStrengthSum = attackers.reduce((total, su) => {
            let strength = (su.healthStatus === HealthStatus.FULL 
                ? UnitProperties[su.unitType].attackStrength 
                : UnitProperties[su.unitType].reducedAttackStrength);
            
            const attackerHex = this.hexGrid.getHex(su.x, su.y);
            const attackerTerrain = attackerHex.terrainType;
            const attackModifier = TerrainProperties[attackerTerrain]?.attackModifier || 1;
            strength = Math.floor(strength * attackModifier);

            if (this.hexGrid.isRiverBetween(attackerHex, defenderHex)) {
                strength = Math.floor(strength * (2/3));
            }
            return total + strength;
        }, 0);

        const defendStrength = defender.healthStatus === HealthStatus.FULL 
            ? UnitProperties[defender.unitType].defendStrength
            : UnitProperties[defender.unitType].reducedDefendStrength;

        let crtColumn = [...CombatResultsTable].reverse().find(crtv => crtv.ratio <= (attackStrengthSum/defendStrength)) || CombatResultsTable[0];

        const defenderTerrain = defenderHex.terrainType;
        const crtShift = TerrainProperties[defenderTerrain]?.defenderCrtShift || 0;

        if (crtShift !== 0) {
            const currentIndex = CombatResultsTable.indexOf(crtColumn);
            const newIndex = currentIndex + crtShift;
            const lastIndex = CombatResultsTable.length - 1;
            crtColumn = newIndex < 0 ? CombatResultsTable[0] : (newIndex > lastIndex ? CombatResultsTable[lastIndex] : CombatResultsTable[newIndex]);
        }

        const d6Value = Math.floor(Math.random() * 6) + 1;
        this.gameState.setCombatResult(crtColumn, d6Value);
        
        const crtResult = crtColumn[d6Value];
        const effect = CombatResultTableValueEffect[crtResult];

        if (effect.attacker < 0) {
            const damagePoints = Math.abs(effect.attacker);
            if (attackers.length > 1) {
                this.gameState.attackers = attackers;
                this.gameState.unassignedDamagePoints = damagePoints;
                this.gameState.pushSpecialPhaseQueue(SpecialPhaseType.ATTACKER_DAMAGE);
            } else {
                for (let i = 0; i < damagePoints; i++) {
                    this.applyDamage(attackers[0]);
                }
            }
        }

        if (effect.defender < 0) {
            const damage = Math.abs(effect.defender);
            for (let i = 0; i < damage; i++) {
                this.applyDamage(defender);
            }
        }

        trigger('combatResolved', { 
            attackers,
            defender,
        });

        const deadUnits = [];
        if (defender.isDead()) {
            this.gameState.vacatedHex = this.hexGrid.getHex(defender.x, defender.y);
            this.gameState.attackers = attackers.filter(a => !a.isDead());
            if (this.gameState.attackers.length > 0) {
                this.gameState.pushSpecialPhaseQueue(SpecialPhaseType.ADVANCE);
            }
            deadUnits.push(defender);
        }
        attackers.forEach(attacker => {
            if (attacker.isDead()) {
                deadUnits.push(attacker);
            }
        });

        deadUnits.forEach(deadUnit => {
            this.hexGrid.removeUnit(deadUnit);
            trigger('unitRemoved', { unit: deadUnit });
        });

        this.gameState.selectUnit(null, false);
        this.hexGrid.checkWinningConditions();
        this.startSpecialPhase(this.gameState.getCurrentSpecialPhase());
    }

    handleHexClick(hex) {
        if (this.gameState.status !== GameStatus.GAMEON || this.gameState.isAnimating) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (this.gameState.currentTurnPhase == TurnPhase.MOVE || currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            if (this.gameState.selectedUnits.length > 0 && this.gameState.selectedUnits[0].isValidMove(hex.x, hex.y, this.hexGrid)) {
                const selectedUnit = this.gameState.selectedUnits[0];
                this.moveUnit(selectedUnit, hex.x, hex.y);
                this.gameState.selectUnit(null, false);

                if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
                    this.endSpecialPhase();
                }

                this.hexGrid.checkWinningConditions();
            }
        }
        else if (this.gameState.currentTurnPhase == TurnPhase.ATTACK) {
            const clickedUnit = hex.unit;
            if (clickedUnit && clickedUnit.player !== this.gameState.activePlayer) {
                if (this.gameState.selectedUnits.length > 0) {
                    this.attack(this.gameState.selectedUnits, clickedUnit);
                }
            }
        }
    }

    endCurrentPhase() {
        if (this.gameState.status !== GameStatus.GAMEON) {
            return;
        }

        const currentSpecialPhase = this.gameState.getCurrentSpecialPhase();

        if (currentSpecialPhase === SpecialPhaseType.ADVANCE) {
            this.endSpecialPhase();
        }
        else if (currentSpecialPhase === null) {
            if (this.gameState.currentTurnPhase == TurnPhase.MOVE) {
                this.gameState.currentTurnPhase = TurnPhase.ATTACK;
            }
            else if (this.gameState.currentTurnPhase == TurnPhase.ATTACK) {
                this.gameState.activePlayer = this.gameState.activePlayer == PlayerType.GREY
                    ? PlayerType.GREEN
                    : PlayerType.GREY;

                this.gameState.currentTurnPhase = TurnPhase.MOVE;
                this.gameState.setCombatResult(null, null);
                this.hexGrid.clearUnitMovedAttacked();
            }

            trigger('phaseChanged');

            this.hexGrid.clearSelections();
        }
    }
    
    startSpecialPhase(specialPhase) {
        this.hexGrid.startSpecialPhase(specialPhase);
    }

    endSpecialPhase() {
        this.hexGrid.endSpecialPhase();
    }
}