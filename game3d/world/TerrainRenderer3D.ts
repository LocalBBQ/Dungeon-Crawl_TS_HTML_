// Ground plane for the current level.
//
// The 2D world layer paints one flat quad per tile, choosing between a repeating texture and a colour
// that is nudged by a per-tile hash (plus an optional "patch" colour). That same hash is reproduced
// here as per-tile vertex colours on a tile grid, so the ground keeps its exact mottling while gaining
// real lighting. A larger skirt plane sits underneath so the tilted camera never sees past the edge.
import * as THREE from 'three';
import { colorFromBytes, surface, sharedGeometry } from '../core/MaterialLibrary.js';
import type { GroundTheme } from './Atmosphere3D.js';

/** Matches the tile hash in WorldLayerRenderer so tinting lines up with the 2D view. */
function tileHash(tileX: number, tileY: number): number {
    return ((tileX * 73856093) ^ (tileY * 19349663)) >>> 0;
}

interface TerrainKey {
    level: number;
    width: number;
    height: number;
    tileSize: number;
    themeKey: string;
    textureId: string;
}

export class TerrainRenderer3D {
    private readonly group = new THREE.Group();
    private mesh: THREE.Mesh | null = null;
    private skirt: THREE.Mesh | null = null;
    private key = '';

    constructor(
        parent: THREE.Object3D,
        private readonly getGroundTexture: (id: string) => HTMLImageElement | null
    ) {
        this.group.name = 'terrain';
        parent.add(this.group);
    }

    sync(
        level: number,
        worldWidth: number,
        worldHeight: number,
        tileSize: number,
        theme: GroundTheme | null | undefined,
        useTextures: boolean
    ): void {
        const ground = theme ?? { r: 30, g: 50, b: 30, variation: 18 };
        const textureId = useTextures && ground.texture ? ground.texture : '';
        const descriptor: TerrainKey = {
            level,
            width: worldWidth,
            height: worldHeight,
            tileSize,
            themeKey: `${ground.r},${ground.g},${ground.b},${ground.variation},${ground.patch?.r ?? ''},${ground.patch?.g ?? ''},${ground.patch?.b ?? ''},${ground.patch?.chance ?? ''}`,
            textureId,
        };
        const key = JSON.stringify(descriptor);
        if (key === this.key) return;
        this.key = key;

        this.disposeMeshes();
        this.mesh = this.buildGround(worldWidth, worldHeight, tileSize, ground, textureId);
        this.group.add(this.mesh);
        this.skirt = this.buildSkirt(worldWidth, worldHeight, ground);
        this.group.add(this.skirt);
    }

    private buildGround(
        worldWidth: number,
        worldHeight: number,
        tileSize: number,
        ground: GroundTheme,
        textureId: string
    ): THREE.Mesh {
        const cols = Math.max(1, Math.ceil(worldWidth / tileSize));
        const rows = Math.max(1, Math.ceil(worldHeight / tileSize));

        const geometry = new THREE.PlaneGeometry(cols * tileSize, rows * tileSize, cols, rows);
        geometry.rotateX(-Math.PI / 2);
        geometry.translate((cols * tileSize) / 2, 0, (rows * tileSize) / 2);
        // Per-tile colours need their own vertices, otherwise neighbours blend across shared corners.
        const nonIndexed = geometry.toNonIndexed();
        geometry.dispose();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.96,
            metalness: 0,
            color: 0xffffff,
        });

        const texture = textureId ? this.getGroundTexture(textureId) : null;
        const textured = !!texture && texture.complete && texture.naturalWidth > 0;
        if (textured) {
            const map = new THREE.Texture(texture!);
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.repeat.set(cols, rows);
            map.magFilter = THREE.NearestFilter;
            map.minFilter = THREE.LinearMipmapLinearFilter;
            map.colorSpace = THREE.SRGBColorSpace;
            map.anisotropy = 8;
            map.needsUpdate = true;
            material.map = map;
        }

        // Tinting keys off the texture that actually made it onto the material: a theme can name one
        // that never loaded or is turned off, and those tiles must fall back to the flat 2D colour.
        this.paintTileColors(nonIndexed, cols, rows, tileSize, ground, textured);

        const mesh = new THREE.Mesh(nonIndexed, material);
        mesh.receiveShadow = true;
        mesh.name = 'ground';
        return mesh;
    }

    private paintTileColors(
        geometry: THREE.BufferGeometry,
        cols: number,
        rows: number,
        tileSize: number,
        ground: GroundTheme,
        textured: boolean
    ): void {
        const position = geometry.getAttribute('position');
        const colors = new Float32Array(position.count * 3);
        const patch = ground.patch && ground.patch.chance > 0 ? ground.patch : null;
        const color = new THREE.Color();

        // PlaneGeometry emits two triangles (six vertices) per cell in row-major order.
        const verticesPerTile = 6;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const isPatch = patch ? (tileHash(col, row) % 1000) / 1000 < patch.chance : false;
                const base = isPatch && patch ? patch : ground;
                const variation = base.variation ?? ground.variation ?? 15;
                // The 2D renderer offsets by world position, so tile indices scale back up by tileSize.
                const step = Math.floor((col * tileSize + row * tileSize) % 3) * variation;
                if (textured) {
                    // 2D draws the texture untinted; white leaves it to the lighting alone.
                    color.setScalar(1);
                } else {
                    color.copy(
                        colorFromBytes((base.r ?? 30) + step, (base.g ?? 50) + step, (base.b ?? 30) + step)
                    );
                }
                const start = (row * cols + col) * verticesPerTile;
                for (let i = 0; i < verticesPerTile; i++) {
                    const offset = (start + i) * 3;
                    colors[offset] = color.r;
                    colors[offset + 1] = color.g;
                    colors[offset + 2] = color.b;
                }
            }
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    /**
     * Oversized plane just below the playfield so the horizon reads as more terrain, not void. It has
     * to stay ahead of the widest shot the camera can take, which is a near-overhead orbit.
     */
    private buildSkirt(worldWidth: number, worldHeight: number, ground: GroundTheme): THREE.Mesh {
        const size = Math.max(worldWidth, worldHeight) * 16;
        const geometry = sharedGeometry('terrainSkirt', () => {
            const plane = new THREE.PlaneGeometry(1, 1);
            plane.rotateX(-Math.PI / 2);
            return plane;
        });
        const mesh = new THREE.Mesh(
            geometry,
            surface({
                color: colorFromBytes(
                    (ground.r ?? 30) * 0.72,
                    (ground.g ?? 50) * 0.72,
                    (ground.b ?? 30) * 0.72
                ).getHex(),
                roughness: 1,
                flatShading: false,
            })
        );
        mesh.scale.set(size, 1, size);
        mesh.position.set(worldWidth / 2, -3, worldHeight / 2);
        mesh.name = 'terrainSkirt';
        return mesh;
    }

    private disposeMeshes(): void {
        for (const mesh of [this.mesh, this.skirt]) {
            if (!mesh) continue;
            this.group.remove(mesh);
            mesh.geometry.dispose();
            const material = mesh.material as THREE.MeshStandardMaterial;
            if (!(material as THREE.Material & { shared?: boolean }).shared) {
                material.map?.dispose();
                material.dispose();
            }
        }
        this.mesh = null;
        this.skirt = null;
    }

    dispose(): void {
        this.disposeMeshes();
        this.group.removeFromParent();
    }
}
