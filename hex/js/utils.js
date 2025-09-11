import { PlayerType } from './constants.js';

export function getHexWidth(hexRadius) {
    return 2 * hexRadius;
}

export function getHexHeight(hexRadius) {
    return Math.sqrt(3) * hexRadius;
}

export function getAnotherPlayer(player) {
    return player === PlayerType.GREEN ? PlayerType.GREY : PlayerType.GREEN;
}

export function getMargin(lineWidth) {
    return Math.round(lineWidth / 2) + 1;
}

export function getAdjacentHexes(x, y, rows, cols) {
    const isWithinGridBounds = (x, y) => 
        x >= 0 &&
        x < cols &&
        y >= 0 &&
        y < rows &&
        !((y == rows - 1) && (x % 2 == 1));

    const offsetsOddRow = [
        [0, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]
    ];

    const offsetsEvenRow = [
        [0, -1], [1, -1], [1, 0], [0, 1], [-1, 0], [-1, -1]
    ];

    const offsets = x % 2 === 0 ? offsetsEvenRow : offsetsOddRow;
    const result = offsets.filter(([dx, dy]) => {
        return isWithinGridBounds(x + dx, y + dy);
    }).map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
    return result;
}
