// All possible shapes in the game
const SHAPES = [
    // 1x1
    [[1]],
    // 1x2, 2x1
    [[1, 1]],
    [[1], [1]],
    // 1x3, 3x1
    [[1, 1, 1]],
    [[1], [1], [1]],
    // 1x4, 4x1
    [[1, 1, 1, 1]],
    [[1], [1], [1], [1]],
    // 1x5, 5x1
    [[1, 1, 1, 1, 1]],
    [[1], [1], [1], [1], [1]],
    // 2x2
    [[1, 1], [1, 1]],
    // 3x3
    [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    // L-shapes 2x2
    [[1, 0], [1, 1]],
    [[0, 1], [1, 1]],
    [[1, 1], [1, 0]],
    [[1, 1], [0, 1]],
    // L-shapes 3x3
    [[1, 0, 0], [1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [0, 0, 1], [1, 1, 1]],
    [[1, 1, 1], [1, 0, 0], [1, 0, 0]],
    [[1, 1, 1], [0, 0, 1], [0, 0, 1]]
];

class GameLogic {
    constructor() {
        this.grid = Array(8).fill(null).map(() => Array(8).fill(0));
        this.score = 0;
        this.combo = 0;
        this.currentShapes = [];
        this.secondChanceUsed = false;
        this.generateShapes();
    }

    generateShapes() {
        this.currentShapes = [];
        const useSmartBlock = Math.random() < 0.3;
        let smartShapePlaced = false;

        // Find all playable shapes on current grid
        const playableShapes = [];
        for (let i = 0; i < SHAPES.length; i++) {
            if (this.canPlaceAnywhere(SHAPES[i])) {
                playableShapes.push(SHAPES[i]);
            }
        }

        for (let i = 0; i < 3; i++) {
            let selectedShape = null;

            if (useSmartBlock && !smartShapePlaced && playableShapes.length > 0) {
                // Pick a random playable shape (could be improved to find line-completing shapes)
                selectedShape = playableShapes[Math.floor(Math.random() * playableShapes.length)];
                smartShapePlaced = true;
            } else {
                // Random block (70% chance or if smart already used)
                const randomIndex = Math.floor(Math.random() * SHAPES.length);
                selectedShape = SHAPES[randomIndex];
            }

            this.currentShapes.push({
                id: Math.random().toString(36).substring(7),
                shape: selectedShape
            });
        }

        // Safety Net: If NONE of the 3 generated blocks are playable, but there ARE playable blocks available
        // replace one with a playable block to avoid unfair game over right after generation.
        if (!this.checkIfAnyPlayableInTray() && playableShapes.length > 0) {
            const indexToReplace = Math.floor(Math.random() * 3);
            this.currentShapes[indexToReplace].shape = playableShapes[Math.floor(Math.random() * playableShapes.length)];
        }
    }

    canPlaceAnywhere(shapeMatrix) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.canPlace(c, r, shapeMatrix)) {
                    return true;
                }
            }
        }
        return false;
    }

    checkIfAnyPlayableInTray() {
        for (const shapeObj of this.currentShapes) {
            if (shapeObj && this.canPlaceAnywhere(shapeObj.shape)) {
                return true;
            }
        }
        return false;
    }

    checkGameOver() {
        if (!this.checkIfAnyPlayableInTray()) {
            if (!this.secondChanceUsed) {
                // Second chance: regenerate shapes
                this.secondChanceUsed = true;
                console.log("Player out of moves. Triggering second chance.");
                this.generateShapes();
                
                // Check again with new shapes
                if (!this.checkIfAnyPlayableInTray()) {
                    return true; // Still can't move, true game over
                } else {
                    return false; // Saved by second chance
                }
            } else {
                return true; // No second chance left, game over
            }
        }
        return false;
    }

    canPlace(x, y, shapeMatrix) {
        if (!shapeMatrix) return false;
        const rows = shapeMatrix.length;
        const cols = shapeMatrix[0].length;

        // Check bounds
        if (y + rows > 8 || x + cols > 8 || y < 0 || x < 0) return false;

        // Check overlaps
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (shapeMatrix[r][c] === 1 && this.grid[y + r][x + c] === 1) {
                    return false;
                }
            }
        }

        return true;
    }

    placeBlock(x, y, shapeIndex) {
        const shapeObj = this.currentShapes[shapeIndex];
        if (!shapeObj) return false;

        const shapeMatrix = shapeObj.shape;

        if (!this.canPlace(x, y, shapeMatrix)) return false;

        let blocksPlaced = 0;
        for (let r = 0; r < shapeMatrix.length; r++) {
            for (let c = 0; c < shapeMatrix[0].length; c++) {
                if (shapeMatrix[r][c] === 1) {
                    this.grid[y + r][x + c] = 1;
                    blocksPlaced++;
                }
            }
        }
        
        this.score += blocksPlaced;
        this.currentShapes[shapeIndex] = null;

        if (this.currentShapes.every(s => s === null)) {
            this.generateShapes();
        }

        const effect = this.checkLines();
        const finalEffect = effect || { clearedRows: [], clearedCols: [], scoreAdded: 0, combo: 0 };
        
        // After placing block and potentially generating new ones, check for game over
        finalEffect.gameOver = this.checkGameOver();

        return finalEffect;
    }

    checkLines() {
        let linesToClear = { rows: [], cols: [] };

        for (let r = 0; r < 8; r++) {
            if (this.grid[r].every(cell => cell === 1)) {
                linesToClear.rows.push(r);
            }
        }

        for (let c = 0; c < 8; c++) {
            let full = true;
            for (let r = 0; r < 8; r++) {
                if (this.grid[r][c] === 0) {
                    full = false;
                    break;
                }
            }
            if (full) linesToClear.cols.push(c);
        }

        const totalLines = linesToClear.rows.length + linesToClear.cols.length;
        let scoreAdded = 0;

        if (totalLines > 0) {
            this.combo++;
            
            linesToClear.rows.forEach(r => {
                this.grid[r] = Array(8).fill(0);
            });

            linesToClear.cols.forEach(c => {
                for (let r = 0; r < 8; r++) {
                    this.grid[r][c] = 0;
                }
            });

            if (totalLines === 1) scoreAdded = 75;
            else if (totalLines === 2) scoreAdded = 150;
            else if (totalLines >= 3) scoreAdded = 250;

            if (this.combo === 2) scoreAdded += 50;
            else if (this.combo >= 3) scoreAdded += 100;

            this.score += scoreAdded;

            return {
                clearedRows: linesToClear.rows,
                clearedCols: linesToClear.cols,
                scoreAdded: scoreAdded,
                combo: this.combo
            };
        } else {
            this.combo = 0;
            return null;
        }
    }

    getState() {
        return {
            grid: this.grid,
            score: this.score,
            combo: this.combo,
            shapes: this.currentShapes
        };
    }
}

module.exports = GameLogic;
