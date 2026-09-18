// Lighting, fog and sky derived from each level's 2D theme.
//
// The 2D renderer expresses mood through a flat ground colour plus a translucent `sky` tint. Those two
// values are reinterpreted here as a directional key light, ambient fill, fog and backdrop colour so a
// level reads with the same palette and mood once it is lit in 3D.
import * as THREE from 'three';
import { colorFromBytes, parseColor } from '../core/MaterialLibrary.js';

export interface GroundTheme {
    r?: number;
    g?: number;
    b?: number;
    variation?: number;
    texture?: string;
    patch?: { r: number; g: number; b: number; variation?: number; chance: number };
}

export interface LevelTheme {
    ground?: GroundTheme;
    sky?: string;
    clearColor?: string;
}

export interface AtmosphereProfile {
    /** Main light colour and strength. */
    keyColor: THREE.Color;
    keyIntensity: number;
    /** Direction the key light comes from, as a unit-ish offset applied to the camera target. */
    keyDirection: THREE.Vector3;
    ambientColor: THREE.Color;
    ambientIntensity: number;
    /** Bounce light from the ground, tinted by the terrain colour. */
    groundBounce: THREE.Color;
    fogColor: THREE.Color;
    fogDensity: number;
    background: THREE.Color;
    /** Extra point light that follows the player, used for the dark interior levels. */
    playerLight: { color: THREE.Color; intensity: number; distance: number } | null;
}

function groundColor(theme: LevelTheme | null | undefined): THREE.Color {
    const ground = theme?.ground;
    if (!ground || ground.r == null) return new THREE.Color(0x2e3a26);
    return colorFromBytes(ground.r ?? 0, ground.g ?? 0, ground.b ?? 0);
}

/** Levels played underground or at night get a tighter, darker lighting rig. */
const INTERIOR_LEVELS = new Set([10, 11, 12]);

export function buildAtmosphere(level: number, theme: LevelTheme | null | undefined): AtmosphereProfile {
    const ground = groundColor(theme);
    const sky = parseColor(theme?.sky, 0x8098b4);
    const interior = INTERIOR_LEVELS.has(level);

    // The sky tint is nearly transparent in 2D; scale it up so it still colours the 3D lighting.
    const tintStrength = THREE.MathUtils.clamp(sky.alpha * 4, 0.08, 0.85);
    const skyTint = sky.color.clone();

    const background = theme?.clearColor
        ? parseColor(theme.clearColor).color
        : ground.clone().lerp(skyTint, 0.55).multiplyScalar(interior ? 0.45 : 0.9);

    const fogColor = background.clone().lerp(skyTint, 0.25);

    if (interior) {
        return {
            keyColor: skyTint.clone().lerp(new THREE.Color(0xffd9a0), 0.4),
            keyIntensity: 0.55,
            keyDirection: new THREE.Vector3(-0.35, 1.05, -0.55),
            ambientColor: skyTint.clone().lerp(ground, 0.5),
            ambientIntensity: 0.55,
            groundBounce: ground.clone().multiplyScalar(1.6),
            fogColor,
            fogDensity: 0.00085,
            background,
            playerLight: {
                color: new THREE.Color(0xffc478),
                intensity: level === 11 ? 2.2 : 2.6,
                distance: 900,
            },
        };
    }

    return {
        keyColor: new THREE.Color(0xfff2d6).lerp(skyTint, tintStrength * 0.5),
        keyIntensity: 1.65,
        keyDirection: new THREE.Vector3(-0.45, 1.15, -0.62),
        ambientColor: skyTint.clone().lerp(new THREE.Color(0x9fb4d0), 0.4),
        ambientIntensity: 0.85,
        groundBounce: ground.clone().multiplyScalar(1.8),
        fogColor,
        fogDensity: 0.00022,
        background,
        playerLight: null,
    };
}

/** Owns the scene's lights and keeps the shadow frustum centred on the camera target. */
export class Atmosphere3D {
    private readonly key: THREE.DirectionalLight;
    private readonly ambient: THREE.HemisphereLight;
    private readonly fill: THREE.DirectionalLight;
    private readonly playerLight: THREE.PointLight;
    private readonly fog: THREE.FogExp2;
    private profile: AtmosphereProfile | null = null;
    private appliedKey = '';

    constructor(private readonly scene: THREE.Scene) {
        this.key = new THREE.DirectionalLight(0xffffff, 1.5);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(2048, 2048);
        this.key.shadow.bias = -0.0009;
        this.key.shadow.normalBias = 1.2;
        scene.add(this.key);
        scene.add(this.key.target);

        // Soft opposing light so the unlit sides of characters keep their silhouette.
        this.fill = new THREE.DirectionalLight(0xffffff, 0.25);
        scene.add(this.fill);

        this.ambient = new THREE.HemisphereLight(0xffffff, 0x404040, 1);
        scene.add(this.ambient);

        this.playerLight = new THREE.PointLight(0xffc478, 0, 900, 2);
        scene.add(this.playerLight);

        this.fog = new THREE.FogExp2(0x101010, 0.0002);
        scene.fog = this.fog;
    }

    apply(level: number, theme: LevelTheme | null | undefined): void {
        const key = `${level}:${theme?.sky ?? ''}:${theme?.ground?.r ?? ''},${theme?.ground?.g ?? ''},${theme?.ground?.b ?? ''}`;
        if (key === this.appliedKey) return;
        this.appliedKey = key;

        const profile = buildAtmosphere(level, theme);
        this.profile = profile;

        this.key.color.copy(profile.keyColor);
        this.key.intensity = profile.keyIntensity;
        this.fill.color.copy(profile.ambientColor);
        this.fill.intensity = profile.keyIntensity * 0.18;
        this.ambient.color.copy(profile.ambientColor);
        this.ambient.groundColor.copy(profile.groundBounce);
        this.ambient.intensity = profile.ambientIntensity;
        this.fog.color.copy(profile.fogColor);
        this.fog.density = profile.fogDensity;
        this.scene.background = profile.background;

        if (profile.playerLight) {
            this.playerLight.color.copy(profile.playerLight.color);
            this.playerLight.intensity = profile.playerLight.intensity;
            this.playerLight.distance = profile.playerLight.distance;
            this.playerLight.visible = true;
        } else {
            this.playerLight.visible = false;
            this.playerLight.intensity = 0;
        }
    }

    /**
     * Track the view so the shadow map stays tight around what is on screen. `viewRadius` is roughly
     * half the visible world diagonal.
     */
    update(target: THREE.Vector3, viewRadius: number, playerPosition: THREE.Vector3 | null): void {
        const profile = this.profile;
        if (!profile) return;

        const distance = Math.max(600, viewRadius * 2.2);
        this.key.position.copy(target).addScaledVector(profile.keyDirection, distance);
        this.key.target.position.copy(target);
        this.key.target.updateMatrixWorld();

        const extent = Math.max(240, viewRadius * 1.15);
        const shadowCamera = this.key.shadow.camera;
        if (
            shadowCamera.left !== -extent ||
            shadowCamera.far !== distance * 2.5
        ) {
            shadowCamera.left = -extent;
            shadowCamera.right = extent;
            shadowCamera.top = extent;
            shadowCamera.bottom = -extent;
            shadowCamera.near = 1;
            shadowCamera.far = distance * 2.5;
            shadowCamera.updateProjectionMatrix();
        }

        this.fill.position.copy(target).add(new THREE.Vector3(distance * 0.6, distance * 0.5, distance * 0.7));

        if (profile.playerLight && playerPosition) {
            this.playerLight.position.set(playerPosition.x, 130, playerPosition.z);
        }
    }
}
