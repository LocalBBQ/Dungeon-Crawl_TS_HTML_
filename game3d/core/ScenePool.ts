// Keyed pool of scene objects, reconciled once per frame.
//
// Callers `begin()` a frame, `acquire()` every object that should be visible, then `end()`. Anything
// not acquired this frame is hidden and, after a grace period, disposed. This keeps the scene graph in
// step with a simulation that creates and destroys entities freely without churning GPU resources.
import * as THREE from 'three';

interface PoolEntry<T extends THREE.Object3D> {
    object: T;
    lastSeenFrame: number;
}

/** Frames an unused object is kept around before being torn down. */
const EVICT_AFTER_FRAMES = 240;

export class ScenePool<T extends THREE.Object3D = THREE.Object3D> {
    private readonly entries = new Map<string, PoolEntry<T>>();
    private frame = 0;

    constructor(
        private readonly parent: THREE.Object3D,
        private readonly onDispose?: (object: T) => void
    ) {}

    begin(): void {
        this.frame++;
    }

    /** Fetch the object for `key`, creating it via `factory` the first time it is seen. */
    acquire(key: string, factory: () => T): T {
        let entry = this.entries.get(key);
        if (!entry) {
            const object = factory();
            this.parent.add(object);
            entry = { object, lastSeenFrame: this.frame };
            this.entries.set(key, entry);
        }
        entry.lastSeenFrame = this.frame;
        entry.object.visible = true;
        return entry.object;
    }

    /** Look up an object without marking it as used this frame. */
    peek(key: string): T | undefined {
        return this.entries.get(key)?.object;
    }

    /** Hide everything not acquired this frame and evict long-unused objects. */
    end(): void {
        for (const [key, entry] of this.entries) {
            if (entry.lastSeenFrame === this.frame) continue;
            entry.object.visible = false;
            if (this.frame - entry.lastSeenFrame > EVICT_AFTER_FRAMES) {
                this.parent.remove(entry.object);
                this.onDispose?.(entry.object);
                disposeSubtree(entry.object);
                this.entries.delete(key);
            }
        }
    }

    clear(): void {
        for (const entry of this.entries.values()) {
            this.parent.remove(entry.object);
            this.onDispose?.(entry.object);
            disposeSubtree(entry.object);
        }
        this.entries.clear();
    }

    get size(): number {
        return this.entries.size;
    }
}

/** Release geometries and any materials that are not shared from the library. */
export function disposeSubtree(root: THREE.Object3D): void {
    root.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry && !(mesh.geometry as THREE.BufferGeometry & { shared?: boolean }).shared) {
            mesh.geometry.dispose();
        }
        const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!material) return;
        const list = Array.isArray(material) ? material : [material];
        for (const item of list) {
            if ((item as THREE.Material & { shared?: boolean }).shared) continue;
            item.dispose();
        }
    });
}
