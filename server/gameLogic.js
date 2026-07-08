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

const RESCUE_SHAPES = [
    [[1]],
    [[1, 1]],
    [[1], [1]],
    [[1, 0], [1, 1]],
    [[0, 1], [1, 1]],
    [[1, 1], [1, 0]],
    [[1, 1], [0, 1]]
];

class GameLogic {
    constructor() {
        this.grid = Array(8).fill(null).map(() => Array(8).fill(0));
        this.score = 0;
        this.combo = 0;
        this.currentShapes = [];
        this.secondChanceUsed = false;
        this.movesWithoutClearing = 0;
        this.generateShapes();
    }

    generateShapes() {
        const generatedShapes = [];
        for (let i = 0; i < 3; i++) {
            generatedShapes.push(this.getRandomShape());
        }

        const shouldUseRescue = this.movesWithoutClearing >= 5;
        const hasPlayableShape = this.hasAnyPlayableShape(generatedShapes);

        if (!hasPlayableShape) {
            const rescueShape = this.selectRescueShape({ preferLineClear: shouldUseRescue });
            if (rescueShape) {
                const indexToReplace = this.findReplacementIndex(generatedShapes);
                if (indexToReplace !== -1) {
                    generatedShapes[indexToReplace] = rescueShape;
                }
            }
        } else if (shouldUseRescue) {
            const rescueShape = this.selectRescueShape({ preferLineClear: true });
            if (rescueShape) {
                const indexToReplace = this.findReplacementIndex(generatedShapes, { preferUnplayableOnly: true });
                if (indexToReplace !== -1) {
                    generatedShapes[indexToReplace] = rescueShape;
                }
            }
        }

        this.currentShapes = generatedShapes.map(shape => ({
            id: Math.random().toString(36).substring(7),
            shape
        }));
    }

    getRandomShape() {
        const randomIndex = Math.floor(Math.random() * SHAPES.length);
        return SHAPES[randomIndex];
    }

    hasAnyPlayableShape(shapePool) {
        return shapePool.some(shape => this.canPlaceAnywhere(shape));
    }

    findReplacementIndex(shapePool, options = {}) {
        const { preferUnplayableOnly = false } = options;
        const indices = shapePool
            .map((shape, index) => ({ shape, index }))
            .filter(({ shape, index }) => {
                const isPlayable = this.canPlaceAnywhere(shape);
                return preferUnplayableOnly ? !isPlayable : true;
            })
            .map(({ index }) => index);

        if (indices.length === 0) {
            return -1;
        }

        return indices[Math.floor(Math.random() * indices.length)];
    }

    selectRescueShape({ preferLineClear = false } = {}) {
        const candidates = [...RESCUE_SHAPES];
        const playableCandidates = candidates.filter(shape => this.canPlaceAnywhere(shape));

        if (playableCandidates.length === 0) {
            return null;
        }

        if (preferLineClear) {
            const lineClearCandidates = playableCandidates.filter(shape => this.canCreateLineOrColumn(shape));
            if (lineClearCandidates.length > 0) {
                return lineClearCandidates[Math.floor(Math.random() * lineClearCandidates.length)];
            }
        }

        return playableCandidates[Math.floor(Math.random() * playableCandidates.length)];
    }

    canCreateLineOrColumn(shapeMatrix) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (!this.canPlace(c, r, shapeMatrix)) {
                    continue;
                }

                const simulatedGrid = this.grid.map(row => [...row]);
                for (let shapeRow = 0; shapeRow < shapeMatrix.length; shapeRow++) {
                    for (let shapeCol = 0; shapeCol < shapeMatrix[0].length; shapeCol++) {
                        if (shapeMatrix[shapeRow][shapeCol] === 1) {
                            simulatedGrid[r + shapeRow][c + shapeCol] = 1;
                        }
                    }
                }

                const createsLine = simulatedGrid.some(row => row.every(cell => cell === 1)) ||
                    Array.from({ length: 8 }, (_, idx) => idx).some(colIndex => {
                        return simulatedGrid.every(row => row[colIndex] === 1);
                    });

                if (createsLine) {
                    return true;
                }
            }
        }

        return false;
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
            this.movesWithoutClearing = 0;

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
            this.movesWithoutClearing++;
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
