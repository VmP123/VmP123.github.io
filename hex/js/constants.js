const TerrainType = {
	CLEAR: 'clear',
	MOUNTAIN: 'mountain',
	WATER: 'water',
	FOREST: 'forest',
	FLAG: 'flag',
  SWAMP: 'swamp',
  CITY: 'city'
};

const PlayerType = {
	GREY: "grey",
	GREEN: "green"
}

const ColorByPlayer = {
	[PlayerType.GREY]: "#d8d8d8",
	[PlayerType.GREEN]: "#b5c599"
}

const HealthStatus = {
	FULL: "full",
	REDUCED: "reduced",
	DEAD: "dead"
}

const GameStatus = {
	GAMEON: 'gameon',
	ENDED: 'ended',
	EDITOR: 'editor',
};

const UnitType = {
	INFANTRY: 'infantry',
	TANK: 'tank',
	// ARTILLERY: 'artillery', // Not yet
};

const TurnPhase = {
	MOVE: "move",
	ATTACK: "attack"
};

const SpecialPhaseType = {
	ATTACKER_RETREAT: "attackerRetreat",
	DEFENDER_RETREAT: "defenderRetreat",
	ADVANCE: "advance",
	ATTACKER_DAMAGE: "attackerDamage",
}

const UnitProperties = {
	[UnitType.INFANTRY]: {
		movementAllowance: 2,
		attackRange: 1,
		attackStrength: 3,
		defendStrength: 3,
		reducedAttackStrength: 2,
		reducedDefendStrength: 2
		
	},
	[UnitType.TANK]: {
		movementAllowance: 3,
		attackRange: 1,
		attackStrength: 5,
		defendStrength: 4,
		reducedAttackStrength: 3,
		reducedDefendStrength: 2
	},
	[UnitType.ARTILLERY]: {
		movementAllowance: 1,
		attackRange: 2,
		attackStrength: 4,
		defendStrength: 3,
		reducedAttackStrength: 2,
		reducedDefendStrength: 1
	}
};

const CombatResultsTable = [
	{
		'ratio': 1/3,
		'ratioText': '1:3',
		'1': 'A2',
		'2': 'A2',
		'3': 'A1',
		'4': 'A1',
		'5': 'A1',
		'6': 'EX',
	},
	{
		'ratio': 1/2,
		'ratioText': '1:2',
		'1': 'A2',
		'2': 'A1',
		'3': 'A1',
		'4': 'A1',
		'5': 'EX',
		'6': 'D1',
	},
	{
		'ratio': 1/1,
		'ratioText': '1:1',
		'1': 'A1',
		'2': 'A1',
		'3': 'NE',
		'4': 'NE',
		'5': 'EX',
		'6': 'D1',
	},
	{
		'ratio': 2/1,
		'ratioText': '2:1',
		'1': 'A1',
		'2': 'NE',
		'3': 'EX',
		'4': 'D1',
		'5': 'D1',
		'6': 'D1',
	},
	{
		'ratio': 3/1,
		'ratioText': '3:1',
		'1': 'A1',
		'2': 'EX',
		'3': 'D1',
		'4': 'D1',
		'5': 'D1',
		'6': 'D2',
	},
	{
		'ratio': 4/1,
		'ratioText': '4:1',
		'1': 'EX',
		'2': 'EX',
		'3': 'D1',
		'4': 'D1',
		'5': 'D1',
		'6': 'D2',
	},
	{
		'ratio': 5/1,
		'ratioText': '5:1',
		'1': 'D1',
		'2': 'D1',
		'3': 'D1',
		'4': 'D2',
		'5': 'D2',
		'6': 'D2'
	}
];

const CombatResultTableValueEffect = {
	'A1': {
		attacker: -1,
		defender: 0
	},
	'A2': {
		attacker: -2,
		defender: 0
	},
	'D1': {
		attacker: 0,
		defender: -1
	},
	'D2': {
		attacker: 0,
		defender: -2
	},
	'EX': {
		attacker: -1,
		defender: -1
	},
	'NE': {
		attacker: 0,
		defender: 0
	}
}

const MaxMovementPointCost = 9999;

const TerrainProperties = {
	[TerrainType.CLEAR]: {
		movementPointCost: 1,
		defenderCrtShift: 0,
		attackModifier: 1
	},
	[TerrainType.FOREST]: {
		movementPointCost: 2,
		defenderCrtShift: -1,
		attackModifier: 1
	},
	[TerrainType.FLAG]: {
		movementPointCost: 1,
		defenderCrtShift: 0,
		attackModifier: 1
	},
	[TerrainType.MOUNTAIN]: {
		movementPointCost: MaxMovementPointCost,
		defenderCrtShift: 0,
		attackModifier: 1
	},
	[TerrainType.SWAMP]: {
		movementPointCost: 2,
		defenderCrtShift: 0,
		attackModifier: 2/3
	},
	[TerrainType.CITY]: {
		movementPointCost: 2,
		defenderCrtShift: -1,
		attackModifier: 1
	},
	[TerrainType.WATER]: {
		movementPointCost: MaxMovementPointCost,
		defenderCrtShift: 0,
		attackModifier: 1
	}
}

export { 
	TerrainType, 
	PlayerType, 
	ColorByPlayer, 
	HealthStatus, 
	GameStatus, 
	UnitType,
	TurnPhase,
	SpecialPhaseType,
	UnitProperties,
	CombatResultsTable,
	CombatResultTableValueEffect,
	MaxMovementPointCost,
	TerrainProperties 
}
