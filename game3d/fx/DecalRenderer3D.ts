// Ground decals for combat telegraphs.
//
// In 2D the attack arcs, wind-up cones and lunge rings are drawn straight onto the ground with the
// camera transform. They carry real gameplay information, so they are rebuilt here as flat geometry
// lying on the ground plane: the same angles, radii and colours, now correctly foreshortened by the
// 3D camera. Vertices are rewritten in place each frame to avoid churning geometry.
import * as THREE from 'three';
import { ScenePool } from '../core/ScenePool.js';

/** Arc resolution. Fixed so the vertex buffer can be reused every frame. */
const SEGMENTS = 48;

/** Small lift off the ground so decals never z-fight with the terrain. */
const DECAL_HEIGHT = 0.6;

export interface ArcDecalSpec {
    x: number;
    y: number;
    radius: number;
    /** Centre direction in the same convention as Movement.facingAngle. */
    centerAngle: number;
    /** Total angular width. Use Math.PI * 2 for a full circle. */
    arc: number;
    fill: string;
    outline?: string;
    /** Inner radius as a fraction of `radius`; 0 draws a filled pie. */
    innerRatio?: number;
}

interface DecalMesh extends THREE.Mesh {
    userData: { positions: Float32Array; outline?: THREE.LineLoop };
}

function createArcMesh(): DecalMesh {
    const geometry = new THREE.BufferGeometry();
    // Triangle strip style layout: two rings of SEGMENTS + 1 vertices joined into quads.
    const vertexCount = (SEGMENTS + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const indices: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices.push(a, b, d, a, d, c);
    }
    geometry.setIndex(indices);

    const material = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material) as unknown as DecalMesh;
    mesh.userData = { positions };
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return mesh;
}

function parseCss(value: string): { color: THREE.Color; alpha: number } {
    const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
    if (rgba) {
        const parts = rgba[1].split(',').map((part) => parseFloat(part.trim()));
        return {
            color: new THREE.Color((parts[0] || 0) / 255, (parts[1] || 0) / 255, (parts[2] || 0) / 255),
            alpha: parts.length > 3 ? parts[3] : 1,
        };
    }
    return { color: new THREE.Color(value), alpha: 1 };
}

export class DecalRenderer3D {
    private readonly group = new THREE.Group();
    private readonly pool: ScenePool<DecalMesh>;
    private counter = 0;

    constructor(parent: THREE.Object3D) {
        this.group.name = 'decals';
        parent.add(this.group);
        this.pool = new ScenePool<DecalMesh>(this.group);
    }

    begin(): void {
        this.pool.begin();
        this.counter = 0;
    }

    /** Queue one arc, cone or ring for this frame. */
    draw(spec: ArcDecalSpec): void {
        const mesh = this.pool.acquire(`arc:${this.counter++}`, createArcMesh);
        const positions = mesh.userData.positions;
        const inner = spec.radius * (spec.innerRatio ?? 0);
        const outer = spec.radius;
        const start = spec.centerAngle - spec.arc / 2;

        for (let i = 0; i <= SEGMENTS; i++) {
            const angle = start + (i / SEGMENTS) * spec.arc;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const base = i * 6;
            positions[base] = cos * inner;
            positions[base + 1] = 0;
            positions[base + 2] = sin * inner;
            positions[base + 3] = cos * outer;
            positions[base + 4] = 0;
            positions[base + 5] = sin * outer;
        }
        const attribute = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        attribute.needsUpdate = true;

        const { color, alpha } = parseCss(spec.fill);
        const material = mesh.material as THREE.MeshBasicMaterial;
        material.color.copy(color);
        material.opacity = alpha;

        mesh.position.set(spec.x, DECAL_HEIGHT, spec.y);
    }

    end(): void {
        this.pool.end();
    }

    dispose(): void {
        this.pool.clear();
        this.group.removeFromParent();
    }
}
