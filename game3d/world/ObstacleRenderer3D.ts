// Keeps obstacle meshes in step with ObstacleManager and animates the lit ones.
import * as THREE from 'three';
import { ScenePool } from '../core/ScenePool.js';
import { createObstacleMesh, type ObstacleShape3D } from './ObstacleMeshFactory.js';

export interface ObstacleManagerLike {
    obstacles: ObstacleShape3D[];
}

/** Only meshes within this margin of the view are kept in the scene. */
const CULL_MARGIN = 420;

export class ObstacleRenderer3D {
    private readonly group = new THREE.Group();
    private readonly pool: ScenePool;
    private readonly flames: THREE.Object3D[] = [];
    /** Obstacle ids whose mesh has an animated flame, so we only walk those subtrees. */
    private readonly flameOwners = new Set<string>();

    constructor(parent: THREE.Object3D) {
        this.group.name = 'obstacles';
        parent.add(this.group);
        this.pool = new ScenePool(this.group);
    }

    sync(
        obstacleManager: ObstacleManagerLike | null | undefined,
        view: { minX: number; minY: number; maxX: number; maxY: number },
        time: number
    ): void {
        this.pool.begin();
        if (obstacleManager?.obstacles) {
            const minX = view.minX - CULL_MARGIN;
            const minY = view.minY - CULL_MARGIN;
            const maxX = view.maxX + CULL_MARGIN;
            const maxY = view.maxY + CULL_MARGIN;

            for (const obstacle of obstacleManager.obstacles) {
                if (
                    obstacle.x + obstacle.width < minX ||
                    obstacle.x > maxX ||
                    obstacle.y + obstacle.height < minY ||
                    obstacle.y > maxY
                ) {
                    continue;
                }
                const key = obstacle.id ?? `${obstacle.type}:${obstacle.x}:${obstacle.y}`;
                const node = this.pool.acquire(key, () => {
                    const created = createObstacleMesh(obstacle);
                    if (this.hasFlame(created)) this.flameOwners.add(key);
                    return created;
                });

                // A firepit that has been used up stops glowing, matching the 2D renderer.
                if (obstacle.type === 'firepit') {
                    const remaining = obstacle.campfireHealRemaining;
                    const alight = typeof remaining !== 'number' || remaining > 0;
                    const flame = node.getObjectByName('flame');
                    if (flame) flame.visible = alight;
                }
                if (this.flameOwners.has(key)) this.animateFlames(node, time);
            }
        }
        this.pool.end();
    }

    private hasFlame(node: THREE.Object3D): boolean {
        let found = false;
        node.traverse((child) => {
            if (child.userData.flamePhase != null) found = true;
        });
        return found;
    }

    private animateFlames(node: THREE.Object3D, time: number): void {
        this.flames.length = 0;
        node.traverse((child) => {
            if (child.userData.flamePhase != null) this.flames.push(child);
        });
        for (const flame of this.flames) {
            const phase = flame.userData.flamePhase as number;
            // Two detuned sines give an irregular flicker, as in the 2D campfire.
            const flicker = 0.86 + 0.14 * Math.sin(time * 8.4 + phase) * Math.sin(time * 6.8 + phase * 1.7);
            const base = (flame.userData.baseScale as THREE.Vector3 | undefined) ?? flame.scale.clone();
            flame.userData.baseScale = base;
            flame.scale.set(base.x * flicker, base.y * (0.82 + 0.22 * flicker), base.z * flicker);
        }
    }

    clear(): void {
        this.pool.clear();
        this.flameOwners.clear();
    }

    dispose(): void {
        this.clear();
        this.group.removeFromParent();
    }
}
