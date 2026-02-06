// Renderer for drawing the game
class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    clear() {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawWorld(camera, obstacleManager = null) {
        const tileSize = 50;
        const effectiveWidth = this.canvas.width / camera.zoom;
        const effectiveHeight = this.canvas.height / camera.zoom;
        const startX = Math.floor(camera.x / tileSize) * tileSize;
        const startY = Math.floor(camera.y / tileSize) * tileSize;

        // Draw grass tiles with variation
        for (let x = startX; x < camera.x + effectiveWidth + tileSize; x += tileSize) {
            for (let y = startY; y < camera.y + effectiveHeight + tileSize; y += tileSize) {
                const screenX = camera.toScreenX(x);
                const screenY = camera.toScreenY(y);
                
                // Create grass color variation
                const grassShade = 30 + Math.floor((x + y) % 3) * 5;
                this.ctx.fillStyle = `rgb(${grassShade}, ${grassShade + 20}, ${grassShade})`;
                this.ctx.fillRect(screenX, screenY, tileSize * camera.zoom, tileSize * camera.zoom);
            }
        }

        // Draw obstacles/sprites
        if (obstacleManager) {
            this.drawObstacles(obstacleManager, camera);
        }
    }

    drawObstacles(obstacleManager, camera) {
        for (const obstacle of obstacleManager.obstacles) {
            const screenX = camera.toScreenX(obstacle.x);
            const screenY = camera.toScreenY(obstacle.y);
            
            // Check if obstacle is in view
            if (screenX > -obstacle.width * camera.zoom && 
                screenX < this.canvas.width + obstacle.width * camera.zoom &&
                screenY > -obstacle.height * camera.zoom && 
                screenY < this.canvas.height + obstacle.height * camera.zoom) {
                
                // Draw sprite if available
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
                
                // Fallback: draw simple tree shape
                if (obstacle.type === 'tree') {
                    // Draw tree trunk
                    this.ctx.fillStyle = '#4a2c1a';
                    this.ctx.fillRect(
                        screenX + obstacle.width * camera.zoom * 0.4,
                        screenY + obstacle.height * camera.zoom * 0.6,
                        obstacle.width * camera.zoom * 0.2,
                        obstacle.height * camera.zoom * 0.4
                    );
                    
                    // Draw tree foliage (circle)
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
                    // Draw other obstacle types as colored rectangles
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

    drawPlayer(player, camera) {
        const screenX = camera.toScreenX(player.x);
        const screenY = camera.toScreenY(player.y);

        // Draw attack range indicator
        if (player.targetX !== null) {
            const targetScreenX = camera.toScreenX(player.targetX);
            const targetScreenY = camera.toScreenY(player.targetY);
            
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
            this.ctx.lineWidth = 2 / camera.zoom; // Scale line width with zoom
            this.ctx.beginPath();
            this.ctx.moveTo(screenX, screenY);
            this.ctx.lineTo(targetScreenX, targetScreenY);
            this.ctx.stroke();

            // Target marker
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(targetScreenX, targetScreenY, 5 / camera.zoom, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw attack arc when attacking (shows attack direction)
        if (player.isAttacking) {
            const range = player.attackRange * camera.zoom;
            const halfArc = player.attackArc / 2;
            const startAngle = player.facingAngle - halfArc;
            const endAngle = player.facingAngle + halfArc;
            
            // Draw attack arc
            this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
            this.ctx.lineWidth = 3 / camera.zoom;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, range, startAngle, endAngle);
            this.ctx.lineTo(screenX, screenY);
            this.ctx.closePath();
            this.ctx.stroke();
            
            // Fill arc with semi-transparent color
            this.ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
            this.ctx.fill();
        }

        // Draw player shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(screenX, screenY + (player.height / 2 + 5) * camera.zoom, 
                         (player.width / 2) * camera.zoom, (player.height / 4) * camera.zoom, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw player body
        this.ctx.fillStyle = player.isAttacking ? '#ff4444' : '#4444ff';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2 / camera.zoom; // Scale line width with zoom
        
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, (player.width / 2) * camera.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw player facing direction indicator (always visible)
        const indicatorLength = 15 * camera.zoom;
        const indicatorX = screenX + Math.cos(player.facingAngle) * indicatorLength;
        const indicatorY = screenY + Math.sin(player.facingAngle) * indicatorLength;
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2 / camera.zoom;
        this.ctx.beginPath();
        this.ctx.moveTo(screenX, screenY);
        this.ctx.lineTo(indicatorX, indicatorY);
        this.ctx.stroke();
        
        // Draw small circle at the end of the indicator
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(indicatorX, indicatorY, 3 / camera.zoom, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw health bar above player
        const barWidth = 40 * camera.zoom;
        const barHeight = 5 * camera.zoom;
        const barX = screenX - barWidth / 2;
        const barY = screenY - (player.height + 10) * camera.zoom;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthPercent = player.health / player.maxHealth;
        this.ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' : 
                            healthPercent > 0.25 ? '#ffff44' : '#ff4444';
        this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1 / camera.zoom; // Scale line width with zoom
        this.ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    drawEnemies(enemies, camera) {
        for (const enemy of enemies) {
            if (enemy.isDead) continue;

            const screenX = camera.toScreenX(enemy.x);
            const screenY = camera.toScreenY(enemy.y);

            // Check if enemy is in view
            if (screenX < -50 || screenX > this.canvas.width + 50 ||
                screenY < -50 || screenY > this.canvas.height + 50) {
                continue;
            }

            // Draw attack indicator
            if (enemy.isAttacking) {
                this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)';
                this.ctx.lineWidth = 2 / camera.zoom;
                this.ctx.beginPath();
                this.ctx.arc(screenX, screenY, enemy.attackRange * camera.zoom, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Draw shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.beginPath();
            this.ctx.ellipse(
                screenX, 
                screenY + (enemy.height / 2 + 5) * camera.zoom,
                (enemy.width / 2) * camera.zoom, 
                (enemy.height / 4) * camera.zoom, 
                0, 0, Math.PI * 2
            );
            this.ctx.fill();

            // Draw enemy body based on type
            this.ctx.fillStyle = enemy.color;
            this.ctx.strokeStyle = enemy.state === 'attack' ? '#ff0000' : '#000000';
            this.ctx.lineWidth = 2 / camera.zoom;
            
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, (enemy.width / 2) * camera.zoom, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Draw eyes (simple AI indicator)
            const eyeSize = 2 / camera.zoom;
            const eyeOffset = 5 * camera.zoom;
            this.ctx.fillStyle = enemy.state === 'chase' ? '#ff0000' : '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(screenX - eyeOffset, screenY - eyeOffset, eyeSize, 0, Math.PI * 2);
            this.ctx.arc(screenX + eyeOffset, screenY - eyeOffset, eyeSize, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw health bar
            const barWidth = 30 * camera.zoom;
            const barHeight = 4 * camera.zoom;
            const barX = screenX - barWidth / 2;
            const barY = screenY - (enemy.height + 8) * camera.zoom;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            const healthPercent = enemy.health / enemy.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.5 ? '#44ff44' : 
                                healthPercent > 0.25 ? '#ffff44' : '#ff4444';
            this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1 / camera.zoom;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }

    drawMinimap(camera, player, obstacleManager, enemyManager, worldWidth, worldHeight) {
        // Mini-map settings
        const minimapSize = 200;
        const minimapPadding = 10;
        const minimapX = this.canvas.width - minimapSize - minimapPadding;
        const minimapY = minimapPadding;
        
        // Calculate scale to fit world in mini-map
        const scaleX = minimapSize / worldWidth;
        const scaleY = minimapSize / worldHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Actual mini-map dimensions (may be smaller to maintain aspect ratio)
        const minimapWidth = worldWidth * scale;
        const minimapHeight = worldHeight * scale;
        
        // Draw mini-map background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
        
        // Draw mini-map border
        this.ctx.strokeStyle = '#8b0000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
        
        // Save context for transformations
        this.ctx.save();
        
        // Translate to mini-map position
        this.ctx.translate(minimapX + (minimapSize - minimapWidth) / 2, minimapY + (minimapSize - minimapHeight) / 2);
        this.ctx.scale(scale, scale);
        
        // Draw world background (grass tiles)
        const tileSize = 50;
        this.ctx.fillStyle = '#2a4a2a';
        for (let x = 0; x < worldWidth; x += tileSize) {
            for (let y = 0; y < worldHeight; y += tileSize) {
                const grassShade = 30 + Math.floor((x + y) % 3) * 5;
                this.ctx.fillStyle = `rgb(${grassShade}, ${grassShade + 20}, ${grassShade})`;
                this.ctx.fillRect(x, y, tileSize, tileSize);
            }
        }
        
        // Draw obstacles on mini-map
        if (obstacleManager) {
            this.ctx.fillStyle = '#2d5016';
            for (const obstacle of obstacleManager.obstacles) {
                // Draw obstacles as small dots
                this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            }
        }
        
        // Draw enemies on mini-map
        if (enemyManager) {
            for (const enemy of enemyManager.enemies) {
                if (enemy.isDead) continue;
                
                this.ctx.fillStyle = enemy.color;
                this.ctx.beginPath();
                this.ctx.arc(enemy.x, enemy.y, 3 / scale, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
        
        // Draw camera viewport rectangle
        const effectiveWidth = this.canvas.width / camera.zoom;
        const effectiveHeight = this.canvas.height / camera.zoom;
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
        this.ctx.lineWidth = 2 / scale;
        this.ctx.strokeRect(camera.x, camera.y, effectiveWidth, effectiveHeight);
        
        // Draw player position
        this.ctx.fillStyle = '#4444ff';
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, 5 / scale, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw player direction indicator
        if (player.velocityX !== 0 || player.velocityY !== 0) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 1 / scale;
            this.ctx.beginPath();
            this.ctx.moveTo(player.x, player.y);
            this.ctx.lineTo(
                player.x + player.velocityX * 10,
                player.y + player.velocityY * 10
            );
            this.ctx.stroke();
        }
        
        // Restore context
        this.ctx.restore();
        
        // Draw mini-map label
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Mini-Map', minimapX + 5, minimapY + 15);
    }
}

