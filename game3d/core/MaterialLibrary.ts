// Shared geometries and materials.
//
// The scene rebuilds objects constantly as entities stream in and out, so anything reusable is cached
// here and flagged `shared` to keep ScenePool from disposing it when a single instance goes away.
import * as THREE from 'three';

type Shared<T> = T & { shared?: boolean };

function markShared<T extends THREE.Material | THREE.BufferGeometry>(value: T): T {
    (value as Shared<T>).shared = true;
    return value;
}

const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.Material>();

export function sharedGeometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
    const cached = geometryCache.get(key);
    if (cached) return cached as T;
    const geometry = markShared(create());
    geometryCache.set(key, geometry);
    return geometry;
}

export interface StandardMaterialOptions {
    color: THREE.ColorRepresentation;
    roughness?: number;
    metalness?: number;
    emissive?: THREE.ColorRepresentation;
    emissiveIntensity?: number;
    transparent?: boolean;
    opacity?: number;
    flatShading?: boolean;
    side?: THREE.Side;
    depthWrite?: boolean;
}

/** Cached lambert-ish surface material. Flat shading keeps the low-poly look crisp. */
export function surface(options: StandardMaterialOptions): THREE.MeshStandardMaterial {
    const key = JSON.stringify(options);
    const cached = materialCache.get(key);
    if (cached) return cached as THREE.MeshStandardMaterial;
    const material = markShared(
        new THREE.MeshStandardMaterial({
            color: options.color,
            roughness: options.roughness ?? 0.85,
            metalness: options.metalness ?? 0.05,
            emissive: options.emissive ?? 0x000000,
            emissiveIntensity: options.emissiveIntensity ?? 1,
            transparent: options.transparent ?? false,
            opacity: options.opacity ?? 1,
            flatShading: options.flatShading ?? true,
            side: options.side ?? THREE.FrontSide,
            depthWrite: options.depthWrite ?? true,
        })
    );
    materialCache.set(key, material);
    return material as THREE.MeshStandardMaterial;
}

/** Unlit material for glows, decals and anything that should ignore scene lighting. */
export function unlit(
    color: THREE.ColorRepresentation,
    opacity = 1,
    options: { depthWrite?: boolean; blending?: THREE.Blending; side?: THREE.Side } = {}
): THREE.MeshBasicMaterial {
    const key = `unlit:${String(color)}:${opacity}:${options.depthWrite}:${options.blending}:${options.side}`;
    const cached = materialCache.get(key);
    if (cached) return cached as THREE.MeshBasicMaterial;
    const material = markShared(
        new THREE.MeshBasicMaterial({
            color,
            transparent: opacity < 1 || options.blending === THREE.AdditiveBlending,
            opacity,
            depthWrite: options.depthWrite ?? opacity >= 1,
            blending: options.blending ?? THREE.NormalBlending,
            side: options.side ?? THREE.FrontSide,
        })
    );
    materialCache.set(key, material);
    return material as THREE.MeshBasicMaterial;
}

export const geometries = {
    box: () => sharedGeometry('box', () => new THREE.BoxGeometry(1, 1, 1)),
    /** Unit sphere, low segment count to stay in keeping with the faceted art style. */
    sphere: () => sharedGeometry('sphere', () => new THREE.SphereGeometry(0.5, 12, 9)),
    smoothSphere: () => sharedGeometry('smoothSphere', () => new THREE.SphereGeometry(0.5, 20, 14)),
    cylinder: () => sharedGeometry('cylinder', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 12)),
    cone: () => sharedGeometry('cone', () => new THREE.ConeGeometry(0.5, 1, 10)),
    /** Quad lying in the XZ plane, centred on the origin, facing up. */
    groundQuad: () =>
        sharedGeometry('groundQuad', () => {
            const geometry = new THREE.PlaneGeometry(1, 1);
            geometry.rotateX(-Math.PI / 2);
            return geometry;
        }),
    /** Disc lying in the XZ plane, facing up. */
    groundDisc: () =>
        sharedGeometry('groundDisc', () => {
            const geometry = new THREE.CircleGeometry(0.5, 40);
            geometry.rotateX(-Math.PI / 2);
            return geometry;
        }),
    /** Upright quad for billboards. */
    quad: () => sharedGeometry('quad', () => new THREE.PlaneGeometry(1, 1)),
};

/**
 * Build a colour from the 0-255 channels the 2D renderers work in. Those are sRGB bytes, so they must
 * be tagged as such: read as linear they come out far too dark once the renderer converts for output.
 */
export function colorFromBytes(r: number, g: number, b: number): THREE.Color {
    return new THREE.Color().setRGB(
        Math.min(1, Math.max(0, r / 255)),
        Math.min(1, Math.max(0, g / 255)),
        Math.min(1, Math.max(0, b / 255)),
        THREE.SRGBColorSpace
    );
}

/** Parse the CSS colours used throughout the 2D renderers into a three colour plus alpha. */
export function parseColor(value: string | undefined, fallback = 0xffffff): { color: THREE.Color; alpha: number } {
    if (!value) return { color: new THREE.Color(fallback), alpha: 1 };
    const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
    if (rgba) {
        const parts = rgba[1].split(',').map((part) => parseFloat(part.trim()));
        return {
            color: colorFromBytes(parts[0] || 0, parts[1] || 0, parts[2] || 0),
            alpha: parts.length > 3 ? parts[3] : 1,
        };
    }
    try {
        return { color: new THREE.Color(value), alpha: 1 };
    } catch {
        return { color: new THREE.Color(fallback), alpha: 1 };
    }
}

/** Multiply a colour towards black/white, used for deriving trim and shadow tones. */
export function shade(color: THREE.ColorRepresentation, amount: number): THREE.Color {
    const result = new THREE.Color(color);
    if (amount >= 0) return result.lerp(new THREE.Color(0xffffff), amount);
    return result.lerp(new THREE.Color(0x000000), -amount);
}

export function disposeSharedResources(): void {
    for (const geometry of geometryCache.values()) geometry.dispose();
    for (const material of materialCache.values()) material.dispose();
    geometryCache.clear();
    materialCache.clear();
}
