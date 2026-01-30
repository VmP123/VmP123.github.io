// Game configuration
export const CONFIG = {
    // Canvas settings
    CANVAS_WIDTH: 1000,
    CANVAS_HEIGHT: 700,

    // Game settings
    LAPS_TO_WIN: 3,
    NUM_PLAYERS: 2,

    // Disk physics
    DISK_RADIUS: 15,
    DISK_MAX_SPEED: 20,
    FRICTION_COEFFICIENT: 0.985, // Pienempi kitka suurissa nopeuksissa (liukuu paremmin)
    MIN_SPEED_THRESHOLD: 0.15, // Pysähtyy silti napakasti

    // Launch controls
    ARROW_ROTATION_SPEED: 0.10, // radians per frame
    POWER_CHARGE_SPEED: 0.02, // 0-1 per frame

    // Track settings
    TRACK_WIDTH: 80,
    WALL_THICKNESS: 8,
    START_LINE_SETBACK: 40,

    // Collision settings
    WALL_BOUNCE_DAMPING: 0.7,

    // Visual settings
    COLORS: {
        TRACK: '#34d399',
        TRACK_BORDER: '#065f46',
        WALL: '#ef4444',
        WALL_BORDER: '#991b1b',
        DISK: '#3b82f6',
        DISK_BORDER: '#1e40af',
        ARROW: '#fbbf24',
        ARROW_BORDER: '#92400e',
        START_LINE: '#ffffff',
        START_LINE_BORDER: '#000000',
        PLAYER_COLORS: [
            { disk: '#3b82f6', border: '#1e40af' },  // Blue - Player 1
            { disk: '#ef4444', border: '#991b1b' },  // Red - Player 2
            { disk: '#10b981', border: '#065f46' },  // Green - Player 3
            { disk: '#f59e0b', border: '#b45309' }   // Orange - Player 4
        ]
    },
    BORDER_WIDTH: 4,
    CORNER_RADIUS: 0,

    // Track file
    TRACK_FILE: 'tracks/default.json'
};
