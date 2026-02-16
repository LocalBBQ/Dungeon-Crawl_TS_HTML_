// AI component for enemy behavior
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';
import { Movement } from './Movement.ts';
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';
import { Transform } from './Transform.ts';
import { Combat } from './Combat.ts';
import { Health } from './Health.ts';
import { StatusEffects } from './StatusEffects.ts';
import { Stamina } from './Stamina.ts';

export interface PatrolConfig {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  distance?: number;
}

export type AIState = 'idle' | 'chase' | 'attack' | 'patrol' | 'lunge' | 'backOff';
export type IdleBehavior = 'patrol' | 'guard' | 'wander' | 'loiter' | 'sleep' | 'circularPatrol' | 'packFollow';

export class AI implements Component {
    entity: { getComponent<T>(c: new (...args: unknown[]) => T): T | null } | null;
    enemyType: string | null;
    state: AIState;
    detectionRange: number;
    attackRange: number;
    idleTimer: number;
    wanderTargetX: number;
    wanderTargetY: number;
    pathUpdateTimer: number;
    pathUpdateInterval: number;
    isChargingLunge: boolean;
    lungeChargeTimer: number;
    lungeTargetX: number;
    lungeTargetY: number;
    lungeCooldown: number;
    lungeCooldownDuration: number;
    lungeCount: number;
    maxLunges: number;
    projectileCooldown: number;
    pillarFlameCooldown: number;
    isCastingPillar: boolean;
    pillarCastTimer: number;
    warCryCooldown: number;
    attackInitiatedThisFrame: boolean;
    patrolConfig: PatrolConfig | null;
    patrolTargetX: number | null;
    patrolTargetY: number | null;
    patrolDirection: number;
    patrolReachedThreshold: number;
    patrolPhase: number;
    _chaseOffsetAngle: number;
    _chaseOffsetDist: number;
    roamCenterX: number | null;
    roamCenterY: number | null;
    roamRadius: number | null;
    idleBehavior: IdleBehavior | null;
    idleBehaviorConfig: Record<string, unknown> | null;
    _circularPatrolWaypointIndex: number;
    _guardTurnAngle: number;
    staminaExhausted: boolean;

    constructor(detectionRange: number, attackRange: number, patrolConfig: PatrolConfig | null = null) {
        this.detectionRange = detectionRange;
        this.attackRange = attackRange;
        this.state = 'idle'; // idle, chase, attack, patrol, lunge, backOff
        this.idleTimer = 0;
        this.wanderTargetX = 0;
        this.wanderTargetY = 0;
        this.pathUpdateTimer = Utils.randomInt(0, 29); // Stagger so pack doesn't all recalc path the same frame
        this.pathUpdateInterval = 30;
        this.entity = null;
        this.enemyType = null; // Will be set by EnemyManager
        
        // Lunge attack properties
        this.isChargingLunge = false;
        this.lungeChargeTimer = 0;
        this.lungeTargetX = 0;
        this.lungeTargetY = 0;
        this.lungeCooldown = 0; // Cooldown for lunge attacks (separate from normal attack cooldown)
        this.lungeCooldownDuration = 3.0; // 3 seconds cooldown
        this.lungeCount = 0; // Track number of lunges performed
        this.maxLunges = 2; // Number of lunges allowed before cooldown
        
        // Projectile attack properties
        this.projectileCooldown = 0;

        // Demon pillar-of-flame cast
        this.pillarFlameCooldown = 0;
        this.isCastingPillar = false;
        this.pillarCastTimer = 0;

        // Goblin Chieftain war cry (buff nearby goblins)
        this.warCryCooldown = 0;
        
        // Attack initiation tracking (prevents multiple attack calls in same frame)
        this.attackInitiatedThisFrame = false;
        
        // Patrol behavior
        this.patrolConfig = patrolConfig; // { startX, startY, endX, endY, distance }
        this.patrolTargetX = null;
        this.patrolTargetY = null;
        this.patrolDirection = 1; // 1 = going to end, -1 = going to start
        this.patrolReachedThreshold = 10; // Distance threshold to consider reached
        this.patrolPhase = Math.random(); // 0..1: position along segment so each enemy starts at a different point

        // Chase path variation: each enemy paths to a different point near the player so they don't all take the same route
        this._chaseOffsetAngle = Math.random() * Math.PI * 2;
        this._chaseOffsetDist = 35 + Math.random() * 45; // 35..80 px from player center

        // Roam area: when set, idle wander picks targets inside this circle (scene tile / pack area)
        this.roamCenterX = null;
        this.roamCenterY = null;
        this.roamRadius = null;

        // Idle behavior: 'patrol' | 'guard' | 'wander' | 'loiter' | 'sleep' | 'circularPatrol' | 'packFollow'
        // Set by spawn; default inferred from patrolConfig (patrol) or wander (wander)
        this.idleBehavior = null;
        this.idleBehaviorConfig = null;
        this._circularPatrolWaypointIndex = 0;
        this._guardTurnAngle = 0;

        // Stamina back-off: goblins and bandits back off when exhausted until 50% recovered
        this.staminaExhausted = false;
    }

    update(deltaTime: number, systems?: SystemsMap): void {
        const transform = this.entity.getComponent(Transform);
        const movement = this.entity.getComponent(Movement);
        const combat = this.entity.getComponent(Combat);
        const health = this.entity.getComponent(Health);
        
        if (!transform || !movement) return;
        if (health && health.isDead) return;

        const statusEffects = this.entity.getComponent(StatusEffects);
        if (statusEffects && statusEffects.isStunned) return;
        
        // Reset attack initiation flag at start of each frame
        this.attackInitiatedThisFrame = false;

        // Get player
        const entityManager = systems ? systems.get('entities') : null;
        const player = entityManager ? entityManager.get('player') : null;
        if (!player) return;

        const playerTransform = player.getComponent(Transform);
        if (!playerTransform) return;

        // Don't perform AI actions while being knocked back
        if (movement && movement.isKnockedBack) {
            return;
        }

        // Update lunge cooldown
        if (this.lungeCooldown > 0) {
            this.lungeCooldown = Math.max(0, this.lungeCooldown - deltaTime);
            // Reset lunge count when cooldown expires
            if (this.lungeCooldown === 0 && this.lungeCount > 0) {
                this.lungeCount = 0;
            }
        }
        
        // Update projectile cooldown
        if (this.projectileCooldown > 0) {
            this.projectileCooldown = Math.max(0, this.projectileCooldown - deltaTime);
        }

        if (this.pillarFlameCooldown > 0) {
            this.pillarFlameCooldown = Math.max(0, this.pillarFlameCooldown - deltaTime);
        }

        if (this.warCryCooldown > 0) {
            this.warCryCooldown = Math.max(0, this.warCryCooldown - deltaTime);
        }

        // Calculate distance to player
        const distToPlayer = Utils.distance(
            transform.x, transform.y,
            playerTransform.x, playerTransform.y
        );
        const effectiveDetectionRange = this.detectionRange * (statusEffects && statusEffects.packDetectionRangeMultiplier != null ? statusEffects.packDetectionRangeMultiplier : 1);

        // Stamina: mark exhausted when stamina is depleted (goblin, bandit)
        const stamina = this.entity.getComponent(Stamina);
        if ((this.enemyType === 'goblin' || this.enemyType === 'bandit') && stamina && stamina.percent <= 0.1) {
            this.staminaExhausted = true;
        }

        // Get enemy config once (used for lunge, projectile, and pillar checks)
        const enemyConfig = this.enemyType ? GameConfig.enemy.types[this.enemyType] : null;
        const pillarConfig = this.enemyType === 'greaterDemon' && enemyConfig && enemyConfig.pillarFlame ? enemyConfig.pillarFlame : null;

        // Goblin Chieftain war cry: buff nearby goblins when in chase range and not attacking
        const warCryConfig = this.enemyType === 'goblinChieftain' && enemyConfig && enemyConfig.warCry ? enemyConfig.warCry : null;
        if (warCryConfig && warCryConfig.enabled && this.warCryCooldown === 0 && !combat.isAttacking) {
            const inChaseRange = distToPlayer < effectiveDetectionRange && distToPlayer > this.attackRange;
            if (inChaseRange) {
                const enemyManager = systems ? systems.get('enemies') : null;
                if (enemyManager && enemyManager.enemies) {
                    const radius = warCryConfig.radius || 180;
                    let buffedAny = false;
                    for (const other of enemyManager.enemies) {
                        if (other === this.entity) continue;
                        const otherAI = other.getComponent(AI);
                        const otherHealth = other.getComponent(Health);
                        const otherTransform = other.getComponent(Transform);
                        const otherStatus = other.getComponent(StatusEffects);
                        if (!otherAI || otherAI.enemyType !== 'goblin' || !otherHealth || otherHealth.isDead || !otherTransform || !otherStatus) continue;
                        const dist = Utils.distance(transform.x, transform.y, otherTransform.x, otherTransform.y);
                        if (dist <= radius) {
                            otherStatus.applyWarCryBuff(
                                warCryConfig.buffDuration || 5,
                                warCryConfig.speedMultiplier || 1.2,
                                warCryConfig.damageMultiplier || 1.2
                            );
                            buffedAny = true;
                        }
                    }
                    if (buffedAny) this.warCryCooldown = warCryConfig.cooldown || 12;
                }
            }
        }
        
        // Check for lunge attack (goblin and lesser demon)
        const isGoblin = this.enemyType === 'goblin';
        const hasLunge = enemyConfig && enemyConfig.lunge && enemyConfig.lunge.enabled;
        const lungeConfig = hasLunge && enemyConfig.lunge ? enemyConfig.lunge : null;
        // Can lunge if: lunge enabled in config, not on cooldown, haven't used all lunges, and not already charging
        const canLunge = hasLunge && lungeConfig && combat && 
                        this.lungeCooldown === 0 && 
                        this.lungeCount < this.maxLunges && 
                        !this.isChargingLunge;

        // AI State machine
        // Handle demon pillar-of-flame casting (pillarConfig already defined above)
        if (this.isCastingPillar && pillarConfig) {
            this.state = 'attack';
            movement.stop();
            this.pillarCastTimer -= deltaTime;
            const dx = playerTransform.x - transform.x;
            const dy = playerTransform.y - transform.y;
            if (dx !== 0 || dy !== 0) movement.facingAngle = Math.atan2(dy, dx);
            if (this.pillarCastTimer <= 0) {
                this.isCastingPillar = false;
                const hazardManager = systems ? systems.get('hazards') : null;
                if (hazardManager && hazardManager.createPillar) {
                    // Cast pillar near player, not directly on them (random offset of 30-80 pixels)
                    const offsetDistance = Utils.random(30, 80);
                    const offsetAngle = Math.random() * Math.PI * 2;
                    const pillarX = playerTransform.x + Math.cos(offsetAngle) * offsetDistance;
                    const pillarY = playerTransform.y + Math.sin(offsetAngle) * offsetDistance;
                    hazardManager.createPillar(pillarX, pillarY, pillarConfig);
                }
                this.pillarFlameCooldown = pillarConfig.cooldown;
            }
        }
        // Handle lunge charging
        else if (this.isChargingLunge) {
            this.state = 'lunge';
            movement.stop();
            this.lungeChargeTimer -= deltaTime;
            
            // Update target to player's current position (track player during charge)
            this.lungeTargetX = playerTransform.x;
            this.lungeTargetY = playerTransform.y;
            
            // Face the player during charge
            const dx = this.lungeTargetX - transform.x;
            const dy = this.lungeTargetY - transform.y;
            if (dx !== 0 || dy !== 0) {
                movement.facingAngle = Math.atan2(dy, dx);
            }
            
            // When charge completes, start lunge (lesser demon and any type with lunge config)
            if (this.lungeChargeTimer <= 0 && lungeConfig) {
                this.isChargingLunge = false;
                // Increment lunge count
                this.lungeCount++;
                // Start lunge attack (movement + combat handler)
                if (combat.enemyAttackHandler && combat.enemyAttackHandler.startLunge) {
                    combat.enemyAttackHandler.startLunge(this.lungeTargetX, this.lungeTargetY, lungeConfig);
                }
                // Start lunge movement
                movement.startLunge(this.lungeTargetX, this.lungeTargetY, lungeConfig);
                
                // If we've used all lunges, set cooldown (will be set again when lunge ends, but set it here too in case lunge is interrupted)
                if (this.lungeCount >= this.maxLunges) {
                    this.lungeCooldown = this.lungeCooldownDuration;
                }
            }
        }
        // Check if should start charging lunge
        else if (canLunge && distToPlayer <= lungeConfig.chargeRange && distToPlayer > this.attackRange) {
            // Goblin: 50% chance to lunge twice this cycle, 50% once (roll at start of cycle)
            if (isGoblin && this.lungeCount === 0) {
                this.maxLunges = Math.random() < 0.5 ? 1 : 2;
            }
            this.isChargingLunge = true;
            this.lungeChargeTimer = lungeConfig.chargeTime;
            this.lungeTargetX = playerTransform.x;
            this.lungeTargetY = playerTransform.y;
            this.state = 'lunge';
        }
        // Check for projectile attack (ranged enemies like skeleton)
        const projectileConfig = enemyConfig && enemyConfig.projectile ? enemyConfig.projectile : null;
        const canShootProjectile = projectileConfig && projectileConfig.enabled && 
                                   this.projectileCooldown === 0 && 
                                   distToPlayer <= projectileConfig.range && 
                                   distToPlayer > this.attackRange;
        
        if (canShootProjectile) {
            // Shoot projectile at player
            const projectileManager = systems ? systems.get('projectiles') : null;
            if (projectileManager) {
                const angle = Utils.angleTo(transform.x, transform.y, playerTransform.x, playerTransform.y);
                projectileManager.createProjectile(
                    transform.x,
                    transform.y,
                    angle,
                    projectileConfig.speed,
                    projectileConfig.damage,
                    projectileConfig.range,
                    this.entity,
                    'enemy',
                    projectileConfig.stunBuildup ?? 0
                );
                this.projectileCooldown = projectileConfig.cooldown;
                this.state = 'attack';
            }
        }
        // Demon: optionally start pillar-of-flame (prioritize melee; occasionally cast at melee or at medium range)
        if (pillarConfig && this.pillarFlameCooldown === 0 && !this.isCastingPillar && !combat.isAttacking) {
            const inMeleeRange = distToPlayer < this.attackRange;
            const inPillarRange = distToPlayer <= pillarConfig.pillarRange && distToPlayer > this.attackRange;
            const canClaw = combat && combat.enemyAttackHandler && combat.enemyAttackHandler.canAttack && combat.enemyAttackHandler.canAttack();
            if (inPillarRange && Math.random() < 0.2) {
                // 20% chance when in range so pillars don't spam
                this.isCastingPillar = true;
                this.pillarCastTimer = pillarConfig.castDelay;
                this.attackInitiatedThisFrame = true;
            } else if (inMeleeRange && canClaw && !this.attackInitiatedThisFrame && Math.random() < 0.05) {
                // Rare chance to cast from melee instead of claw
                this.isCastingPillar = true;
                this.pillarCastTimer = pillarConfig.castDelay;
                this.attackInitiatedThisFrame = true;
            }
        }
        // Goblin: weapon dash attack (dagger leap) when player in dash range, on cooldown
        const canMelee = combat && combat.enemyAttackHandler && combat.enemyAttackHandler.canMeleeAttack && combat.enemyAttackHandler.canMeleeAttack();
        const isSkeleton = this.enemyType === 'skeleton';
        const meleeRange = (combat && combat.attackRange != null && combat.attackRange > 0) ? combat.attackRange : this.attackRange;
        const DASH_ATTACK_RANGE_MAX = 180;

        if (isGoblin && !this.isCastingPillar && canMelee && !combat.isAttacking && !combat.isWindingUp && this.lungeCooldown === 0 && !this.attackInitiatedThisFrame) {
            const handler = combat.enemyAttackHandler;
            const canDashAttack = handler && (handler as { hasLunge?: () => boolean }).hasLunge?.() && handler.canAttack && handler.canAttack();
            if (canDashAttack && distToPlayer > meleeRange && distToPlayer <= DASH_ATTACK_RANGE_MAX) {
                const attackResult = combat.attack(playerTransform.x, playerTransform.y, 0, { useDashAttack: true });
                if (attackResult) {
                    this.attackInitiatedThisFrame = true;
                    this.lungeCooldown = this.lungeCooldownDuration;
                    this.state = 'attack';
                }
            }
        }

        // Only consider starting a new melee attack when not already attacking or winding up (complete full attack first)
        if (!isSkeleton && !this.isCastingPillar && canMelee && !combat.isAttacking && !combat.isWindingUp) {
            const canAttack = combat && !this.attackInitiatedThisFrame && combat.enemyAttackHandler && combat.enemyAttackHandler.canAttack && combat.enemyAttackHandler.canAttack();

            if (distToPlayer < meleeRange && canAttack && !combat.isLunging) {
                this.state = 'attack';
                movement.stop();
                // comboAndCharge (e.g. bandit mace): 0 = light combo, else charged heavy; when already in combo (stage > 0) keep chaining light
                let chargeDuration = 0;
                const handler = combat.enemyAttackHandler;
                if (handler && handler.behaviorType === 'comboAndCharge' && handler.weapon) {
                    const inCombo = (handler.comboStage ?? 0) > 0;
                    if (!inCombo) {
                        const w = handler.weapon;
                        const chargeConfig = w.chargeAttack;
                        if (chargeConfig && chargeConfig.minChargeTime != null) {
                            const roll = Math.random();
                            if (roll < 0.35) {
                                chargeDuration = chargeConfig.minChargeTime + Math.random() * ((chargeConfig.maxChargeTime || 2) - chargeConfig.minChargeTime) * 0.6;
                            }
                        }
                    }
                }
                const attackResult = combat.attack(playerTransform.x, playerTransform.y, chargeDuration);
                if (attackResult) {
                    this.attackInitiatedThisFrame = true;
                }
            }
        }
        
        if (combat && (combat.isAttacking || combat.isWindingUp || combat.isLunging)) {
            // During attack, wind-up, or lunge, keep stopped (unless attack-dashing)
            this.state = combat.isLunging ? 'lunge' : 'attack';
            const isAttackDashing = (movement as { isAttackDashing?: boolean }).isAttackDashing === true;
            if (combat.isLunging) {
                // Movement is handled by lunge
            } else if (isAttackDashing) {
                // Weapon dash attack: movement handles dash, don't stop
            } else {
                movement.stop();
                // During wind-up: face the player (aim). During slash: keep facing locked so the swipe commits like the player's dagger.
                if (combat.isWindingUp) {
                    const dx = playerTransform.x - transform.x;
                    const dy = playerTransform.y - transform.y;
                    if (dx !== 0 || dy !== 0) {
                        movement.facingAngle = Math.atan2(dy, dx);
                    }
                }
            }
        } else if (this.staminaExhausted && (this.enemyType === 'goblin' || this.enemyType === 'bandit') && stamina && distToPlayer < effectiveDetectionRange) {
            // Back off until 50% stamina recovered
            this.state = 'backOff';
            if (stamina.percent >= 0.5) {
                this.staminaExhausted = false;
            } else {
                this.backOffFromPlayer(playerTransform, movement, systems);
            }
        } else if (this.idleBehavior === 'sleep' && this.idleBehaviorConfig && this.idleBehaviorConfig.wakeRadius != null && distToPlayer > this.idleBehaviorConfig.wakeRadius) {
            this.state = 'sleep';
            this.sleep(transform, movement);
        } else if (distToPlayer < effectiveDetectionRange) {
            this.state = 'chase';
            this.chasePlayer(playerTransform, movement, systems);
        } else {
            this.runIdleBehavior(transform, movement, systems);
        }
    }

    runIdleBehavior(transform, movement, systems) {
        const behavior = this.idleBehavior || (this.patrolConfig ? 'patrol' : 'wander');
        const config = this.idleBehaviorConfig;
        if (behavior === 'patrol' && this.patrolConfig) {
            this.state = 'patrol';
            this.patrol(transform, movement, systems);
        } else if (behavior === 'guard' && config && config.type === 'guard') {
            this.state = 'guard';
            this.guard(transform, movement, systems);
        } else if (behavior === 'circularPatrol' && config && config.type === 'circularPatrol') {
            this.state = 'circularPatrol';
            this.circularPatrol(transform, movement, systems);
        } else if (behavior === 'packFollow' && config && config.type === 'packFollow') {
            this.state = 'packFollow';
            this.packFollow(transform, movement, systems);
        } else if (behavior === 'sleep' && config && config.type === 'sleep') {
            this.state = 'sleep';
            this.sleep(transform, movement);
        } else if (behavior === 'wander' || (config && config.type === 'wander')) {
            this.state = 'idle';
            this.wander(transform, movement, systems);
        } else {
            this.state = 'idle';
            this.wander(transform, movement, systems);
        }
    }

    chasePlayer(playerTransform, movement, systems) {
        this.pathUpdateTimer--;
        
        const pathfinding = systems.get('pathfinding');
        const transform = this.entity.getComponent(Transform);
        const obstacleManager = systems.get('obstacles');
        
        if (pathfinding && movement) {
            if (!movement.hasPath() || this.pathUpdateTimer <= 0) {
                const destX = playerTransform.x + Math.cos(this._chaseOffsetAngle) * this._chaseOffsetDist;
                const destY = playerTransform.y + Math.sin(this._chaseOffsetAngle) * this._chaseOffsetDist;
                const path = pathfinding.findPath(
                    transform.x, transform.y,
                    destX, destY,
                    transform.width, transform.height
                );
                if (path && path.length > 0) {
                    movement.followPath(path);
                } else {
                    // Pathfinding failed - try to find a nearby valid position and move towards player
                    this.handlePathfindingFailure(transform, playerTransform, movement, obstacleManager);
                }
                this.pathUpdateTimer = this.pathUpdateInterval;
            }
        } else if (movement) {
            const destX = playerTransform.x + Math.cos(this._chaseOffsetAngle) * this._chaseOffsetDist;
            const destY = playerTransform.y + Math.sin(this._chaseOffsetAngle) * this._chaseOffsetDist;
            const dx = destX - transform.x;
            const dy = destY - transform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                movement.setVelocity(dx, dy);
            }
        }
    }

    /** Move away from player (goblin/bandit back off when stamina exhausted until 50% recovered). */
    backOffFromPlayer(playerTransform, movement, systems) {
        const transform = this.entity.getComponent(Transform);
        if (!transform || !movement) return;
        const dx = transform.x - playerTransform.x;
        const dy = transform.y - playerTransform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1) {
            movement.stop();
            return;
        }
        if (movement.cancelPath) movement.cancelPath();
        movement.setVelocity(dx, dy);
    }

    handlePathfindingFailure(transform, playerTransform, movement, obstacleManager) {
        const destX = playerTransform.x + Math.cos(this._chaseOffsetAngle) * this._chaseOffsetDist;
        const destY = playerTransform.y + Math.sin(this._chaseOffsetAngle) * this._chaseOffsetDist;
        const dx = destX - transform.x;
        const dy = destY - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 5) {
            movement.stop();
            return;
        }
        if (!obstacleManager) {
            movement.setVelocity(dx, dy);
            return;
        }
        movement.setVelocity(dx, dy);
    }

    wander(transform, movement, systems) {
        this.idleTimer--;

        if (this.idleTimer <= 0) {
            this.idleTimer = Utils.randomInt(60, 180);
            const worldConfig = GameConfig.world;
            const config = this.idleBehaviorConfig;
            const useWanderConfig = config && config.type === 'wander' && typeof config.centerX === 'number' && typeof config.centerY === 'number' && typeof config.radius === 'number';
            const centerX = useWanderConfig ? config.centerX as number : this.roamCenterX;
            const centerY = useWanderConfig ? config.centerY as number : this.roamCenterY;
            const radius = useWanderConfig ? config.radius as number : this.roamRadius;

            if (centerX != null && centerY != null && radius != null && radius > 0) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius;
                this.wanderTargetX = centerX + Math.cos(angle) * dist;
                this.wanderTargetY = centerY + Math.sin(angle) * dist;
            } else {
                const wanderRadius = 40;
                this.wanderTargetX = transform.x + Utils.random(-wanderRadius, wanderRadius);
                this.wanderTargetY = transform.y + Utils.random(-wanderRadius, wanderRadius);
            }
            this.wanderTargetX = Utils.clamp(this.wanderTargetX, 0, worldConfig.width);
            this.wanderTargetY = Utils.clamp(this.wanderTargetY, 0, worldConfig.height);
            
            const pathfinding = systems.get('pathfinding');
            if (pathfinding && movement) {
                const path = pathfinding.findPath(
                    transform.x, transform.y,
                    this.wanderTargetX, this.wanderTargetY,
                    transform.width, transform.height
                );
                if (path && path.length > 0) {
                    movement.followPath(path);
                } else {
                    // Pathfinding failed, just set target and let movement handle it
                    movement.setTarget(this.wanderTargetX, this.wanderTargetY);
                }
            }
        }

        if (movement && !movement.hasPath()) {
            const dx = this.wanderTargetX - transform.x;
            const dy = this.wanderTargetY - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 5) {
                const originalSpeed = movement.speed;
                movement.speed = originalSpeed * 0.5; // Slower when wandering
                movement.setVelocity(dx, dy);
                movement.speed = originalSpeed; // Restore speed
            } else {
                movement.stop();
            }
        }
    }

    patrol(transform, movement, systems) {
        if (!this.patrolConfig) return;

        // Initialize patrol targets if not set: spread along segment so enemies don't march in lockstep
        if (this.patrolTargetX === null || this.patrolTargetY === null) {
            const sx = this.patrolConfig.startX;
            const sy = this.patrolConfig.startY;
            const ex = this.patrolConfig.endX;
            const ey = this.patrolConfig.endY;
            this.patrolTargetX = sx + (ex - sx) * this.patrolPhase;
            this.patrolTargetY = sy + (ey - sy) * this.patrolPhase;
            this.patrolDirection = 1; // head towards end first
        }

        // Calculate distance to current patrol target
        const dx = this.patrolTargetX - transform.x;
        const dy = this.patrolTargetY - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if reached the current patrol target
        if (dist < this.patrolReachedThreshold) {
            // Switch direction and set new target
            this.patrolDirection *= -1;
            if (this.patrolDirection === 1) {
                // Going to end point
                this.patrolTargetX = this.patrolConfig.endX;
                this.patrolTargetY = this.patrolConfig.endY;
            } else {
                // Going to start point
                this.patrolTargetX = this.patrolConfig.startX;
                this.patrolTargetY = this.patrolConfig.startY;
            }
        }

        // Move towards current patrol target
        if (movement) {
            const newDx = this.patrolTargetX - transform.x;
            const newDy = this.patrolTargetY - transform.y;
            const newDist = Math.sqrt(newDx * newDx + newDy * newDy);

            if (newDist > this.patrolReachedThreshold) {
                movement.setVelocity(newDx, newDy);
            } else {
                movement.stop();
            }
        }
    }

    guard(transform, movement, systems) {
        const config = this.idleBehaviorConfig;
        if (!config || config.type !== 'guard') return;
        const cx = config.centerX;
        const cy = config.centerY;
        const radius = config.radius != null ? config.radius : 60;
        const dist = Math.sqrt((transform.x - cx) ** 2 + (transform.y - cy) ** 2);
        if (dist > radius && movement) {
            const dx = cx - transform.x;
            const dy = cy - transform.y;
            movement.setVelocity(dx, dy);
        } else {
            if (movement) movement.stop();
            if (this._guardTurnAngle == null && config.faceAngle != null) this._guardTurnAngle = config.faceAngle;
            if (this._guardTurnAngle == null && movement) this._guardTurnAngle = movement.facingAngle;
            if (config.turnSpeed && config.turnSpeed !== 0) {
                this._guardTurnAngle += config.turnSpeed * (1/60);
                if (movement) movement.facingAngle = this._guardTurnAngle;
            } else if (config.faceAngle != null && movement) {
                movement.facingAngle = config.faceAngle;
            }
        }
    }

    sleep(transform, movement, systems) {
        if (movement) movement.stop();
    }

    circularPatrol(transform, movement, systems) {
        const config = this.idleBehaviorConfig;
        if (!config || config.type !== 'circularPatrol' || !config.waypoints || !config.waypoints.length) return;
        const waypoints = config.waypoints;
        const idx = this._circularPatrolWaypointIndex != null ? this._circularPatrolWaypointIndex : 0;
        const threshold = config.reachedThreshold != null ? config.reachedThreshold : 12;
        const wx = waypoints[idx].x;
        const wy = waypoints[idx].y;
        const dx = wx - transform.x;
        const dy = wy - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < threshold) {
            this._circularPatrolWaypointIndex = (idx + 1) % waypoints.length;
        }
        if (movement && dist >= threshold) {
            movement.setVelocity(dx, dy);
        } else if (movement && dist < threshold) {
            movement.stop();
        }
    }

    packFollow(transform, movement, systems) {
        const config = this.idleBehaviorConfig;
        if (!config || config.type !== 'packFollow') return;
        const cx = config.centerX;
        const cy = config.centerY;
        const followRadius = config.followRadius != null ? config.followRadius : 50;
        const angle = config.offsetAngle != null ? config.offsetAngle : 0;
        const targetX = cx + Math.cos(angle) * followRadius * 0.6;
        const targetY = cy + Math.sin(angle) * followRadius * 0.6;
        const dx = targetX - transform.x;
        const dy = targetY - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (movement) {
            if (dist > 8) {
                movement.setVelocity(dx, dy);
            } else {
                movement.stop();
            }
        }
    }
}

declare global {
    interface Window {
        AI?: typeof AI;
    }
}
if (typeof window !== 'undefined') {
    (window as Window).AI = AI;
}
