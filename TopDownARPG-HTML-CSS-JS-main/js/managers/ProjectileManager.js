// Manages all projectiles in the game
class ProjectileManager {
    constructor() {
        this.projectiles = [];
    }

    // Create a new projectile
    createProjectile(x, y, angle, speed, damage, range, owner, ownerType = 'player') {
        const projectile = new Projectile(x, y, angle, speed, damage, range, owner, ownerType);
        this.projectiles.push(projectile);
        return projectile;
    }

    update(deltaTime, systems) {
        const entityManager = systems ? systems.get('entities') : null;
        const obstacleManager = systems ? systems.get('obstacles') : null;
        const enemyManager = systems ? systems.get('enemies') : null;
        
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            if (!projectile.active) {
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Update projectile position
            projectile.update(deltaTime);
            
            if (!projectile.active) {
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check collision with obstacles
            if (projectile.checkObstacleCollision(obstacleManager)) {
                projectile.active = false;
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check collision with entities
            if (projectile.ownerType === 'player') {
                // Player projectile - check collision with enemies
                if (enemyManager) {
                    for (const enemy of enemyManager.enemies) {
                        if (projectile.checkCollision(enemy)) {
                            // Hit enemy
                            const enemyHealth = enemy.getComponent(Health);
                            const enemyTransform = enemy.getComponent(Transform);
                            if (enemyHealth) {
                                const died = enemyHealth.takeDamage(projectile.damage);
                                if (died && systems) {
                                    const dropChance = GameConfig.player.healthOrbDropChance ?? 0.25;
                                    if (Math.random() < dropChance && enemyTransform) {
                                        const healthOrbManager = systems.get('healthOrbs');
                                        if (healthOrbManager) {
                                            healthOrbManager.createOrb(enemyTransform.x, enemyTransform.y);
                                        }
                                    }
                                }
                                
                                // Apply knockback
                                const enemyMovement = enemy.getComponent(Movement);
                                if (enemyMovement && enemyTransform) {
                                    const dx = enemyTransform.x - projectile.x;
                                    const dy = enemyTransform.y - projectile.y;
                                    enemyMovement.applyKnockback(dx, dy, GameConfig.player.knockback.force);
                                }
                            }
                            
                            projectile.active = false;
                            this.projectiles.splice(i, 1);
                            break;
                        }
                    }
                }
            } else {
                // Enemy projectile - check collision with player
                if (entityManager) {
                    const player = entityManager.get('player');
                    if (player && projectile.checkCollision(player)) {
                        // Hit player
                        const playerHealth = player.getComponent(Health);
                        const playerCombat = player.getComponent(Combat);
                        const playerMovement = player.getComponent(Movement);
                        const playerTransform = player.getComponent(Transform);
                        
                        if (playerHealth) {
                            let finalDamage = projectile.damage;
                            let blocked = false;
                            
                            // Check if player is blocking
                            if (playerCombat && playerCombat.isBlocking && playerMovement && playerTransform) {
                                // Calculate angle from player to projectile
                                const attackAngle = Utils.angleTo(
                                    playerTransform.x, playerTransform.y,
                                    projectile.x, projectile.y
                                );
                                
                                if (playerCombat.canBlockAttack(attackAngle, playerMovement.facingAngle)) {
                                    // Check if player has enough stamina to block
                                    if (playerCombat.consumeBlockStamina()) {
                                        finalDamage = projectile.damage * (1 - playerCombat.blockDamageReduction);
                                        blocked = true;
                                    }
                                }
                            }
                            
                            playerHealth.takeDamage(finalDamage, blocked);
                            
                            // Apply knockback: full when not blocked, half when blocked
                            if (playerMovement && playerTransform) {
                                const dx = playerTransform.x - projectile.x;
                                const dy = playerTransform.y - projectile.y;
                                const enemyConfig = GameConfig.enemy.types.skeleton || GameConfig.enemy.types.goblin;
                                const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                                const baseForce = knockbackConfig.force * GameConfig.player.knockback.receivedMultiplier;
                                const finalKnockbackForce = blocked ? baseForce * 0.5 : baseForce;
                                playerMovement.applyKnockback(dx, dy, finalKnockbackForce);
                            }
                        }
                        
                        projectile.active = false;
                        this.projectiles.splice(i, 1);
                    }
                }
            }
        }
    }

    render(ctx, camera) {
        for (const projectile of this.projectiles) {
            if (!projectile.active) continue;
            
            const screenX = camera.toScreenX(projectile.x);
            const screenY = camera.toScreenY(projectile.y);
            
            // Skip if off screen
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) {
                continue;
            }
            
            // Draw projectile
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(projectile.angle);
            
            // Draw projectile body
            ctx.fillStyle = projectile.color;
            ctx.beginPath();
            ctx.arc(0, 0, projectile.width / 2 * camera.zoom, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw outline
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1 / camera.zoom;
            ctx.stroke();
            
            ctx.restore();
        }
    }

    clear() {
        this.projectiles = [];
    }
}

