// Render System - handles all rendering
class RenderSystem {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    init(systems) {
        this.systems = systems;
    }

    clear() {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    renderWorld(camera, obstacleManager) {
        const tileSize = GameConfig.world.tileSize;
        const effectiveWidth = this.canvas.width / camera.zoom;
        const effectiveHeight = this.canvas.height / camera.zoom;
        const startX = Math.floor(camera.x / tileSize) * tileSize;
        const startY = Math.floor(camera.y / tileSize) * tileSize;

        // Draw grass tiles with variation
        for (let x = startX; x < camera.x + effectiveWidth + tileSize; x += tileSize) {
            for (let y = startY; y < camera.y + effectiveHeight + tileSize; y += tileSize) {
                const screenX = camera.toScreenX(x);
                const screenY = camera.toScreenY(y);
                
                const grassShade = 30 + Math.floor((x + y) % 3) * 5;
                this.ctx.fillStyle = `rgb(${grassShade}, ${grassShade + 20}, ${grassShade})`;
                this.ctx.fillRect(screenX, screenY, tileSize * camera.zoom, tileSize * camera.zoom);
            }
        }

        // Draw obstacles
        if (obstacleManager) {
            this.renderObstacles(obstacleManager, camera);
        }
    }

    renderObstacles(obstacleManager, camera) {
        for (const obstacle of obstacleManager.obstacles) {
            const screenX = camera.toScreenX(obstacle.x);
            const screenY = camera.toScreenY(obstacle.y);
            
            if (screenX > -obstacle.width * camera.zoom && 
                screenX < this.canvas.width + obstacle.width * camera.zoom &&
                screenY > -obstacle.height * camera.zoom && 
                screenY < this.canvas.height + obstacle.height * camera.zoom) {
                
                if (obstacle.spritePath && obstacleManager.loadedSprites.has(obstacle.spritePath)) {
                    const sprite = obstacleManager.loadedSprites.get(obstacle.spritePath);
                    if (sprite.complete && sprite.naturalWidth > 0) {
                        this.ctx.drawImage(
                            sprite,
                            screenX,
                            screenY,
                            obstacle.width * camera.zoom,
                            obstacle.height * camera.zoom
                        );
                        continue;
                    }
                }
                
                if (obstacle.type === 'tree') {
                    this.ctx.fillStyle = '#4a2c1a';
                    this.ctx.fillRect(
                        screenX + obstacle.width * camera.zoom * 0.4,
                        screenY + obstacle.height * camera.zoom * 0.6,
                        obstacle.width * camera.zoom * 0.2,
                        obstacle.height * camera.zoom * 0.4
                    );
                    
                    this.ctx.fillStyle = '#2d5016';
                    this.ctx.beginPath();
                    this.ctx.arc(
                        screenX + obstacle.width * camera.zoom * 0.5,
                        screenY + obstacle.height * camera.zoom * 0.4,
                        obstacle.width * camera.zoom * 0.4,
                        0, Math.PI * 2
                    );
                    this.ctx.fill();
                } else {
                    this.ctx.fillStyle = '#555';
                    this.ctx.fillRect(
                        screenX, 
                        screenY, 
                        obstacle.width * camera.zoom, 
                        obstacle.height * camera.zoom
                    );
                }
            }
        }
    }

    renderEntities(entities, camera) {
        const spriteManager = this.systems ? this.systems.get('sprites') : null;
        
        for (const entity of entities) {
            if (!entity.active) continue;
            
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            if (!transform || !renderable) continue;

            const screenX = camera.toScreenX(transform.x);
            const screenY = camera.toScreenY(transform.y);

            // Check if in view
            if (screenX < -50 || screenX > this.canvas.width + 50 ||
                screenY < -50 || screenY > this.canvas.height + 50) {
                continue;
            }

            // Try to render with sprite first, fallback to type-based rendering
            const sprite = entity.getComponent(Sprite);
            if (sprite && spriteManager) {
                this.renderSprite(entity, camera, screenX, screenY, spriteManager);
            } else {
                // Render based on type (fallback)
                if (renderable.type === 'player') {
                    this.renderPlayer(entity, camera, screenX, screenY);
                } else if (renderable.type === 'enemy') {
                    this.renderEnemy(entity, camera, screenX, screenY);
                }
            }
        }
    }

    // Render entity using sprite
    renderSprite(entity, camera, screenX, screenY, spriteManager) {
        const transform = entity.getComponent(Transform);
        const sprite = entity.getComponent(Sprite);
        const animation = entity.getComponent(Animation);
        const movement = entity.getComponent(Movement);
        
        if (!sprite || !transform) return;

        const spriteSheet = sprite.getSpriteSheet(spriteManager, animation);
        const animSpriteSheetKey = animation ? animation.getCurrentSpriteSheetKey() : null;
        
        // #region agent log
        if (entity.id === 'player') {
            fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:141',message:'Sprite sheet lookup',data:{entityId:entity.id,currentAnimation:animation?.currentAnimation,hasSprite:!!sprite,hasAnimation:!!animation,hasSpriteSheet:!!spriteSheet,hasImage:!!(spriteSheet&&spriteSheet.image),defaultKey:sprite.defaultSpriteSheetKey,animKey:animSpriteSheetKey,frameWidth:spriteSheet?.frameWidth,frameHeight:spriteSheet?.frameHeight,rows:spriteSheet?.rows,cols:spriteSheet?.cols,imageWidth:spriteSheet?.image?.width,imageHeight:spriteSheet?.image?.height,useDirection:animation?.animations?.[animation?.currentAnimation]?.useDirection},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'B'})}).catch(()=>{});
        }
        // #endregion
        
        if (!spriteSheet || !spriteSheet.image) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:143',message:'Sprite sheet not found - falling back',data:{entityId:entity.id,hasRenderable:!!entity.getComponent(Renderable)},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            // Fallback to renderable if sprite not loaded
            const renderable = entity.getComponent(Renderable);
            if (renderable) {
                if (renderable.type === 'player') {
                    this.renderPlayer(entity, camera, screenX, screenY);
                } else if (renderable.type === 'enemy') {
                    this.renderEnemy(entity, camera, screenX, screenY);
                }
            }
            return;
        }

        // Determine which frame to render
        let row = 0;
        let col = 0;

        if (animation && animation.currentAnimation) {
            // Use animation to determine frame
            const anim = animation.animations[animation.currentAnimation];
            if (anim && anim.frames) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:173',message:'Before getCurrentFrameIndex',data:{entityId:entity.id,currentAnimation:animation.currentAnimation,currentFrame:animation.currentFrame,elapsedTime:animation.elapsedTime,isPlaying:animation.isPlaying},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                
                // Get current frame index from animation
                const frameIndex = animation.getCurrentFrameIndex();
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:180',message:'After getCurrentFrameIndex',data:{entityId:entity.id,currentAnimation:animation.currentAnimation,currentFrame:animation.currentFrame,frameIndex,frameIndexValid:frameIndex>=0&&frameIndex<anim.frames.length,frameIndexOutOfBounds:frameIndex>=anim.frames.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                
                // Convert frame index to row and column based on sprite sheet layout
                // Check if this animation uses direction-based row selection (e.g., Walk.png with 8 directions)
                if (anim.useDirection && movement) {
                    // Direction-based animation: row is determined by movement direction, col is the frame index
                    const direction = SpriteUtils.angleTo8Direction(movement.facingAngle);
                    row = direction;
                    col = frameIndex; // frameIndex is already 0-12 for walk animation
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:183',message:'Direction-based frame selection',data:{entityId:entity.id,currentAnimation:animation.currentAnimation,useDirection:true,frameIndex,direction,row,col,facingAngle:movement.facingAngle},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                } else if (spriteSheet && spriteSheet.rows > 1) {
                    // Multi-row sprite sheet: calculate row and col from frame index
                    // For non-directional animations, frames are laid out left-to-right, top-to-bottom
                    row = Math.floor(frameIndex / spriteSheet.cols);
                    col = frameIndex % spriteSheet.cols;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:189',message:'Multi-row frame selection',data:{entityId:entity.id,currentAnimation:animation.currentAnimation,useDirection:false,frameIndex,row,col,spriteSheetRows:spriteSheet.rows,spriteSheetCols:spriteSheet.cols},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                } else {
                    // Single-row sprite sheet: row is always 0, col is frame index
                    row = 0;
                    col = frameIndex;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:195',message:'Single-row frame selection',data:{entityId:entity.id,currentAnimation:animation.currentAnimation,useDirection:false,frameIndex,row,col},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                    // #endregion
                }
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:168',message:'Frame selection from animation',data:{entityId:entity.id,currentAnimation:animation.currentAnimation,currentFrame:animation.currentFrame,frameIndex,col,row,spriteSheetRows:spriteSheet?.rows,spriteSheetCols:spriteSheet?.cols,framesArrayLength:anim.frames.length,rowOutOfBounds:row>=spriteSheet?.rows,colOutOfBounds:col>=spriteSheet?.cols},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                
                // Debug log for first frame
                if (entity.id === 'player' && frameIndex === 0) {
                    console.log(`Animation: ${animation.currentAnimation}, frameIndex: ${frameIndex}, col: ${col}, frames array:`, anim.frames);
                }
            }
        } else if (movement) {
            // Fallback: use movement direction to determine sprite row (for multi-row sheets)
            const direction = SpriteUtils.angleToDirection(movement.facingAngle);
            row = direction;
            
            // If moving, use frame based on time, otherwise use frame 0 (idle)
            const isMoving = movement.velocityX !== 0 || movement.velocityY !== 0;
            if (isMoving) {
                // Simple walk animation based on time
                const walkSpeed = 0.2; // seconds per frame
                col = Math.floor((performance.now() / 1000) / walkSpeed) % 4;
            } else {
                col = 0; // Idle frame
            }
        }
        
        // Clamp row and column to valid ranges
        if (spriteSheet) {
            row = Math.max(0, Math.min(row, spriteSheet.rows - 1));
            col = Math.max(0, Math.min(col, spriteSheet.cols - 1));
        }

        // Get frame coordinates from sprite sheet
        const frameCoords = SpriteUtils.getFrameCoords(spriteSheet, row, col);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:209',message:'Frame coords calculation',data:{entityId:entity.id,row,col,hasFrameCoords:!!frameCoords,sourceX:frameCoords?.sourceX,sourceY:frameCoords?.sourceY,sourceWidth:frameCoords?.sourceWidth,sourceHeight:frameCoords?.sourceHeight,frameWidth:spriteSheet.frameWidth,frameHeight:spriteSheet.frameHeight,imageWidth:spriteSheet.image.width,imageHeight:spriteSheet.image.height,widthMatchesImage:frameCoords?.sourceWidth>=spriteSheet.image.width},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        if (!frameCoords) {
            console.warn('No frame coordinates found for sprite sheet');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:212',message:'Frame coords null - returning',data:{entityId:entity.id,row,col},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            return;
        }

        // Verify frame coordinates are valid
        if (frameCoords.sourceWidth <= 0 || frameCoords.sourceHeight <= 0) {
            console.warn('Invalid frame dimensions:', frameCoords);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:217',message:'Invalid frame dimensions - returning',data:{entityId:entity.id,sourceWidth:frameCoords.sourceWidth,sourceHeight:frameCoords.sourceHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            return;
        }
        
        // Debug: Log frame extraction info (first frame only, once)
        if (entity.id === 'player' && col === 0 && row === 0 && !this._debugLogged) {
            this._debugLogged = true;
            console.log('=== Sprite Frame Extraction Debug ===');
            console.log('Entity:', entity.id);
            console.log('Row:', row, 'Col:', col);
            console.log('Sprite Sheet:', {
                frameWidth: spriteSheet.frameWidth,
                frameHeight: spriteSheet.frameHeight,
                cols: spriteSheet.cols,
                rows: spriteSheet.rows,
                imageWidth: spriteSheet.image.width,
                imageHeight: spriteSheet.image.height
            });
            console.log('Frame Coords:', frameCoords);
            console.log('Expected: Single frame extracted from sprite sheet');
            console.log('=====================================');
        }

        // Calculate screen position with offset
        const drawX = screenX + sprite.offsetX * camera.zoom;
        const drawY = screenY + sprite.offsetY * camera.zoom;
        
        // Use frame dimensions for display size to maintain aspect ratio
        const frameAspectRatio = frameCoords.sourceWidth / frameCoords.sourceHeight;
        const baseSize = sprite.width * camera.zoom * sprite.scaleX;
        const drawWidth = baseSize;
        const drawHeight = baseSize / frameAspectRatio;

        // Apply transformations
        this.ctx.save();
        this.ctx.translate(drawX, drawY);
        this.ctx.scale(sprite.scaleX * (sprite.flipX ? -1 : 1), sprite.scaleY);
        this.ctx.rotate(sprite.rotation);

        // Draw sprite frame with pixel-perfect rendering
        // Use imageSmoothingEnabled = false for crisp pixel art
        const oldImageSmoothing = this.ctx.imageSmoothingEnabled;
        this.ctx.imageSmoothingEnabled = false;
        
        // Draw only the specific frame from the sprite sheet
        // Parameters: image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight
        // CRITICAL: We MUST use the 9-parameter version to extract a portion of the image
        // For horizontal sprite sheets (single row), sourceHeight CAN equal imageHeight (that's correct!)
        // We only need to check that sourceWidth is less than imageWidth (we're extracting a column)
        if (frameCoords.sourceWidth >= spriteSheet.image.width) {
            console.error('Frame width matches entire image width! This will draw the whole sprite sheet.', {
                sourceWidth: frameCoords.sourceWidth,
                sourceHeight: frameCoords.sourceHeight,
                imageWidth: spriteSheet.image.width,
                imageHeight: spriteSheet.image.height,
                frameWidth: spriteSheet.frameWidth,
                frameHeight: spriteSheet.frameHeight,
                row, col
            });
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:266',message:'Frame width matches entire image - BLOCKED',data:{entityId:entity.id,sourceWidth:frameCoords.sourceWidth,sourceHeight:frameCoords.sourceHeight,imageWidth:spriteSheet.image.width,imageHeight:spriteSheet.image.height,row,col},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            return; // Don't draw if frame width matches entire image width
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:279',message:'About to call drawImage',data:{entityId:entity.id,row,col,sourceX:frameCoords.sourceX,sourceY:frameCoords.sourceY,sourceWidth:frameCoords.sourceWidth,sourceHeight:frameCoords.sourceHeight,imageWidth:spriteSheet.image.width,imageHeight:spriteSheet.image.height,drawWidth,drawHeight,frameWidth:spriteSheet.frameWidth,frameHeight:spriteSheet.frameHeight},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // Ensure all source coordinates are integers (required by drawImage)
        const sx = Math.floor(frameCoords.sourceX);
        const sy = Math.floor(frameCoords.sourceY);
        const sWidth = Math.floor(frameCoords.sourceWidth);
        const sHeight = Math.floor(frameCoords.sourceHeight);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:304',message:'drawImage call with integer coords',data:{entityId:entity.id,row,col,sx,sy,sWidth,sHeight,imageWidth:spriteSheet.image.width,imageHeight:spriteSheet.image.height,drawWidth,drawHeight,frameWidth:spriteSheet.frameWidth,frameHeight:spriteSheet.frameHeight,widthMatchesImage:sWidth>=spriteSheet.image.width,willDrawAllFrames:sWidth>=spriteSheet.image.width},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        
        this.ctx.drawImage(
            spriteSheet.image,
            sx,                        // Source X (integer)
            sy,                        // Source Y (integer)
            sWidth,                    // Source width (integer)
            sHeight,                   // Source height (integer)
            -drawWidth / 2,           // Destination X (centered)
            -drawHeight / 2,          // Destination Y (centered)
            drawWidth,                // Destination width
            drawHeight                // Destination height
        );
        
        // #region agent log
        if (entity.id === 'player') {
            fetch('http://127.0.0.1:7242/ingest/e535072a-96e6-4390-b673-9e50f66af7db',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RenderSystem.js:317',message:'drawImage completed',data:{entityId:entity.id,row,col,sx,sy,sWidth,sHeight,imageWidth:spriteSheet.image.width},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        }
        // #endregion
        
        // Restore image smoothing setting
        this.ctx.imageSmoothingEnabled = oldImageSmoothing;

        // Apply tint if needed
        if (sprite.tint) {
            this.ctx.globalCompositeOperation = 'multiply';
            this.ctx.fillStyle = sprite.tint;
            this.ctx.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
            this.ctx.globalCompositeOperation = 'source-over';
        }

        this.ctx.restore();

        // Draw additional effects (shadows, health bars, etc.)
        this.renderEntityEffects(entity, camera, screenX, screenY);
    }

    // Render additional effects for entities (shadows, health bars, etc.)
    renderEntityEffects(entity, camera, screenX, screenY) {
        const transform = entity.getComponent(Transform);
        const health = entity.getComponent(Health);
        const combat = entity.getComponent(Combat);
        const movement = entity.getComponent(Movement);
        const renderable = entity.getComponent(Renderable);

        // Draw shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(
            screenX,
            screenY + (transform.height / 2 + 5) * camera.zoom,
            (transform.width / 2) * camera.zoom,
            (transform.height / 4) * camera.zoom,
            0, 0, Math.PI * 2
        );
        this.ctx.fill();

        // Draw health bar if health is not full
        if (health && health.percent < 1) {
            const barWidth = (renderable && renderable.type === 'player') ? 40 * camera.zoom : 30 * camera.zoom;
            const barHeight = (renderable && renderable.type === 'player') ? 5 * camera.zoom : 4 * camera.zoom;
            const barX = screenX - barWidth / 2;
            const barY = screenY - (transform.height + 10) * camera.zoom;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            const healthPercent = health.percent;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' :
                                healthPercent > 0.25 ? '#ffff44' : '#ff4444';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1 / camera.zoom;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }

        // Draw attack/block indicators (for player)
        if (renderable && renderable.type === 'player') {
            // Draw attack arc if attacking
            if (combat && combat.isAttacking && movement) {
                const range = combat.attackRange * camera.zoom;
                const halfArc = combat.attackArc / 2;
                const startAngle = movement.facingAngle - halfArc;
                const endAngle = movement.facingAngle + halfArc;
                
                this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
                this.ctx.lineWidth = 3 / camera.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, range, startAngle, endAngle);
                this.ctx.lineTo(screenX, screenY);
                this.ctx.closePath();
                this.ctx.stroke();
                
                this.ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
                this.ctx.fill();
            }

            // Draw block indicator if blocking
            if (combat && combat.isBlocking && movement) {
                const blockRange = (transform.width / 2 + 5) * camera.zoom;
                const halfArc = combat.blockArc / 2;
                const startAngle = movement.facingAngle - halfArc;
                const endAngle = movement.facingAngle + halfArc;
                
                this.ctx.strokeStyle = 'rgba(100, 150, 255, 0.8)';
                this.ctx.lineWidth = 4 / camera.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, blockRange, startAngle, endAngle);
                this.ctx.lineTo(screenX, screenY);
                this.ctx.closePath();
                this.ctx.stroke();
                
                this.ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
                this.ctx.fill();
            }
        }
    }

    renderPlayer(entity, camera, screenX, screenY) {
        const transform = entity.getComponent(Transform);
        const movement = entity.getComponent(Movement);
        const combat = entity.getComponent(Combat);
        const health = entity.getComponent(Health);
        const renderable = entity.getComponent(Renderable);

        // Draw path if following one
        if (movement && movement.path.length > 0) {
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            this.ctx.lineWidth = 2 / camera.zoom;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, screenY);
            
            for (let i = movement.pathIndex; i < movement.path.length; i++) {
                const waypoint = movement.path[i];
                const wpScreenX = camera.toScreenX(waypoint.x);
                const wpScreenY = camera.toScreenY(waypoint.y);
                this.ctx.lineTo(wpScreenX, wpScreenY);
            }
            this.ctx.stroke();
        }

        // Draw block indicator
        if (combat && combat.isBlocking && movement) {
            const blockRange = (transform.width / 2 + 5) * camera.zoom;
            const halfArc = combat.blockArc / 2;
            const startAngle = movement.facingAngle - halfArc;
            const endAngle = movement.facingAngle + halfArc;
            
            // Draw block arc
            this.ctx.strokeStyle = 'rgba(100, 150, 255, 0.8)';
            this.ctx.lineWidth = 4 / camera.zoom;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, blockRange, startAngle, endAngle);
            this.ctx.lineTo(screenX, screenY);
            this.ctx.closePath();
            this.ctx.stroke();
            
            // Fill block arc with semi-transparent color
            this.ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
            this.ctx.fill();
            
            // Draw shield icon (small circle at front)
            const shieldX = screenX + Math.cos(movement.facingAngle) * blockRange;
            const shieldY = screenY + Math.sin(movement.facingAngle) * blockRange;
            this.ctx.fillStyle = 'rgba(100, 150, 255, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(shieldX, shieldY, 8 / camera.zoom, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw attack arc with combo-specific visuals
        // Show visual for entire duration of attack (0.8s for stage 3, 0.2s for others)
        if (combat && combat.isAttacking) {
            const range = combat.attackRange * camera.zoom;
            
            // Different colors for each combo stage
            let attackColor = 'rgba(255, 100, 100, 0.8)';
            let fillAlpha = '0.2';
            if (combat.comboStage === 1) {
                attackColor = 'rgba(255, 100, 100, 0.8)'; // Red for swipe
                fillAlpha = '0.2';
            } else if (combat.comboStage === 2) {
                attackColor = 'rgba(255, 200, 100, 0.8)'; // Orange for stab
                fillAlpha = '0.2';
            } else if (combat.comboStage === 3) {
                attackColor = 'rgba(255, 255, 100, 0.9)'; // Yellow for spin
                fillAlpha = '0.3';
            }
            
            // Draw based on combo stage
            if (combat.comboStage === 3) {
                // 360 spin - draw full circle (visible for full 0.8s duration)
                this.ctx.strokeStyle = attackColor;
                this.ctx.lineWidth = 4 / camera.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, range, 0, Math.PI * 2);
                this.ctx.stroke();
                
                this.ctx.fillStyle = attackColor.replace('0.9', fillAlpha);
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, range, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Normal arc attack (stab or swipe)
                const halfArc = combat.attackArc / 2;
                const startAngle = movement ? movement.facingAngle - halfArc : -halfArc;
                const endAngle = movement ? movement.facingAngle + halfArc : halfArc;
                
                this.ctx.strokeStyle = attackColor;
                this.ctx.lineWidth = 3 / camera.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, range, startAngle, endAngle);
                this.ctx.lineTo(screenX, screenY);
                this.ctx.closePath();
                this.ctx.stroke();
                
                this.ctx.fillStyle = attackColor.replace('0.8', fillAlpha);
                this.ctx.fill();
            }
        }

        // Draw shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(
            screenX, 
            screenY + (transform.height / 2 + 5) * camera.zoom,
            (transform.width / 2) * camera.zoom,
            (transform.height / 4) * camera.zoom,
            0, 0, Math.PI * 2
        );
        this.ctx.fill();

        // Draw body
        const isDodging = movement && movement.isDodging;
        const isBlocking = combat && combat.isBlocking;
        
        // Grey out player during dodge
        if (isDodging) {
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillStyle = '#888888';
        } else if (isBlocking) {
            // Blue tint when blocking
            this.ctx.fillStyle = '#6666ff';
        } else {
            this.ctx.fillStyle = combat && combat.isAttacking ? '#ff4444' : renderable.color;
        }
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2 / camera.zoom;
        
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, (transform.width / 2) * camera.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Reset alpha
        this.ctx.globalAlpha = 1.0;

        // Draw facing direction
        if (movement) {
            const indicatorLength = 15 * camera.zoom;
            const indicatorX = screenX + Math.cos(movement.facingAngle) * indicatorLength;
            const indicatorY = screenY + Math.sin(movement.facingAngle) * indicatorLength;
            
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2 / camera.zoom;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, screenY);
            this.ctx.lineTo(indicatorX, indicatorY);
            this.ctx.stroke();
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(indicatorX, indicatorY, 3 / camera.zoom, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw health bar
        if (health) {
            const barWidth = 40 * camera.zoom;
            const barHeight = 5 * camera.zoom;
            const barX = screenX - barWidth / 2;
            const barY = screenY - (transform.height + 10) * camera.zoom;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            const healthPercent = health.percent;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' : 
                                healthPercent > 0.25 ? '#ffff44' : '#ff4444';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1 / camera.zoom;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
            
            // Reset text align
            this.ctx.textAlign = 'left';
        }
    }

    renderEnemy(entity, camera, screenX, screenY) {
        const transform = entity.getComponent(Transform);
        const combat = entity.getComponent(Combat);
        const health = entity.getComponent(Health);
        const renderable = entity.getComponent(Renderable);
        const ai = entity.getComponent(AI);

        // Draw lunge charge indicator
        if (ai && ai.isChargingLunge) {
            // Get lunge config to calculate progress
            const enemyConfig = ai.enemyType ? GameConfig.enemy.types[ai.enemyType] : null;
            const lungeConfig = enemyConfig && enemyConfig.lunge ? enemyConfig.lunge : null;
            if (lungeConfig) {
                const maxChargeTime = lungeConfig.chargeTime;
                const remainingTime = Math.max(0, ai.lungeChargeTimer);
                const chargeProgress = 1 - (remainingTime / maxChargeTime);
                const pulseSize = (transform.width / 2 + 10) * camera.zoom * (1 + chargeProgress * 0.5);
                const alpha = 0.8 - chargeProgress * 0.4;
                
                // Pulsing red circle during lunge charge
                this.ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`;
                this.ctx.lineWidth = 4 / camera.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, pulseSize, 0, Math.PI * 2);
                this.ctx.stroke();
                
                // Draw charge-up ring
                this.ctx.strokeStyle = `rgba(255, 150, 0, ${0.6 + chargeProgress * 0.4})`;
                this.ctx.lineWidth = 3 / camera.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, (transform.width / 2 + 5) * camera.zoom, 0, Math.PI * 2 * chargeProgress);
                this.ctx.stroke();
            }
        }

        // Draw wind-up indicator
        if (combat && combat.isWindingUp) {
            const windUpProgress = combat.windUpProgress;
            const pulseSize = (transform.width / 2 + 5) * camera.zoom * (1 + windUpProgress * 0.3);
            const alpha = 0.6 - windUpProgress * 0.4;
            
            // Pulsing circle during wind-up
            this.ctx.strokeStyle = `rgba(255, 200, 0, ${alpha})`;
            this.ctx.lineWidth = 3 / camera.zoom;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, pulseSize, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Attack range indicator (fades in during wind-up)
            this.ctx.strokeStyle = `rgba(255, 100, 100, ${windUpProgress * 0.6})`;
            this.ctx.lineWidth = 2 / camera.zoom;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, combat.attackRange * camera.zoom, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Draw attack indicator (when attack actually happens)
        if (combat && combat.isAttacking && !combat.isWindingUp) {
            this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
            this.ctx.lineWidth = 3 / camera.zoom;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, combat.attackRange * camera.zoom, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        // Draw shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(
            screenX,
            screenY + (transform.height / 2 + 5) * camera.zoom,
            (transform.width / 2) * camera.zoom,
            (transform.height / 4) * camera.zoom,
            0, 0, Math.PI * 2
        );
        this.ctx.fill();

        // Draw body - change color during wind-up or lunge charge
        let bodyColor = renderable.color;
        if (ai && ai.isChargingLunge) {
            // Make goblin red/orange during lunge charge
            const enemyConfig = ai.enemyType ? GameConfig.enemy.types[ai.enemyType] : null;
            const lungeConfig = enemyConfig && enemyConfig.lunge ? enemyConfig.lunge : null;
            if (lungeConfig) {
                const maxChargeTime = lungeConfig.chargeTime;
                const remainingTime = Math.max(0, ai.lungeChargeTimer);
                const chargeProgress = 1 - (remainingTime / maxChargeTime);
                bodyColor = `rgba(255, ${Math.floor(100 + (1 - chargeProgress) * 100)}, ${Math.floor(50 + (1 - chargeProgress) * 50)}, 1)`;
            }
        } else if (combat && combat.isWindingUp) {
            // Make enemy slightly red/orange during wind-up
            const intensity = combat.windUpProgress;
            bodyColor = `rgba(255, ${Math.floor(100 + (1 - intensity) * 100)}, ${Math.floor(50 + (1 - intensity) * 50)}, 1)`;
        } else if (combat && combat.isLunging) {
            // Make goblin bright red during lunge
            bodyColor = '#ff0000';
        }
        
        this.ctx.fillStyle = bodyColor;
        this.ctx.strokeStyle = (combat && (combat.isWindingUp || combat.isAttacking)) ? '#ff0000' : 
                               (ai && ai.state === 'attack') ? '#ff0000' : '#000000';
        this.ctx.lineWidth = 2 / camera.zoom;
        
        // Slightly larger during wind-up
        const sizeMultiplier = combat && combat.isWindingUp ? (1 + combat.windUpProgress * 0.1) : 1;
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, (transform.width / 2) * camera.zoom * sizeMultiplier, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw eyes
        const eyeSize = 2 / camera.zoom;
        const eyeOffset = 5 * camera.zoom;
        this.ctx.fillStyle = ai && ai.state === 'chase' ? '#ff0000' : '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(screenX - eyeOffset, screenY - eyeOffset, eyeSize, 0, Math.PI * 2);
        this.ctx.arc(screenX + eyeOffset, screenY - eyeOffset, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw health bar
        if (health && health.percent < 1) {
            const barWidth = 30 * camera.zoom;
            const barHeight = 4 * camera.zoom;
            const barX = screenX - barWidth / 2;
            const barY = screenY - (transform.height + 8) * camera.zoom;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            const healthPercent = health.percent;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' : 
                                healthPercent > 0.25 ? '#ffff44' : '#ff4444';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1 / camera.zoom;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }

    renderMinimap(camera, entityManager, worldWidth, worldHeight) {
        const minimapSize = 200;
        const minimapPadding = 10;
        const minimapX = this.canvas.width - minimapSize - minimapPadding;
        const minimapY = minimapPadding;
        
        const scaleX = minimapSize / worldWidth;
        const scaleY = minimapSize / worldHeight;
        const scale = Math.min(scaleX, scaleY);
        
        const minimapWidth = worldWidth * scale;
        const minimapHeight = worldHeight * scale;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
        
        this.ctx.strokeStyle = '#8b0000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
        
        this.ctx.save();
        this.ctx.translate(minimapX + (minimapSize - minimapWidth) / 2, minimapY + (minimapSize - minimapHeight) / 2);
        this.ctx.scale(scale, scale);
        
        // Draw world background
        const tileSize = GameConfig.world.tileSize;
        for (let x = 0; x < worldWidth; x += tileSize) {
            for (let y = 0; y < worldHeight; y += tileSize) {
                const grassShade = 30 + Math.floor((x + y) % 3) * 5;
                this.ctx.fillStyle = `rgb(${grassShade}, ${grassShade + 20}, ${grassShade})`;
                this.ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
        
        // Draw obstacles
        const obstacleManager = this.systems.get('obstacles');
        if (obstacleManager) {
            this.ctx.fillStyle = '#2d5016';
            for (const obstacle of obstacleManager.obstacles) {
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            }
        }
        
        // Draw entities
        const entities = entityManager.getAll();
        for (const entity of entities) {
            if (!entity.active) continue;
            
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            if (!transform || !renderable) continue;
            
            this.ctx.fillStyle = renderable.color;
            this.ctx.beginPath();
            this.ctx.arc(transform.x, transform.y, 3 / scale, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // Draw camera viewport
        const effectiveWidth = this.canvas.width / camera.zoom;
        const effectiveHeight = this.canvas.height / camera.zoom;
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        this.ctx.lineWidth = 2 / scale;
        this.ctx.strokeRect(camera.x, camera.y, effectiveWidth, effectiveHeight);
        
        this.ctx.restore();
        
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Mini-Map', minimapX + 5, minimapY + 15);
    }
}

