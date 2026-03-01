// Manages all projectiles in the game
import { Movement } from '../components/Movement.js';
import { GameConfig } from '../config/GameConfig.js';
import { Utils } from '../utils/Utils.js';
import { Health } from '../components/Health.js';
import { Transform } from '../components/Transform.js';
import { StatusEffects } from '../components/StatusEffects.js';
import { Combat } from '../components/Combat.js';
import { Rally } from '../components/Rally.js';
import { Projectile } from '../projectiles/Projectile.js';
import { EventTypes } from '../core/EventTypes.js';
import type { SystemManager } from '../core/SystemManager.js';
import type { CameraShape } from '../types/camera.js';
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
        stunBuildup = 0,
        pierce = false,
        airborneDuration = 0,
        width = 8,
        height = 8,
        color?: string,
        visualType?: string,
        aoeRadius = 0,
        aoeDamage = 0
    ): Projectile {
        const projectile = new Projectile(x, y, angle, speed, damage, range, owner, ownerType, stunBuildup, pierce, airborneDuration, width, height, color, visualType, aoeRadius, aoeDamage);
        this.projectiles.push(projectile);
        return projectile;
    }

    /** Apply AOE damage from projectile impact to all enemies within projectile.aoeRadius. */
    private applyPlayerProjectileAoe(
        projectile: Projectile,
        enemyManager: { enemies: unknown[] } | null,
        systems: SystemManager | null
    ): void {
        if (!enemyManager || projectile.aoeRadius <= 0) return;
        const cx = projectile.x;
        const cy = projectile.y;
        const r2 = projectile.aoeRadius * projectile.aoeRadius;
        const damage = projectile.aoeDamage;
        for (const enemy of enemyManager.enemies) {
            const enemyId = (enemy as { id?: string }).id;
            if (enemyId != null && projectile.hitEntityIds.has(enemyId)) continue;
            const enemyTransform = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Transform);
            const enemyHealth = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Health);
            if (!enemyTransform || !enemyHealth || (enemyHealth as Health).isDead) continue;
            const ex = (enemyTransform as Transform).x;
            const ey = (enemyTransform as Transform).y;
            const dx = ex - cx;
            const dy = ey - cy;
            if (dx * dx + dy * dy > r2) continue;
            projectile.hitEntityIds.add(enemyId ?? '');
            (enemyHealth as Health).takeDamage(damage);
            const enemyStatus = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(StatusEffects);
            if (enemyStatus) {
                (enemyStatus as StatusEffects).addStunBuildup(projectile.stunBuildup || 0);
            }
            const enemyMovement = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Movement);
            if (enemyMovement) {
                (enemyMovement as Movement).applyKnockback(dx, dy, (GameConfig.player.knockback as { force: number }).force);
            }
            if (systems?.eventBus) {
                systems.eventBus.emitTyped(EventTypes.PLAYER_HIT_ENEMY, {});
            }
        }
    }

    update(deltaTime: number, systems: SystemManager | null): void {
        const entityManager = systems ? systems.get('entities') : null;
        type ObstacleManagerLike = { canMoveTo(x: number, y: number, w: number, h: number): boolean; getObstacleAt?(x: number, y: number, w: number, h: number): unknown; damageObstacle?(o: unknown, d: number): void };
        const obstacleManager = systems ? (systems.get('obstacles') as ObstacleManagerLike | null) : null;
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
                // If we hit a breakable, damage it (and remove if hp <= 0)
                if (obstacleManager && typeof obstacleManager.getObstacleAt === 'function') {
                    const hitObstacle = obstacleManager.getObstacleAt(projectile.x, projectile.y, projectile.width, projectile.height) as { breakable?: boolean; hp?: number } | null;
                    if (hitObstacle && hitObstacle.breakable && hitObstacle.hp != null) {
                        obstacleManager.damageObstacle!(hitObstacle, projectile.damage);
                    }
                }
                if (projectile.ownerType === 'player' && projectile.aoeRadius > 0) {
                    this.applyPlayerProjectileAoe(projectile, enemyManager, systems);
                }
                projectile.active = false;
                this.projectiles.splice(i, 1);
                continue;
            }

            if (projectile.ownerType === 'player') {
                if (enemyManager) {
                    for (const enemy of enemyManager.enemies) {
                        const enemyId = (enemy as { id?: string }).id;
                        if (projectile.checkCollision(enemy as { getComponent<T>(c: new (...args: unknown[]) => T): T | null }, enemyId)) {
                            const enemyHealth = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Health);
                            const enemyTransform = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Transform);
                            if (enemyHealth) {
                                projectile.hitEntityIds.add(enemyId ?? '');
                                (enemyHealth as Health).takeDamage(projectile.damage);
                                const enemyStatus = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(StatusEffects);
                                if (enemyStatus) {
                                    (enemyStatus as StatusEffects).addStunBuildup(projectile.stunBuildup || 0);
                                    if (projectile.airborneDuration > 0) {
                                        const dirX = Math.cos(projectile.angle);
                                        const dirY = Math.sin(projectile.angle);
                                        (enemyStatus as StatusEffects).applyAirborne(projectile.airborneDuration, {
                                            directionX: dirX,
                                            directionY: dirY,
                                            speed: 140
                                        });
                                    }
                                }
                                const enemyMovement = (enemy as { getComponent: (c: unknown) => unknown }).getComponent(Movement);
                                if (enemyMovement && enemyTransform) {
                                    const dx = (enemyTransform as Transform).x - projectile.x;
                                    const dy = (enemyTransform as Transform).y - projectile.y;
                                    (enemyMovement as Movement).applyKnockback(dx, dy, (GameConfig.player.knockback as { force: number }).force);
                                }
                                if (systems?.eventBus) {
                                    systems.eventBus.emitTyped(EventTypes.PLAYER_HIT_ENEMY, {});
                                }
                            }
                            if (projectile.aoeRadius > 0) {
                                this.applyPlayerProjectileAoe(projectile, enemyManager, systems);
                            }
                            if (!projectile.pierce) {
                                projectile.active = false;
                                this.projectiles.splice(i, 1);
                                break;
                            }
                        }
                    }
                }
            } else {
                if (entityManager) {
                    const player = (entityManager as { get: (id: string) => unknown }).get('player');
                    if (player && projectile.checkCollision(player as { getComponent<T>(c: new (...args: unknown[]) => T): T | null })) {
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
                                const mult = blocked ? ((GameConfig.player.stun as { blockedMultiplier?: number } | undefined)?.blockedMultiplier ?? 0.5) : 1;
                                (playerStatus as StatusEffects).addStunBuildup(baseStun * mult);
                            }

                            if (playerMovement && playerTransform) {
                                const dx = (playerTransform as Transform).x - projectile.x;
                                const dy = (playerTransform as Transform).y - projectile.y;
                                const enemyConfig = GameConfig.enemy.types.skeleton || GameConfig.enemy.types.goblin;
                                const knockbackConfig = (enemyConfig as { knockback?: { force?: number; decay?: number } }).knockback || { force: 160, decay: 0.88 };
                                const baseForce = knockbackConfig.force! * (GameConfig.player.knockback as { receivedMultiplier?: number }).receivedMultiplier!;
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

            if (projectile.pierce && projectile.airborneDuration > 0) {
                // Tornado (Storm Release): top-down view — spinning circles and spiral arms
                const r = (Math.max(projectile.width, projectile.height) / 2) * z;
                const spin = (Date.now() / 100) % (Math.PI * 2);
                const lw = Math.max(1.5, 3 / z);

                const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
                grad.addColorStop(0, 'rgba(80, 100, 120, 0.5)');
                grad.addColorStop(0.35, 'rgba(140, 165, 190, 0.35)');
                grad.addColorStop(0.7, 'rgba(200, 215, 230, 0.2)');
                grad.addColorStop(1, 'rgba(220, 230, 245, 0.08)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(180, 200, 220, 0.5)';
                ctx.lineWidth = lw;
                const rings = 4;
                for (let i = 1; i <= rings; i++) {
                    const ringR = (i / rings) * r * 0.9;
                    ctx.beginPath();
                    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
                    ctx.stroke();
                }

                const arms = 3;
                for (let a = 0; a < arms; a++) {
                    const armPhase = (a / arms) * Math.PI * 2 + spin;
                    ctx.strokeStyle = `rgba(220, 235, 250, ${0.45 + (a % 2) * 0.15})`;
                    ctx.lineWidth = Math.max(1, lw * 1.1);
                    ctx.beginPath();
                    for (let i = 0; i <= 24; i++) {
                        const t = i / 24;
                        const radius = t * r;
                        const angle = armPhase + t * Math.PI * 2.5;
                        const x = Math.cos(angle) * radius;
                        const y = Math.sin(angle) * radius;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }

                ctx.fillStyle = 'rgba(60, 80, 100, 0.6)';
                ctx.strokeStyle = 'rgba(100, 130, 160, 0.7)';
                ctx.lineWidth = lw * 0.8;
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (projectile.visualType === 'rock') {
                // Ogre rock: use same style as obstacle 'rock' (irregular blob + highlight)
                const w = projectile.width * z;
                const h = projectile.height * z;
                const rw = w * 0.48;
                const rh = h * 0.44;
                ctx.fillStyle = projectile.color || '#4a4a4a';
                ctx.beginPath();
                for (let i = 0; i <= 8; i++) {
                    const a = (i / 8) * Math.PI * 2 + 0.1;
                    const r = (i & 1 ? 1.0 : 0.88);
                    const ex = Math.cos(a) * rw * r;
                    const ey = Math.sin(a) * rh * r;
                    if (i === 0) ctx.moveTo(ex, ey);
                    else ctx.lineTo(ex, ey);
                }
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#3a3a3a';
                ctx.lineWidth = Math.max(1, 1.5 / z);
                ctx.stroke();
                ctx.fillStyle = 'rgba(120, 120, 130, 0.4)';
                ctx.beginPath();
                ctx.ellipse(-w * 0.12, -h * 0.15, w * 0.2, h * 0.18, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (projectile.ownerType === 'enemy' && (projectile.width > 12 || projectile.height > 12)) {
                // Large enemy projectile (e.g. boss fireball): drawn as fireball
                const r = (Math.max(projectile.width, projectile.height) / 2) * z;
                const hex = projectile.color.replace('#', '');
                const rv = parseInt(hex.slice(0, 2), 16);
                const gv = parseInt(hex.slice(2, 4), 16);
                const bv = parseInt(hex.slice(4, 6), 16);
                const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
                grad.addColorStop(0, `rgba(255, 255, 200, 0.95)`);
                grad.addColorStop(0.4, `rgba(${rv}, ${gv}, ${bv}, 0.85)`);
                grad.addColorStop(0.85, `rgba(${Math.max(0, rv - 60)}, ${Math.max(0, gv - 40)}, ${Math.max(0, bv - 60)}, 0.6)`);
                grad.addColorStop(1, `rgba(${Math.max(0, rv - 100)}, 40, 20, 0.2)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `rgba(${rv}, ${gv}, ${bv}, 0.9)`;
                ctx.lineWidth = Math.max(1, 2 / z);
                ctx.stroke();
            } else if (projectile.ownerType === 'player' && (projectile.width >= 20 || projectile.aoeRadius > 0)) {
                // Magic orb (e.g. staff magic missile): large glowing circle
                const r = (Math.max(projectile.width, projectile.height) / 2) * z;
                const hex = (projectile.color || '#88aaff').replace('#', '');
                const rv = parseInt(hex.slice(0, 2), 16);
                const gv = parseInt(hex.slice(2, 4), 16);
                const bv = parseInt(hex.slice(4, 6), 16);
                const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
                grad.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
                grad.addColorStop(0.35, `rgba(${Math.min(255, rv + 80)}, ${Math.min(255, gv + 80)}, ${Math.min(255, bv + 100)}, 0.85)`);
                grad.addColorStop(0.75, `rgba(${rv}, ${gv}, ${bv}, 0.5)`);
                grad.addColorStop(1, `rgba(${Math.max(0, rv - 40)}, ${Math.max(0, gv - 20)}, ${Math.max(0, bv + 20)}, 0.15)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `rgba(${rv}, ${gv}, ${bv}, 0.9)`;
                ctx.lineWidth = Math.max(1, 2 / z);
                ctx.stroke();
            } else {
                // Arrow: diamond tip (front), shaft line, fletching (back). Drawn along +x.
                const len = 14 * z;
                const headLen = 4 * z;   // diamond tip depth
                const headW = 2.5 * z;   // diamond half-width
                const fletchLen = 3 * z; // fletching length (backward from tail)
                const fletchW = 2 * z;   // fletching half-width
                const tipX = len / 2;
                const tailX = -len / 2;

                ctx.strokeStyle = '#c0c0c0';
                ctx.lineWidth = Math.max(0.5, 1 / z);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                const headBackX = tipX - headLen;
                const headRearX = headBackX - headLen;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.moveTo(tipX, 0);
                ctx.lineTo(headBackX, headW);
                ctx.lineTo(headRearX, 0);
                ctx.lineTo(headBackX, -headW);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = '#6b5344';
                ctx.lineWidth = Math.max(1, 1.5 / z);
                const shaftLeft = tailX + fletchLen * 0.5;
                ctx.beginPath();
                ctx.moveTo(headRearX, 0);
                ctx.lineTo(shaftLeft, 0);
                ctx.stroke();

                ctx.strokeStyle = '#d0d0d0';
                ctx.fillStyle = '#f0f0f0';
                ctx.lineWidth = Math.max(0.5, 1 / z);
                ctx.beginPath();
                ctx.moveTo(tailX, 0);
                ctx.lineTo(tailX - fletchLen, fletchW);
                ctx.lineTo(tailX - fletchLen * 0.3, 0);
                ctx.lineTo(tailX - fletchLen, -fletchW);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    clear(): void {
        this.projectiles = [];
    }
}
