// Per-species proportions and palettes for the 3D characters.
//
// The 2D renderers draw each enemy as a top-down silhouette built from the entity's `renderable.color`
// plus a few species accents (goblin ears, demon horns, skeleton ribs...). Those same accents are
// described here as build instructions so the 3D bodies stay recognisably the same creatures, and the
// base colour still comes from the live entity so tier variants and damage tints carry over.
import * as THREE from 'three';

/** Tier variants reuse the silhouette of their base creature, exactly as the 2D renderer does. */
export const BASE_SHAPE_BY_ENEMY_TYPE: Record<string, string> = {
    goblinBrute: 'goblin',
    goblinElite: 'goblin',
    skeletonVeteran: 'skeleton',
    skeletonElite: 'skeleton',
    zombieVeteran: 'zombie',
    zombieElite: 'zombie',
    banditVeteran: 'bandit',
    banditElite: 'bandit',
    lesserDemonVeteran: 'lesserDemon',
    lesserDemonElite: 'lesserDemon',
    greaterDemonVeteran: 'greaterDemon',
    greaterDemonElite: 'greaterDemon',
    goblinChieftainVeteran: 'goblinChieftain',
    goblinChieftainElite: 'goblinChieftain',
    fireDragonAlpha: 'fireDragon',
    fireDragonElite: 'fireDragon',
    villageOgreAlpha: 'villageOgre',
    villageOgreElite: 'villageOgre',
};

export function baseShapeFor(enemyType: string | null | undefined): string {
    if (!enemyType) return 'goblin';
    return BASE_SHAPE_BY_ENEMY_TYPE[enemyType] ?? enemyType;
}

export type HeadShape = 'round' | 'skull' | 'horned' | 'helmet' | 'hood' | 'brute' | 'draconic' | 'sack';

export interface CharacterProfile {
    /** Overall height as a multiple of the entity's hitbox width. */
    heightScale: number;
    /** Shoulder width as a multiple of the hitbox width. */
    shoulderScale: number;
    /** Torso taper: 1 keeps a barrel, values below 1 narrow the waist. */
    waistScale: number;
    headScale: number;
    headShape: HeadShape;
    limbThickness: number;
    /** How far the torso leans forward at rest, in radians. Hunched creatures lean more. */
    stoop: number;
    /** Speed multiplier on the walk cycle. */
    gaitRate: number;
    /** Secondary colour for boots, gloves and belts. Derived from the body colour when omitted. */
    accentColor?: number;
    skinTint?: number;
    eyeColor: number;
    eyeGlow: boolean;
    /** Extra geometry attached in the build step. */
    features: {
        earsPointed?: boolean;
        horns?: 'small' | 'great';
        crown?: boolean;
        tusks?: boolean;
        ribs?: boolean;
        tatters?: boolean;
        wings?: boolean;
        tail?: boolean;
        cape?: boolean;
        robe?: boolean;
        hood?: boolean;
        quadruped?: boolean;
        stake?: boolean;
    };
}

const DEFAULT_PROFILE: CharacterProfile = {
    heightScale: 2.1,
    shoulderScale: 0.92,
    waistScale: 0.85,
    headScale: 0.56,
    headShape: 'round',
    limbThickness: 0.2,
    stoop: 0.05,
    gaitRate: 1,
    eyeColor: 0x1a1a0a,
    eyeGlow: false,
    features: {},
};

const PROFILES: Record<string, Partial<CharacterProfile>> = {
    goblin: {
        heightScale: 1.75,
        shoulderScale: 0.86,
        headScale: 0.62,
        stoop: 0.26,
        gaitRate: 1.35,
        eyeColor: 0x1a1a0a,
        features: { earsPointed: true },
    },
    goblinChieftain: {
        heightScale: 2.15,
        shoulderScale: 1.1,
        headScale: 0.66,
        limbThickness: 0.24,
        stoop: 0.2,
        gaitRate: 1.1,
        features: { earsPointed: true, crown: true, tusks: true },
    },
    skeleton: {
        heightScale: 2.0,
        shoulderScale: 0.82,
        waistScale: 0.6,
        headScale: 0.54,
        headShape: 'skull',
        limbThickness: 0.12,
        stoop: 0.02,
        gaitRate: 1.05,
        accentColor: 0xd8d2c0,
        eyeColor: 0x220f05,
        eyeGlow: true,
        features: { ribs: true },
    },
    zombie: {
        heightScale: 1.95,
        shoulderScale: 0.9,
        headScale: 0.58,
        limbThickness: 0.2,
        stoop: 0.35,
        gaitRate: 0.62,
        eyeColor: 0x1b2410,
        features: { tatters: true },
    },
    bandit: {
        heightScale: 2.05,
        shoulderScale: 1.0,
        headScale: 0.54,
        headShape: 'helmet',
        limbThickness: 0.21,
        stoop: 0.06,
        gaitRate: 1.1,
        accentColor: 0x3a352e,
        eyeColor: 0x000000,
        features: { cape: true },
    },
    lesserDemon: {
        heightScale: 1.95,
        shoulderScale: 0.98,
        headScale: 0.56,
        headShape: 'horned',
        limbThickness: 0.21,
        stoop: 0.2,
        gaitRate: 1.25,
        accentColor: 0x3a1a1a,
        eyeColor: 0xff4400,
        eyeGlow: true,
        features: { horns: 'small', tail: true },
    },
    greaterDemon: {
        heightScale: 2.5,
        shoulderScale: 1.28,
        headScale: 0.6,
        headShape: 'horned',
        limbThickness: 0.27,
        stoop: 0.16,
        gaitRate: 0.95,
        accentColor: 0x2a0a12,
        eyeColor: 0xff2200,
        eyeGlow: true,
        features: { horns: 'great', wings: true, tail: true },
    },
    villageOgre: {
        heightScale: 2.6,
        shoulderScale: 1.45,
        waistScale: 1.0,
        headScale: 0.62,
        headShape: 'brute',
        limbThickness: 0.34,
        stoop: 0.3,
        gaitRate: 0.7,
        features: { tusks: true },
    },
    fireDragon: {
        heightScale: 2.2,
        shoulderScale: 1.5,
        waistScale: 1.0,
        headScale: 0.7,
        headShape: 'draconic',
        limbThickness: 0.3,
        stoop: 0.9,
        gaitRate: 0.8,
        accentColor: 0x7a2408,
        eyeColor: 0xffcc22,
        eyeGlow: true,
        features: { wings: true, tail: true, quadruped: true, horns: 'great' },
    },
    trainingDummy: {
        heightScale: 1.9,
        shoulderScale: 0.95,
        headScale: 0.5,
        headShape: 'sack',
        limbThickness: 0.18,
        stoop: 0,
        gaitRate: 0,
        accentColor: 0x6b5634,
        eyeColor: 0x2a2018,
        features: { stake: true },
    },

    // Player classes. The 2D art shows a plated knight, a hooded mage and a hooded rogue.
    knight: {
        heightScale: 2.1,
        shoulderScale: 1.04,
        headScale: 0.52,
        headShape: 'helmet',
        limbThickness: 0.22,
        stoop: 0.04,
        gaitRate: 1.15,
        accentColor: 0x4a4a58,
        eyeColor: 0x000000,
        features: { cape: true },
    },
    mage: {
        heightScale: 2.1,
        shoulderScale: 0.88,
        waistScale: 1.05,
        headScale: 0.52,
        headShape: 'hood',
        limbThickness: 0.19,
        stoop: 0.06,
        gaitRate: 1.05,
        accentColor: 0x2a2035,
        skinTint: 0x8b7355,
        eyeColor: 0x120c18,
        features: { robe: true, hood: true },
    },
    rogue: {
        heightScale: 2.0,
        shoulderScale: 0.86,
        headScale: 0.5,
        headShape: 'hood',
        limbThickness: 0.17,
        stoop: 0.12,
        gaitRate: 1.3,
        accentColor: 0x3d3228,
        eyeColor: 0x0a0806,
        features: { hood: true, cape: true },
    },
};

export function profileFor(shape: string): CharacterProfile {
    return { ...DEFAULT_PROFILE, ...(PROFILES[shape] ?? {}), features: { ...(PROFILES[shape]?.features ?? {}) } };
}

/** Default body colours used when an entity has no renderable colour of its own. */
export const FALLBACK_BODY_COLOR: Record<string, number> = {
    knight: 0x8b8b9a,
    mage: 0x3d2d4d,
    rogue: 0x5a4a3a,
    goblin: 0x44aa44,
    skeleton: 0xcccccc,
    zombie: 0x6d4c2e,
    bandit: 0x5a5248,
    lesserDemon: 0x884444,
    greaterDemon: 0xaa4444,
    goblinChieftain: 0x2d5a2d,
    villageOgre: 0x4a6b3a,
    fireDragon: 0xc44c22,
    trainingDummy: 0x8b7355,
};

export function resolveBodyColor(shape: string, renderableColor: string | undefined): THREE.Color {
    if (renderableColor) {
        try {
            return new THREE.Color(renderableColor);
        } catch {
            // Fall through to the species default below.
        }
    }
    return new THREE.Color(FALLBACK_BODY_COLOR[shape] ?? 0x9a9a9a);
}
