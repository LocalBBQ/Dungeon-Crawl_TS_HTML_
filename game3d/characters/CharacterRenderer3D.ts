// Drives one CharacterRig per live entity, plus its weapon, off-hand and floating bars.
//
// Everything read here comes from the same components the 2D renderers read, so the 3D characters
// react to combat, status effects and equipment without the simulation knowing a thing about them.
import * as THREE from 'three';
import { Transform } from '../../game/components/Transform.js';
import { Movement } from '../../game/components/Movement.js';
import { Combat } from '../../game/components/Combat.js';
import { Health } from '../../game/components/Health.js';
import { Renderable } from '../../game/components/Renderable.js';
import { Stamina } from '../../game/components/Stamina.js';
import { StatusEffects } from '../../game/components/StatusEffects.js';
import { AI } from '../../game/components/AI.js';
import { PlayerHealing } from '../../game/components/PlayerHealing.js';
import { Rally } from '../../game/components/Rally.js';
import { ScenePool } from '../core/ScenePool.js';
import { CharacterRig, type CharacterPose } from './CharacterRig.js';
import { baseShapeFor, profileFor, resolveBodyColor } from './CharacterProfiles.js';
import {
    createOffhandMesh,
    createWeaponMesh,
    describeOffhand,
    describeWeapon,
    type WeaponDescriptor,
} from './WeaponMeshFactory.js';
import { CanvasBillboard, barsStackHeight, drawEntityBars, type EntityBarsState } from '../fx/Billboards.js';

export interface EntityLike {
    id: string;
    active: boolean;
    getComponent<T>(ctor: new (...args: never[]) => T): T | null;
}

interface RigRecord {
    group: THREE.Group;
    rig: CharacterRig;
    bars: CanvasBillboard;
    weaponKey: string;
    offhandKey: string;
    weaponMesh: THREE.Object3D | null;
    offhandMesh: THREE.Object3D | null;
    shapeKey: string;
    lastX: number;
    lastZ: number;
}

/** Enemy variant suffixes map to the star tier shown above the health bar. */
function tierOf(enemyType: string | null | undefined): number {
    if (!enemyType) return 0;
    if (enemyType.endsWith('Elite')) return 2;
    if (enemyType.endsWith('Veteran') || enemyType.endsWith('Alpha') || enemyType.endsWith('Brute')) return 1;
    return 0;
}

export class CharacterRenderer3D {
    private readonly group = new THREE.Group();
    private readonly pool: ScenePool<THREE.Group>;
    private readonly records = new Map<string, RigRecord>();
    /** World position of the player this frame, used to drive the follow light. */
    playerPosition: THREE.Vector3 | null = null;

    constructor(parent: THREE.Object3D) {
        this.group.name = 'characters';
        parent.add(this.group);
        this.pool = new ScenePool<THREE.Group>(this.group, (object) => {
            const record = this.records.get(object.name);
            record?.rig.dispose();
            record?.bars.dispose();
            this.records.delete(object.name);
        });
    }

    sync(
        entities: EntityLike[] | null | undefined,
        settings: Record<string, unknown>,
        playerClass: string | undefined,
        time: number,
        delta: number
    ): void {
        this.pool.begin();
        this.playerPosition = null;
        if (!entities) {
            this.pool.end();
            return;
        }

        for (const entity of entities) {
            if (!entity.active) continue;
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            if (!transform || !renderable) continue;
            if (renderable.type !== 'player' && renderable.type !== 'enemy') continue;
            const health = entity.getComponent(Health);
            if (health?.isDead) continue;

            const isPlayer = renderable.type === 'player';
            const ai = entity.getComponent(AI);
            const shape = isPlayer ? (playerClass ?? 'knight') : baseShapeFor(ai?.enemyType);
            const record = this.acquire(entity.id, shape, transform.width, renderable.color);

            this.updateTransform(record, entity, transform, isPlayer, time, delta);
            this.updateEquipment(record, entity, transform);
            this.updateBars(record, entity, transform, settings, isPlayer, ai?.enemyType);

            if (isPlayer) {
                this.playerPosition = record.group.position.clone();
            }
        }

        this.pool.end();
    }

    private acquire(id: string, shape: string, hitboxWidth: number, color: string | undefined): RigRecord {
        const existing = this.records.get(id);
        // Rebuild when the creature changes shape or resizes noticeably (class swap, tier respawn).
        const shapeKey = `${shape}:${Math.round(hitboxWidth)}`;
        if (existing && existing.shapeKey === shapeKey) {
            this.pool.acquire(id, () => existing.group);
            return existing;
        }
        if (existing) {
            this.group.remove(existing.group);
            existing.rig.dispose();
            existing.bars.dispose();
            this.records.delete(id);
        }

        const group = this.pool.acquire(id, () => {
            const container = new THREE.Group();
            container.name = id;
            return container;
        });
        // A reused pool slot may still hold the previous rig.
        group.clear();

        const profile = profileFor(shape);
        const rig = new CharacterRig(profile, hitboxWidth, resolveBodyColor(shape, color));
        group.add(rig.root);

        const bars = new CanvasBillboard(44, 30);
        group.add(bars.sprite);

        const record: RigRecord = {
            group,
            rig,
            bars,
            weaponKey: '',
            offhandKey: '',
            weaponMesh: null,
            offhandMesh: null,
            shapeKey,
            lastX: 0,
            lastZ: 0,
        };
        this.records.set(id, record);
        return record;
    }

    private updateTransform(
        record: RigRecord,
        entity: EntityLike,
        transform: Transform,
        isPlayer: boolean,
        time: number,
        delta: number
    ): void {
        const movement = entity.getComponent(Movement);
        const combat = entity.getComponent(Combat);
        const ai = entity.getComponent(AI);
        const status = entity.getComponent(StatusEffects);
        const healing = entity.getComponent(PlayerHealing);
        const health = entity.getComponent(Health);

        record.group.position.set(transform.x, 0, transform.y);
        record.rig.setFacing(movement ? movement.facingAngle : 0);

        const speed = movement ? Math.hypot(movement.velocityX, movement.velocityY) : 0;
        const weapon = combat?.weapon as { isRanged?: boolean; visual?: string; name?: string } | undefined;
        const isCharging = !!combat?.isWindingUp || !!ai?.isChargingLunge;
        const chargeProgress = ai?.isChargingLunge
            ? 1 - Math.max(0, ai.lungeChargeTimer) / Math.max(0.001, ai.lungeChargeTimer + 0.001)
            : (combat?.windUpProgress ?? 0);

        // An attack reads as a slam when it is a circular/AOE strike or a heavy club swing.
        const overheadSlam = !!combat?.currentAttackIsCircular || !!combat?.currentAttackAoeInFront;
        const swingProgress = combat
            ? combat.enemySlashSweepProgress > 0
                ? combat.enemySlashSweepProgress
                : combat.attackDuration > 0
                  ? Math.min(1, combat.attackTimer / combat.attackDuration)
                  : 0
            : 0;

        const pose: CharacterPose = {
            speed,
            time,
            delta,
            isAttacking: !!combat?.isAttacking && !combat?.isWindingUp,
            isWindingUp: isCharging,
            swingProgress,
            chargeProgress,
            isBlocking: !!combat?.isBlocking,
            isDodging: !!(movement as (Movement & { isDodging?: boolean }) | null)?.isDodging,
            isLunging: !!combat?.isLunging,
            isStunned: !!status && status.stunDurationPercentRemaining > 0,
            isHealing: !!healing?.isHealing,
            isResting: !!(entity as EntityLike & { isResting?: boolean }).isResting,
            overheadSlam,
            isAiming: !!weapon?.isRanged && !!combat?.isAttacking,
            hitFlash: health?.wasJustHit ? 1 : 0,
        };
        record.rig.update(pose);

        // Colour cues: the 2D renderer reddens enemies during lunges and wind-ups.
        if (!isPlayer && ai?.isChargingLunge) {
            record.rig.applyTint(new THREE.Color(0xff3200), 0.55);
        } else if (combat?.isLunging) {
            record.rig.applyTint(new THREE.Color(0xff0000), 0.7);
        } else if (combat?.isWindingUp) {
            record.rig.applyTint(new THREE.Color(0xff5a20), 0.25 + (combat.windUpProgress ?? 0) * 0.45);
        } else if (health?.wasJustHit) {
            record.rig.applyTint(new THREE.Color(0xffffff), 0.5);
        } else {
            record.rig.applyTint(null, 0);
        }

        const dodging = !!(movement as (Movement & { isDodging?: boolean }) | null)?.isDodging;
        record.rig.setOpacity(dodging ? 0.6 : 1);

        // Airborne knockback lifts the character off the ground.
        if (status && status.airborneUntil > Date.now()) {
            const remaining = (status.airborneUntil - Date.now()) / 1000;
            record.group.position.y = Math.max(0, Math.sin(Math.min(1, remaining * 3) * Math.PI) * transform.width * 0.6);
        } else {
            record.group.position.y = 0;
        }

        record.lastX = transform.x;
        record.lastZ = transform.y;
    }

    private updateEquipment(record: RigRecord, entity: EntityLike, transform: Transform): void {
        const combat = entity.getComponent(Combat);
        const scale = transform.width / 34.5;

        const weapon = combat?.weapon as
            | { key?: string; name?: string; visual?: string; isRanged?: boolean; isBow?: boolean; isStaff?: boolean; weaponLength?: number | null }
            | null
            | undefined;
        const descriptor: WeaponDescriptor = describeWeapon(
            weapon?.key,
            weapon?.name,
            weapon?.visual,
            { isRanged: weapon?.isRanged, isBow: weapon?.isBow, isStaff: weapon?.isStaff },
            weapon?.weaponLength
        );
        const healing = entity.getComponent(PlayerHealing);
        const hideWeapon = !!healing?.isHealing;
        const weaponKey = hideWeapon ? 'none' : `${descriptor.family}:${descriptor.color}:${Math.round(descriptor.length)}`;

        if (weaponKey !== record.weaponKey) {
            if (record.weaponMesh) {
                record.weaponMesh.removeFromParent();
                record.weaponMesh = null;
            }
            record.weaponKey = weaponKey;
            if (!hideWeapon) {
                const mesh = createWeaponMesh(descriptor, scale);
                if (mesh) {
                    record.rig.weaponAnchor.add(mesh);
                    record.weaponMesh = mesh;
                }
            }
        }

        const offhandWeapon = combat?.offhandWeapon as { key?: string; name?: string } | null | undefined;
        const offhand = describeOffhand(offhandWeapon?.key ?? offhandWeapon?.name);
        const offhandKey = `${offhand.family}:${offhand.color}`;
        if (offhandKey !== record.offhandKey) {
            if (record.offhandMesh) {
                record.offhandMesh.removeFromParent();
                record.offhandMesh = null;
            }
            record.offhandKey = offhandKey;
            const mesh = createOffhandMesh(offhand.family, offhand.color, scale);
            if (mesh) {
                record.rig.offhandAnchor.add(mesh);
                record.offhandMesh = mesh;
            }
        }
    }

    private updateBars(
        record: RigRecord,
        entity: EntityLike,
        transform: Transform,
        settings: Record<string, unknown>,
        isPlayer: boolean,
        enemyType: string | null | undefined
    ): void {
        const health = entity.getComponent(Health);
        const stamina = entity.getComponent(Stamina);
        const status = entity.getComponent(StatusEffects);
        const rally = entity.getComponent(Rally);

        const showHealth =
            (isPlayer && settings.showPlayerHealthBarAlways === true) ||
            (!isPlayer && settings.showEnemyHealthBars === true) ||
            (!!health && health.percent < 1);

        const state: EntityBarsState = {
            isPlayer,
            healthPercent: health ? health.percent : null,
            showHealth,
            staminaPercent: stamina ? stamina.percent : null,
            showStamina: !!stamina && (isPlayer || settings.showEnemyStaminaBars === true),
            stunMeterPercent: status?.stunMeterPercent ?? 0,
            showStunMeter: !isPlayer && !!status?.hasBeenStunnedOnce && (status?.stunMeterPercent ?? 0) > 0,
            stunDurationPercent: !isPlayer ? (status?.stunDurationPercentRemaining ?? 0) : 0,
            rallyFraction:
                isPlayer && rally && rally.rallyPool > 0 && health && health.maxHealth > 0
                    ? rally.rallyPool / health.maxHealth
                    : 0,
            tier: isPlayer ? 0 : tierOf(enemyType),
        };

        const anyVisible =
            state.showHealth || state.showStamina || state.showStunMeter || state.stunDurationPercent > 0 || state.tier > 0;
        record.bars.sprite.visible = anyVisible;
        if (!anyVisible) return;

        const stackHeight = barsStackHeight(state);
        record.bars.resize(48, Math.max(12, stackHeight));
        const signature = [
            state.isPlayer,
            state.showHealth ? (state.healthPercent ?? 0).toFixed(3) : 'x',
            state.showStamina ? (state.staminaPercent ?? 0).toFixed(3) : 'x',
            state.showStunMeter ? state.stunMeterPercent.toFixed(3) : 'x',
            state.stunDurationPercent.toFixed(3),
            state.rallyFraction.toFixed(3),
            state.tier,
        ].join('|');
        record.bars.drawIfChanged(signature, (ctx, width, height) => drawEntityBars(ctx, width, height, state));

        // Sit the bars just above the character's head.
        record.bars.sprite.position.set(0, record.rig.height + transform.width * 0.35 + stackHeight / 2, 0);
    }

    clear(): void {
        for (const record of this.records.values()) {
            record.rig.dispose();
            record.bars.dispose();
        }
        this.records.clear();
        this.pool.clear();
    }

    dispose(): void {
        this.clear();
        this.group.removeFromParent();
    }
}
