// Manages all projectiles in the game
import { Movement } from '../components/Movement.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';
import { Health } from '../components/Health.ts';
import { Transform } from '../components/Transform.ts';
import { StatusEffects } from '../components/StatusEffects.ts';
import { Combat } from '../components/Combat.ts';
import { Rally } from '../components/Rally.ts';
import { Projectile } from '../projectiles/Projectile.ts';
import { EventTypes } from '../core/EventTypes.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import type { CameraShape } from '../types/camera.ts';
import type { PlayingStateShape } from '../state/PlayingState.js';
import { getPlayerArmorReduction } from '../armor/armorConfigs.js';

export class ProjectileManager {
    projectiles: Projectile[] = [];

    createProjectile(
        x: number,
        y: number,
        angle: number,
        speed: number,
        damage: number,
        range: number,
        owner: unknown,
        ownerType: 'player' | 'enemy' = 'player',
        stunBuildup = 0
    ): Projectile {
        const projectile = new Projectile(x, y, angle, speed, damage, range, owner, ownerType, stunBuildup);
        this.projectiles.push(projectile);
        return projectile;
    }

    update(deltaTime: number, systems: SystemManager | null): void {
        const entityManager = systems ? systems.get('entities') : null;
        const obstacleManager = systems ? systems.get('obstacles') : null;
        const enemyManager = systems ? systems.get<{ enemies: unknown[] }>('enemies') : null;

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];

            if (!projectile.active) {
                this.projectiles.splice(i, 1);
                continue;
            }

            projectile.update(deltaTime);

            if (!projectile.active) {
                this.projectiles.splice(i, 1);
                continue;
            }

            if (projectile.checkObstacleCollision(obstacleManager)) {
                projectile.active = false;
                this.projectiles.splice(i, 1);
                continue;
            }

            if (projectile.ownerType === 'player') {
                if (enemyManager) {
                    for (const enemy of enemyManager.enemies) {
                        if (projectile.checkCollision(enemy)) {
                            const enemyHealth = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Health);
                            const enemyTransform = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Transform);
                            if (enemyHealth) {
                                (enemyHealth as Health).takeDamage(projectile.damage);
                                const enemyStatus = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(StatusEffects);
                                if (enemyStatus) (enemyStatus as StatusEffects).addStunBuildup(projectile.stunBuildup || 0);
                                const enemyMovement = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Movement);
                                if (enemyMovement && enemyTransform) {
                                    const dx = (enemyTransform as Transform).x - projectile.x;
                                    const dy = (enemyTransform as Transform).y - projectile.y;
                                    (enemyMovement as Movement).applyKnockback(dx, dy, GameConfig.player.knockback.force);
                                }
                                if (systems?.eventBus) {
                                    (systems.eventBus as { emit(name: string, payload?: unknown): void }).emit(EventTypes.PLAYER_HIT_ENEMY, {});
                                }
                            }
                            projectile.active = false;
                            this.projectiles.splice(i, 1);
                            break;
                        }
                    }
                }
            } else {
                if (entityManager) {
                    const player = (entityManager as { get: (id: string) => unknown }).get('player');
                    if (player && projectile.checkCollision(player)) {
                        const playerHealth = (player as { getComponent: (c: unknown) => unknown }).getComponent(Health);
                        const playerCombat = (player as { getComponent: (c: unknown) => unknown }).getComponent(Combat);
                        const playerMovement = (player as { getComponent: (c: unknown) => unknown }).getComponent(Movement);
                        const playerTransform = (player as { getComponent: (c: unknown) => unknown }).getComponent(Transform);

                        if (playerHealth) {
                            let finalDamage = projectile.damage;
                            let blocked = false;
                            let parried = false;

                            if (playerCombat && (playerCombat as Combat).isBlocking && playerMovement && playerTransform) {
                                const attackAngle = Utils.angleTo(
                                    (playerTransform as Transform).x, (playerTransform as Transform).y,
                                    projectile.x, projectile.y
                                );
                                if ((playerCombat as Combat).canBlockAttack(attackAngle, (playerMovement as Movement).facingAngle)) {
                                    if ((playerCombat as Combat).isInParryWindow() && (playerCombat as Combat).getParryRallyPercent() > 0) {
                                        const rallyAmount = finalDamage * (playerCombat as Combat).getParryRallyPercent();
                                        const rally = (player as { getComponent: (c: unknown) => unknown }).getComponent(Rally);
                                        if (rally) (rally as Rally).addToPool(rallyAmount);
                                        (playerCombat as Combat).applyParry(rallyAmount, 220);
                                        finalDamage = 0;
                                        blocked = true;
                                        parried = true;
                                    } else if ((playerCombat as Combat).consumeBlockStamina('ranged')) {
                                        finalDamage = projectile.damage * (1 - (playerCombat as Combat).getEffectiveBlockDamageReduction('ranged'));
                                        blocked = true;
                                    }
                                }
                            }

                            const ps = systems?.get<PlayingStateShape>('playingState');
                            if (ps) finalDamage *= Math.max(0, 1 - getPlayerArmorReduction(ps));
                            (playerHealth as Health).takeDamage(finalDamage, blocked, parried);
                            const playerStatus = (player as { getComponent: (c: unknown) => unknown }).getComponent(StatusEffects);
                            if (playerStatus) {
                                const baseStun = projectile.stunBuildup || 0;
                                const mult = blocked ? (GameConfig.player.stun?.blockedMultiplier ?? 0.5) : 1;
                                (playerStatus as StatusEffects).addStunBuildup(baseStun * mult);
                            }

                            if (playerMovement && playerTransform) {
                                const dx = (playerTransform as Transform).x - projectile.x;
                                const dy = (playerTransform as Transform).y - projectile.y;
                                const enemyConfig = GameConfig.enemy.types.skeleton || GameConfig.enemy.types.goblin;
                                const knockbackConfig = enemyConfig.knockback || { force: 160, decay: 0.88 };
                                const baseForce = knockbackConfig.force * GameConfig.player.knockback.receivedMultiplier;
                                (playerMovement as Movement).applyKnockback(dx, dy, baseForce);
                            }
                        }
                        projectile.active = false;
                        this.projectiles.splice(i, 1);
                    }
                }
            }
        }
    }

    render(ctx: CanvasRenderingContext2D, camera: CameraShape): void {
        const z = camera.zoom;
        for (const projectile of this.projectiles) {
            if (!projectile.active) continue;
            const screenX = camera.toScreenX(projectile.x);
            const screenY = camera.toScreenY(projectile.y);
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) continue;
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(projectile.angle);
            // Arrow shape: shaft + head (drawn along local x-axis, pointing right)
            const len = 14 * z;
            const halfW = 1.5 * z;
            const headLen = 5 * z;
            ctx.fillStyle = projectile.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = Math.max(0.5, 1 / z);
            ctx.beginPath();
            // Shaft (rounded rect from -len/2 to head start)
            const shaftEnd = len / 2 - headLen;
            ctx.moveTo(-len / 2, halfW);
            ctx.lineTo(shaftEnd, halfW);
            ctx.lineTo(shaftEnd + headLen, 0);
            ctx.lineTo(shaftEnd, -halfW);
            ctx.lineTo(-len / 2, -halfW);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    clear(): void {
        this.projectiles = [];
    }
}
