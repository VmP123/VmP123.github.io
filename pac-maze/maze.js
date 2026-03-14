/**
 * Labyrintin generointi Recursive Backtracking -algoritmilla.
 * Generoi 10x10 ruudukon, jossa jokainen ruutu on saavutettavissa.
 */
class Maze {
    constructor(cols = 10, rows = 10, onlyOnePath = true, shortcutChance = 0.1) {
        this.cols = cols;
        this.rows = rows;
        this.onlyOnePath = onlyOnePath;
        this.shortcutChance = shortcutChance;
        this.grid = [];
        this.init();
    }


    init() {
        // Alustetaan kaikki ruudut seinillä (top, right, bottom, left)
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = {
                    r, c,
                    visited: false,
                    walls: { top: true, right: true, bottom: true, left: true }
                };
            }
        }
    }

    generate() {
        const stack = [];
        const goalR = this.rows - 1;
        const goalC = this.cols - 1;

        // Estetään algoritmiä menemästä maaliruutuun aluksi
        this.grid[goalR][goalC].visited = true;

        let current = this.grid[0][0];
        current.visited = true;
        let visitedCount = 1;
        const totalCells = this.rows * this.cols;

        // Generoidaan labyrintti 99 ruudulle
        while (visitedCount < totalCells - 1) {
            const next = this.getUnvisitedNeighbor(current);

            if (next) {
                next.visited = true;
                visitedCount++;
                stack.push(current);
                this.removeWalls(current, next);
                current = next;
            } else if (stack.length > 0) {
                current = stack.pop();
            }
        }

        // Lopuksi yhdistetään maaliruutu (9,9) johonkin naapuriinsa
        // Tämä tekee maalista umpikujan (leaf node)
        this.grid[goalR][goalC].visited = false; // "vapautetaan" maali
        const neighbors = [];
        if (goalR > 0) neighbors.push(this.grid[goalR - 1][goalC]);
        if (goalC > 0) neighbors.push(this.grid[goalR][goalC - 1]);
        
        const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.removeWalls(this.grid[goalR][goalC], randomNeighbor);
        this.grid[goalR][goalC].visited = true;
        
        // Poistetaan aloitusruudun (vasen ylä) vasen seinä
        this.grid[0][0].walls.left = false;
        // Poistetaan maaliruudun (oikea ala) oikea seinä
        this.grid[goalR][goalC].walls.right = false;

        // Lisätään oikoteitä, jos halutaan useita reittejä
        if (!this.onlyOnePath) {
            this.addShortcuts();
        }

        return this.grid;
    }

    addShortcuts() {
        // Käydään läpi kaikki sisäseinät ja poistetaan niistä osa satunnaisesti
        // n. 10% mahdollisuus poistaa seinä, joka ei ole reunalla.
        // EI poisteta seinää, jos viereinen seinä samassa linjassa puuttuu jo.
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // Kokeillaan poistaa oikea seinä (pystysuora seinä)
                if (c < this.cols - 1 && this.grid[r][c].walls.right) {
                    const wallAboveMissing = r > 0 && !this.grid[r - 1][c].walls.right;
                    const wallBelowMissing = r < this.rows - 1 && !this.grid[r + 1][c].walls.right;
                    
                    if (!wallAboveMissing && !wallBelowMissing && Math.random() < this.shortcutChance) {
                        this.removeWalls(this.grid[r][c], this.grid[r][c + 1]);
                    }
                }
                // Kokeillaan poistaa alaseinä (vaakasuora seinä)
                if (r < this.rows - 1 && this.grid[r][c].walls.bottom) {
                    const wallLeftMissing = c > 0 && !this.grid[r][c - 1].walls.bottom;
                    const wallRightMissing = c < this.cols - 1 && !this.grid[r][c + 1].walls.bottom;

                    if (!wallLeftMissing && !wallRightMissing && Math.random() < this.shortcutChance) {
                        this.removeWalls(this.grid[r][c], this.grid[r + 1][c]);
                    }
                }
            }
        }
    }



    getUnvisitedNeighbor(cell) {
        const neighbors = [];
        const { r, c } = cell;

        if (r > 0 && !this.grid[r - 1][c].visited) neighbors.push(this.grid[r - 1][c]);
        if (r < this.rows - 1 && !this.grid[r + 1][c].visited) neighbors.push(this.grid[r + 1][c]);
        if (c > 0 && !this.grid[r][c - 1].visited) neighbors.push(this.grid[r][c - 1]);
        if (c < this.cols - 1 && !this.grid[r][c + 1].visited) neighbors.push(this.grid[r][c + 1]);

        if (neighbors.length > 0) {
            const randomIndex = Math.floor(Math.random() * neighbors.length);
            return neighbors[randomIndex];
        }
        return undefined;
    }

    removeWalls(a, b) {
        const dr = a.r - b.r;
        const dc = a.c - b.c;

        if (dr === 1) { // a on b:n alapuolella
            a.walls.top = false;
            b.walls.bottom = false;
        } else if (dr === -1) { // a on b:n yläpuolella
            a.walls.bottom = false;
            b.walls.top = false;
        }

        if (dc === 1) { // a on b:n oikealla puolella
            a.walls.left = false;
            b.walls.right = false;
        } else if (dc === -1) { // a on b:n vasemmalla puolella
            a.walls.right = false;
            b.walls.left = false;
        }
    }
}
