/**
 * Creates the player entity with all components and animation config from sprite manager.
 */
import { Entity } from '../entities/Entity.js';
import { Transform } from '../components/Transform.js';
import { Health } from '../components/Health.js';
import { StatusEffects } from '../components/StatusEffects.js';
import { Stamina } from '../components/Stamina.js';
import { PlayerHealing } from '../components/PlayerHealing.js';
import { PlayerMovement } from '../components/PlayerMovement.js';
import { Combat } from '../components/Combat.js';
import { Renderable } from '../components/Renderable.js';
import { Sprite } from '../components/Sprite.js';
import { Animation } from '../components/Animation.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { Utils } from '../utils/Utils.js';

export interface PlayerConfigLike {
    startX: number;
    startY: number;
    width: number;
    height: number;
    speed: number;
    maxHealth: number;
    maxStamina: number;
    staminaRegen: number;
    color: string;
}

export interface SpriteManagerLike {
    knightSheets?: Record<string, string>;
    getSpriteSheet?(key: string): { rows: number; cols: number; totalFrames?: number } | null;
}

export interface PlayerFactoryOptions {
    spriteManager: SpriteManagerLike;
    equippedWeaponKey: string;
    playerConfig: PlayerConfigLike;
}

export function createPlayer(
    overrideStart: { x: number; y: number } | null,
    options: PlayerFactoryOptions
): Entity {
    const { spriteManager, equippedWeaponKey, playerConfig: config } = options;
    const x = overrideStart ? overrideStart.x : config.startX;
    const y = overrideStart ? overrideStart.y : config.startY;
    const player = new Entity(x, y, 'player');

    const knightSheets = spriteManager.knightSheets || {};
    const defaultSheetKey = knightSheets.idle || knightSheets.walk || null;

    const animationConfig: {
        defaultSpriteSheetKey: string | null;
        defaultAnimation: string;
        animations: Record<string, unknown>;
    } = {
        defaultSpriteSheetKey: defaultSheetKey,
        defaultAnimation: 'idle',
        animations: {}
    };

    if (knightSheets.idle) {
        const idleSheet = spriteManager.getSpriteSheet?.(knightSheets.idle);
        if (idleSheet && (idleSheet as { type?: string }).type === 'multiDirFrames') {
            const frameCount = (idleSheet as { frameCount?: number }).frameCount ?? 6;
            animationConfig.animations.idle = {
                spriteSheetKey: knightSheets.idle,
                frames: Array.from({ length: frameCount }, (_, i) => i),
                frameDuration: 0.15,
                loop: true,
                useDirection: true,
                useMultiDirFrames: true
            };
        }
    }

    if (knightSheets.walk) {
        const walkSheet = spriteManager.getSpriteSheet?.(knightSheets.walk);
        if (walkSheet) {
            const framesPerDirection = walkSheet.cols;
            const walkFrames = Array.from({ length: framesPerDirection }, (_, i) => i);
            animationConfig.animations.walk = {
                spriteSheetKey: knightSheets.walk,
                frames: walkFrames,
                frameDuration: 0.1,
                loop: true,
                useDirection: true
            };
        }
    }

    if (knightSheets.run) {
        const runSheet = spriteManager.getSpriteSheet?.(knightSheets.run);
        if (runSheet) {
            const totalFrames = runSheet.totalFrames || (runSheet.rows * runSheet.cols);
            const runFrames = Array.from({ length: totalFrames }, (_, i) => i);
            animationConfig.animations.run = {
                spriteSheetKey: knightSheets.run,
                frames: runFrames,
                frameDuration: 0.08,
                loop: true
            };
        }
    }

    if (knightSheets.melee) {
        const meleeSheet = spriteManager.getSpriteSheet?.(knightSheets.melee);
        if (meleeSheet) {
            const is8DirSingleFrame = (meleeSheet.rows === 8 && meleeSheet.cols === 1) || (meleeSheet.rows === 1 && meleeSheet.cols === 8);
            const meleeUseDirectionAsColumn = meleeSheet.rows === 1 && meleeSheet.cols === 8;
            const meleeFrames = is8DirSingleFrame ? [0] : Array.from({ length: meleeSheet.totalFrames || (meleeSheet.rows * meleeSheet.cols) }, (_, i) => i);
            animationConfig.animations.melee = {
                spriteSheetKey: knightSheets.melee,
                frames: meleeFrames,
                frameDuration: 0.1,
                loop: false,
                useDirection: is8DirSingleFrame,
                useDirectionAsColumn: meleeUseDirectionAsColumn
            };
        }
    }

    if (knightSheets.melee2) {
        const melee2Sheet = spriteManager.getSpriteSheet?.(knightSheets.melee2);
        if (melee2Sheet) {
            const is8DirSingleFrame = (melee2Sheet.rows === 8 && melee2Sheet.cols === 1) || (melee2Sheet.rows === 1 && melee2Sheet.cols === 8);
            const melee2UseDirectionAsColumn = melee2Sheet.rows === 1 && melee2Sheet.cols === 8;
            const melee2Frames = is8DirSingleFrame ? [0] : Array.from({ length: melee2Sheet.totalFrames || (melee2Sheet.rows * melee2Sheet.cols) }, (_, i) => i);
            animationConfig.animations.melee2 = {
                spriteSheetKey: knightSheets.melee2,
                frames: melee2Frames,
                frameDuration: 0.1,
                loop: false,
                useDirection: is8DirSingleFrame,
                useDirectionAsColumn: melee2UseDirectionAsColumn
            };
        }
    }

    if (knightSheets.meleeChop) {
        const meleeChopSheet = spriteManager.getSpriteSheet?.(knightSheets.meleeChop);
        if (meleeChopSheet) {
            const is8DirSingleFrame = (meleeChopSheet.rows === 8 && meleeChopSheet.cols === 1) || (meleeChopSheet.rows === 1 && meleeChopSheet.cols === 8);
            const meleeChopUseDirectionAsColumn = meleeChopSheet.rows === 1 && meleeChopSheet.cols === 8;
            const meleeChopFrames = is8DirSingleFrame ? [0] : Array.from({ length: meleeChopSheet.totalFrames || (meleeChopSheet.rows * meleeChopSheet.cols) }, (_, i) => i);
            animationConfig.animations.meleeChop = {
                spriteSheetKey: knightSheets.meleeChop,
                frames: meleeChopFrames,
                frameDuration: 0.1,
                loop: false,
                useDirection: is8DirSingleFrame,
                useDirectionAsColumn: meleeChopUseDirectionAsColumn
            };
        }
    }

    if (knightSheets.meleeSpin) {
        const meleeSpinSheet = spriteManager.getSpriteSheet?.(knightSheets.meleeSpin);
        if (meleeSpinSheet) {
            const totalFrames = meleeSpinSheet.totalFrames || (meleeSpinSheet.rows * meleeSpinSheet.cols);
            const meleeSpinFrames = Array.from({ length: totalFrames }, (_, i) => i);
            animationConfig.animations.meleeSpin = {
                spriteSheetKey: knightSheets.meleeSpin,
                frames: meleeSpinFrames,
                frameDuration: 0.08,
                loop: false
            };
        }
    }

    if (knightSheets.block) {
        const blockSheet = spriteManager.getSpriteSheet?.(knightSheets.block);
        if (blockSheet) {
            const is8DirSingleFrame = (blockSheet.rows === 8 && blockSheet.cols === 1) || (blockSheet.rows === 1 && blockSheet.cols === 8);
            const blockUseDirectionAsColumn = blockSheet.rows === 1 && blockSheet.cols === 8;
            const blockFrames = is8DirSingleFrame ? [0] : Array.from({ length: blockSheet.totalFrames || (blockSheet.rows * blockSheet.cols) }, (_, i) => i);
            animationConfig.animations.block = {
                spriteSheetKey: knightSheets.block,
                frames: blockFrames,
                frameDuration: 0.15,
                loop: true,
                useDirection: is8DirSingleFrame,
                useDirectionAsColumn: blockUseDirectionAsColumn
            };
        }
    }

    if (knightSheets.roll) {
        const rollSheet = spriteManager.getSpriteSheet?.(knightSheets.roll);
        if (rollSheet) {
            const totalFrames = rollSheet.totalFrames || (rollSheet.rows * rollSheet.cols);
            const rollFrames = Array.from({ length: totalFrames }, (_, i) => i);
            animationConfig.animations.roll = {
                spriteSheetKey: knightSheets.roll,
                frames: rollFrames,
                frameDuration: 0.08,
                loop: false
            };
        }
    }

    if (knightSheets.takeDamage) {
        const takeDamageSheet = spriteManager.getSpriteSheet?.(knightSheets.takeDamage);
        if (takeDamageSheet) {
            const totalFrames = takeDamageSheet.totalFrames || (takeDamageSheet.rows * takeDamageSheet.cols);
            const takeDamageFrames = Array.from({ length: totalFrames }, (_, i) => i);
            animationConfig.animations.takeDamage = {
                spriteSheetKey: knightSheets.takeDamage,
                frames: takeDamageFrames,
                frameDuration: 0.1,
                loop: false
            };
        }
    }

    const weapon = Weapons[equippedWeaponKey] || Weapons.swordAndShield;
    const firstStage = weapon.getComboStageProperties ? weapon.getComboStageProperties(1) : null;
    const initialRange = firstStage ? firstStage.range : weapon.baseRange;
    const initialDamage = firstStage ? firstStage.damage : weapon.baseDamage;
    const initialArc = firstStage ? firstStage.arc : Utils.degToRad(weapon.baseArcDegrees);
    const initialCooldown = weapon.cooldown != null ? weapon.cooldown : 0.25;

    player
        .addComponent(new Transform(x, y, config.width, config.height))
        .addComponent(new Health(config.maxHealth))
        .addComponent(new StatusEffects(true))
        .addComponent(new Stamina(config.maxStamina, config.staminaRegen))
        .addComponent(new PlayerHealing())
        .addComponent(new PlayerMovement(config.speed))
        .addComponent(new Combat(initialRange, initialDamage, initialArc, initialCooldown, 0, true, weapon))
        .addComponent(new Renderable('player', { color: config.color }))
        .addComponent(new Sprite(defaultSheetKey, config.width * 12, config.height * 12))
        .addComponent(new Animation(animationConfig));

    return player;
}
