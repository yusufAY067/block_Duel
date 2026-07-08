class Renderer {
    constructor() {
        this.mainCanvas = document.getElementById('game-canvas');
        this.mainCtx = this.mainCanvas.getContext('2d');
        
        this.shapesCanvas = document.getElementById('shapes-canvas');
        this.shapesCtx = this.shapesCanvas.getContext('2d');
        
        this.oppCanvas = document.getElementById('opponent-canvas');
        this.oppCtx = this.oppCanvas.getContext('2d');

        this.cellSize = 50; // fallback
        this.oppCellSize = 20; // fallback
        this.shapeCellSize = 25; // fallback

        this.myState = null;
        this.oppState = null;

        // Interaction state
        this.draggedShapeIndex = -1;
        this.dragOffset = { x: 0, y: 0 };
        this.dragPos = { x: 0, y: 0 };

        // Visual effects
        this.effects = [];

        this.setupEventListeners();
        this.resizeCanvases();
        window.addEventListener('resize', this.resizeCanvases.bind(this));
        this.loop();
    }

    setupEventListeners() {
        this.shapesCanvas.addEventListener('mousedown', this.handleShapesMouseDown.bind(this));
        
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        this.shapesCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.shapesCanvas.getBoundingClientRect();
            this.handleShapesMouseDown({
                offsetX: touch.clientX - rect.left,
                offsetY: touch.clientY - rect.top,
                clientX: touch.clientX,
                clientY: touch.clientY
            });
        });
        document.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }, { passive: false });
        document.addEventListener('touchend', (e) => {
            const touch = e.changedTouches?.[0];
            this.handleMouseUp({
                clientX: touch?.clientX,
                clientY: touch?.clientY,
                changedTouches: e.changedTouches
            });
        });
    }

    resizeCanvases() {
        const dpr = window.devicePixelRatio || 1;

        const mainRect = this.mainCanvas.getBoundingClientRect();
        const mainWidth = Math.max(240, Math.min(400, Math.floor(mainRect.width || 320)));
        const mainHeight = mainWidth;
        this.mainCanvas.width = Math.round(mainWidth * dpr);
        this.mainCanvas.height = Math.round(mainHeight * dpr);
        this.mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.cellSize = mainWidth / 8;

        const shapesRect = this.shapesCanvas.getBoundingClientRect();
        const shapesWidth = Math.max(260, Math.floor(shapesRect.width || 320));
        const shapesHeight = Math.max(110, Math.min(150, Math.floor(shapesRect.height || 140)));
        this.shapesCanvas.width = Math.round(shapesWidth * dpr);
        this.shapesCanvas.height = Math.round(shapesHeight * dpr);
        this.shapesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.shapeCellSize = Math.max(18, Math.min(28, Math.floor(shapesWidth / 15)));

        const oppRect = this.oppCanvas.getBoundingClientRect();
        const oppSize = Math.max(120, Math.min(160, Math.floor(oppRect.width || 160)));
        this.oppCanvas.width = Math.round(oppSize * dpr);
        this.oppCanvas.height = Math.round(oppSize * dpr);
        this.oppCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.oppCellSize = oppSize / 8;
    }

    handleShapesMouseDown(e) {
        if (!this.myState || !this.myState.shapes) return;

        const x = e.offsetX;
        const y = e.offsetY;
        const rect = this.shapesCanvas.getBoundingClientRect();
        const canvasWidth = rect.width || this.shapesCanvas.clientWidth || 320;
        const padding = Math.max(10, Math.floor(canvasWidth * 0.08));
        const zoneWidth = Math.max(70, Math.floor((canvasWidth - padding * 2) / 3));

        const zones = [
            { startX: padding, endX: padding + zoneWidth },
            { startX: padding + zoneWidth, endX: padding + zoneWidth * 2 },
            { startX: padding + zoneWidth * 2, endX: canvasWidth - padding }
        ];

        for (let i = 0; i < 3; i++) {
            if (this.myState.shapes[i] && x >= zones[i].startX && x <= zones[i].endX) {
                this.draggedShapeIndex = i;
                
                const shape = this.myState.shapes[i].shape;
                const shapeWidth = shape[0].length * this.shapeCellSize;
                const shapeHeight = shape.length * this.shapeCellSize;
                
                this.dragOffset.x = shapeWidth / 2;
                this.dragOffset.y = shapeHeight / 2;
                
                const mainRect = this.mainCanvas.getBoundingClientRect();
                this.dragPos.x = e.clientX || x + rect.left;
                this.dragPos.y = e.clientY || y + rect.top;
                
                break;
            }
        }
    }

    handleMouseMove(e) {
        if (this.draggedShapeIndex === -1) return;
        this.dragPos.x = e.clientX;
        this.dragPos.y = e.clientY;
    }

    handleMouseUp(e) {
        if (this.draggedShapeIndex === -1) return;

        const rect = this.mainCanvas.getBoundingClientRect();
        const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
        const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);

        if (clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom) {
            
            const canvasX = clientX - rect.left - this.dragOffset.x;
            const canvasY = clientY - rect.top - this.dragOffset.y;

            const gridX = Math.round(canvasX / this.cellSize);
            const gridY = Math.round(canvasY / this.cellSize);

            socket.emit('placeBlock', {
                x: gridX,
                y: gridY,
                shapeIndex: this.draggedShapeIndex
            });
            
            this.myState.shapes[this.draggedShapeIndex] = null; 
        }

        this.draggedShapeIndex = -1;
    }

    updateState(myState, oppState) {
        this.myState = myState;
        this.oppState = oppState;
    }

    triggerVisualEffects(effectData) {
        // Flash effects for rows
        effectData.clearedRows.forEach(r => {
            this.effects.push({
                type: 'flashRect',
                x: 0,
                y: r * this.cellSize,
                width: 8 * this.cellSize,
                height: this.cellSize,
                alpha: 1.0,
                decay: 0.05
            });
        });

        // Flash effects for cols
        effectData.clearedCols.forEach(c => {
            this.effects.push({
                type: 'flashRect',
                x: c * this.cellSize,
                y: 0,
                width: this.cellSize,
                height: 8 * this.cellSize,
                alpha: 1.0,
                decay: 0.05
            });
        });

        // Floating score text
        if (effectData.scoreAdded > 0) {
            this.effects.push({
                type: 'text',
                x: this.mainCanvas.width / 2,
                y: this.mainCanvas.height / 2,
                text: `+${effectData.scoreAdded}`,
                color: '#10b981', // Success color
                alpha: 1.0,
                decay: 0.02,
                dy: -2
            });
        }
    }

    drawGrid(ctx, grid, cellSize, emptyColor, solidColor) {
        if (!grid) return;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const x = c * cellSize;
                const y = r * cellSize;
                
                ctx.fillStyle = grid[r][c] === 1 ? solidColor : emptyColor;
                ctx.fillRect(x, y, cellSize, cellSize);
                
                ctx.strokeStyle = '#334155';
                ctx.strokeRect(x, y, cellSize, cellSize);

                if (grid[r][c] === 1) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fillRect(x, y, cellSize, cellSize / 2);
                }
            }
        }
    }

    drawShape(ctx, shapeMatrix, startX, startY, cellSize, color) {
        for (let r = 0; r < shapeMatrix.length; r++) {
            for (let c = 0; c < shapeMatrix[r].length; c++) {
                if (shapeMatrix[r][c] === 1) {
                    const x = startX + c * cellSize;
                    const y = startY + r * cellSize;
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, cellSize, cellSize);
                    
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.strokeRect(x, y, cellSize, cellSize);
                    
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(x, y, cellSize, cellSize / 2);
                }
            }
        }
    }

    renderEffects(ctx) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            
            ctx.save();
            ctx.globalAlpha = effect.alpha;

            if (effect.type === 'flashRect') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(effect.x, effect.y, effect.width, effect.height);
            } else if (effect.type === 'text') {
                ctx.fillStyle = '#ffffff'; // White text
                ctx.font = '900 42px Outfit, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Add thick neon shadow
                ctx.shadowColor = effect.color;
                ctx.shadowBlur = 20;
                
                // Stroke for readability
                ctx.lineWidth = 2;
                ctx.strokeStyle = effect.color;
                ctx.strokeText(effect.text, effect.x, effect.y);
                ctx.fillText(effect.text, effect.x, effect.y);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Add shadow for better visibility
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 10;
                
                ctx.fillText(effect.text, effect.x, effect.y);
                
                // Move text
                effect.y += effect.dy;
            }

            ctx.restore();

            // Decay and remove
            effect.alpha -= effect.decay;
            if (effect.alpha <= 0) {
                this.effects.splice(i, 1);
            }
        }
    }

    render() {
        this.mainCtx.clearRect(0, 0, this.mainCanvas.clientWidth, this.mainCanvas.clientHeight);
        this.shapesCtx.clearRect(0, 0, this.shapesCanvas.clientWidth, this.shapesCanvas.clientHeight);
        this.oppCtx.clearRect(0, 0, this.oppCanvas.clientWidth, this.oppCanvas.clientHeight);

        if (this.myState) {
            this.drawGrid(this.mainCtx, this.myState.grid, this.cellSize, 'rgba(255,255,255,0.03)', '#00F0FF');
        } else {
            this.drawGrid(this.mainCtx, Array(8).fill(Array(8).fill(0)), this.cellSize, 'rgba(255,255,255,0.03)', '#00F0FF');
        }

        // Render visual effects on top of main grid
        this.renderEffects(this.mainCtx);

        if (this.oppState) {
            this.drawGrid(this.oppCtx, this.oppState.grid, this.oppCellSize, 'rgba(255,255,255,0.03)', '#FF007F');
        }

        if (this.myState && this.myState.shapes) {
            const zones = [20, 140, 260];
            for (let i = 0; i < 3; i++) {
                const shapeObj = this.myState.shapes[i];
                if (shapeObj && this.draggedShapeIndex !== i) {
                    const shapeHeight = shapeObj.shape.length * this.shapeCellSize;
                    const yOffset = (150 - shapeHeight) / 2;
                    this.drawShape(this.shapesCtx, shapeObj.shape, zones[i], yOffset, this.shapeCellSize, '#00F0FF');
                }
            }
        }

        if (this.draggedShapeIndex !== -1 && this.myState && this.myState.shapes[this.draggedShapeIndex]) {
            const shapeObj = this.myState.shapes[this.draggedShapeIndex];
            const rect = this.mainCanvas.getBoundingClientRect();
            
            if (this.dragPos.x > rect.left - 100 && this.dragPos.x < rect.right + 100) {
                const canvasX = this.dragPos.x - rect.left - this.dragOffset.x;
                const canvasY = this.dragPos.y - rect.top - this.dragOffset.y;
                this.drawShape(this.mainCtx, shapeObj.shape, canvasX, canvasY, this.cellSize, 'rgba(0, 240, 255, 0.8)');
            } else {
                const sRect = this.shapesCanvas.getBoundingClientRect();
                const canvasX = this.dragPos.x - sRect.left - this.dragOffset.x;
                const canvasY = this.dragPos.y - sRect.top - this.dragOffset.y;
                this.drawShape(this.shapesCtx, shapeObj.shape, canvasX, canvasY, this.shapeCellSize, 'rgba(0, 240, 255, 0.8)');
            }
        }
    }

    loop() {
        this.render();
        requestAnimationFrame(this.loop.bind(this));
    }
}
