// Projectiles, pickups, gatherables, hazards and floating damage numbers.
//
// Each of these is drawn by its own manager in 2D; here they are read from the same manager state and
// represented as small 3D objects (or camera-facing sprites for text) so nothing disappears in 3D mode.
import * as THREE from 'three';
import { ScenePool } from '../core/ScenePool.js';
import { geometries, surface, unlit } from '../core/MaterialLibrary.js';
import { CanvasBillboard, drawDamageNumber } from './Billboards.js';

export interface ProjectileLike {
    x: number;
    y: number;
    angle: number;
    width: number;
    height: number;
    active: boolean;
    color?: string;
    visualType?: string;
    pierce?: boolean;
    airborneDuration?: number;
    ownerType?: string;
}

export interface PickupLike {
    x: number;
    y: number;
    radius: number;
    type: string;
}

export interface GatherableLike {
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
}

export interface FlamePillarLike {
    x: number;
    y: number;
    radius: number;
    activeTimer: number;
    activeDuration: number;
}

export interface DamageNumberLike {
    x: number;
    y: number;
    damage: number;
    isPlayerDamage: boolean;
    isBlocked: boolean;
    lifetime: number;
    maxLifetime: number;
    offsetX: number;
    offsetY: number;
    scale: number;
}

/** Height above the ground at which projectiles fly. */
const PROJECTILE_HEIGHT = 26;

const PICKUP_COLORS: Record<string, number> = {
    gold: 0xe8b828,
    whetstone: 0xc4b8a8,
    honey: 0xd9932b,
    page: 0xe8dcc0,
    weapon: 0xa8a8b0,
};

const GATHERABLE_COLORS: Record<string, number> = {
    herb: 0x4a7c4a,
    mushroom: 0x6b4a3a,
    ore: 0x6b5b4f,
    chest: 0x8b6914,
    shrineBlessing: 0x7b9ed4,
};

export class EffectsRenderer3D {
    private readonly group = new THREE.Group();
    private readonly projectiles: ScenePool;
    private readonly pickups: ScenePool;
    private readonly gatherables: ScenePool;
    private readonly hazards: ScenePool;
    private readonly numbers: ScenePool<THREE.Group>;
    private readonly numberBillboards = new Map<string, CanvasBillboard>();

    constructor(parent: THREE.Object3D) {
        this.group.name = 'effects';
        parent.add(this.group);
        this.projectiles = new ScenePool(this.group);
        this.pickups = new ScenePool(this.group);
        this.gatherables = new ScenePool(this.group);
        this.hazards = new ScenePool(this.group);
        this.numbers = new ScenePool<THREE.Group>(this.group, (object) => {
            this.numberBillboards.get(object.name)?.dispose();
            this.numberBillboards.delete(object.name);
        });
    }

    syncProjectiles(list: ProjectileLike[] | null | undefined, time: number): void {
        this.projectiles.begin();
        let index = 0;
        for (const projectile of list ?? []) {
            if (!projectile.active) continue;
            const key = `p${index++}:${projectile.visualType ?? (projectile.pierce ? 'tornado' : 'bolt')}`;
            const node = this.projectiles.acquire(key, () => this.createProjectile(projectile));
            node.position.set(projectile.x, PROJECTILE_HEIGHT, projectile.y);
            node.rotation.y = Math.PI / 2 - projectile.angle;
            if (projectile.pierce && (projectile.airborneDuration ?? 0) > 0) {
                node.rotation.y = time * 6;
            }
        }
        this.projectiles.end();
    }

    private createProjectile(projectile: ProjectileLike): THREE.Object3D {
        const group = new THREE.Group();
        const size = Math.max(projectile.width, projectile.height);
        const color = projectile.color ? new THREE.Color(projectile.color).getHex() : 0xdcd0a8;

        if (projectile.pierce && (projectile.airborneDuration ?? 0) > 0) {
            // Storm Release tornado: a stack of widening rings.
            for (let i = 0; i < 4; i++) {
                const t = i / 3;
                const ring = new THREE.Mesh(
                    geometries.cylinder(),
                    unlit(0xb4c8e0, 0.32 - t * 0.12)
                );
                ring.scale.set(size * (0.5 + t * 0.9), size * 0.5, size * (0.5 + t * 0.9));
                ring.position.y = t * size * 1.1;
                group.add(ring);
            }
            return group;
        }

        if (projectile.visualType === 'rock') {
            const rock = new THREE.Mesh(geometries.sphere(), surface({ color, roughness: 1 }));
            rock.scale.setScalar(size);
            rock.castShadow = true;
            group.add(rock);
            return group;
        }

        if (projectile.visualType === 'orb' || projectile.ownerType === 'enemy') {
            const orb = new THREE.Mesh(geometries.smoothSphere(), unlit(color, 0.95));
            orb.scale.setScalar(size * 1.1);
            group.add(orb);
            const halo = new THREE.Mesh(geometries.smoothSphere(), unlit(color, 0.22));
            halo.scale.setScalar(size * 2.1);
            group.add(halo);
            const light = new THREE.PointLight(color, 1.4, size * 14, 2);
            group.add(light);
            return group;
        }

        // Default: an arrow or bolt pointing along its travel direction (+z after the yaw above).
        const shaft = new THREE.Mesh(geometries.cylinder(), surface({ color: 0x6b4a2a, roughness: 0.9 }));
        shaft.scale.set(size * 0.22, size * 2.4, size * 0.22);
        shaft.rotation.x = Math.PI / 2;
        shaft.castShadow = true;
        group.add(shaft);
        const head = new THREE.Mesh(geometries.cone(), surface({ color: 0xb0b0b8, roughness: 0.4, metalness: 0.6 }));
        head.scale.set(size * 0.42, size * 0.8, size * 0.42);
        head.rotation.x = Math.PI / 2;
        head.position.z = size * 1.4;
        group.add(head);
        const fletch = new THREE.Mesh(geometries.quad(), unlit(0xd8c8a0, 0.9, { side: THREE.DoubleSide }));
        fletch.scale.set(size * 0.7, size * 0.5, 1);
        fletch.position.z = -size;
        fletch.rotation.y = Math.PI / 2;
        group.add(fletch);
        return group;
    }

    syncPickups(list: PickupLike[] | null | undefined, time: number): void {
        this.pickups.begin();
        let index = 0;
        for (const item of list ?? []) {
            const key = `k${index++}:${item.type}`;
            const node = this.pickups.acquire(key, () => this.createPickup(item));
            // Gentle hover and spin so loot reads as interactive.
            node.position.set(item.x, item.radius * 0.8 + Math.sin(time * 2.4 + index) * 2.2, item.y);
            node.rotation.y = time * 1.2 + index;
        }
        this.pickups.end();
    }

    private createPickup(item: PickupLike): THREE.Object3D {
        const group = new THREE.Group();
        const color = PICKUP_COLORS[item.type] ?? 0xc8c8c8;
        const radius = Math.max(4, item.radius);

        if (item.type === 'gold') {
            const coin = new THREE.Mesh(geometries.cylinder(), surface({ color, roughness: 0.3, metalness: 0.8 }));
            coin.scale.set(radius * 2, radius * 0.45, radius * 2);
            coin.rotation.x = 0.4;
            coin.castShadow = true;
            group.add(coin);
        } else if (item.type === 'page') {
            const page = new THREE.Mesh(geometries.quad(), unlit(color, 0.95, { side: THREE.DoubleSide }));
            page.scale.set(radius * 1.8, radius * 2.2, 1);
            page.rotation.x = -0.5;
            group.add(page);
        } else {
            const body = new THREE.Mesh(geometries.sphere(), surface({ color, roughness: 0.6, metalness: 0.2 }));
            body.scale.setScalar(radius * 1.8);
            body.castShadow = true;
            group.add(body);
        }

        // Soft glow so loot stands out on dark ground, matching the 2D highlight.
        const glow = new THREE.Mesh(geometries.groundDisc(), unlit(color, 0.22));
        glow.scale.set(radius * 5, 1, radius * 5);
        glow.position.y = -radius * 0.75;
        group.add(glow);
        return group;
    }

    syncGatherables(list: GatherableLike[] | null | undefined, time: number): void {
        this.gatherables.begin();
        let index = 0;
        for (const item of list ?? []) {
            const key = `g${index++}:${item.type}`;
            const node = this.gatherables.acquire(key, () => this.createGatherable(item));
            node.position.set(item.x + item.width / 2, 0, item.y + item.height / 2);
            if (item.type === 'shrineBlessing') {
                node.rotation.y = time * 0.6;
            }
        }
        this.gatherables.end();
    }

    private createGatherable(item: GatherableLike): THREE.Object3D {
        const group = new THREE.Group();
        const color = GATHERABLE_COLORS[item.type] ?? 0x4a7c4a;
        const size = Math.max(item.width, item.height) * 0.5;

        if (item.type === 'herb') {
            const stemMaterial = surface({ color: 0x3f6b3a, roughness: 0.95 });
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const blade = new THREE.Mesh(geometries.quad(), surface({ color, roughness: 0.95, side: THREE.DoubleSide }));
                blade.scale.set(size * 0.45, size * 1.4, 1);
                blade.position.set(Math.cos(angle) * size * 0.2, size * 0.7, Math.sin(angle) * size * 0.2);
                blade.rotation.y = -angle;
                blade.rotation.x = 0.2;
                group.add(blade);
            }
            const base = new THREE.Mesh(geometries.sphere(), stemMaterial);
            base.scale.set(size * 0.5, size * 0.3, size * 0.5);
            group.add(base);
        } else if (item.type === 'mushroom') {
            const stalk = new THREE.Mesh(geometries.cylinder(), surface({ color: 0xc9b39a, roughness: 0.9 }));
            stalk.scale.set(size * 0.35, size * 0.9, size * 0.35);
            stalk.position.y = size * 0.45;
            group.add(stalk);
            const cap = new THREE.Mesh(geometries.sphere(), surface({ color, roughness: 0.85 }));
            cap.scale.set(size * 1.2, size * 0.8, size * 1.2);
            cap.position.y = size * 0.95;
            cap.castShadow = true;
            group.add(cap);
        } else if (item.type === 'shrineBlessing') {
            const bowl = new THREE.Mesh(geometries.cylinder(), surface({ color: 0x4a5670, roughness: 0.7 }));
            bowl.scale.set(size * 1.4, size * 0.5, size * 1.4);
            bowl.position.y = size * 0.25;
            bowl.castShadow = true;
            group.add(bowl);
            const flame = new THREE.Mesh(geometries.cone(), unlit(color, 0.8));
            flame.scale.set(size * 0.9, size * 1.6, size * 0.9);
            flame.position.y = size * 1.2;
            group.add(flame);
            const light = new THREE.PointLight(color, 1.6, size * 20, 2);
            light.position.y = size * 1.4;
            group.add(light);
        } else {
            const body = new THREE.Mesh(geometries.sphere(), surface({ color, roughness: 0.9 }));
            body.scale.set(size * 1.4, size * 1.1, size * 1.4);
            body.position.y = size * 0.55;
            body.castShadow = true;
            group.add(body);
        }
        return group;
    }

    syncHazards(list: FlamePillarLike[] | null | undefined, time: number): void {
        this.hazards.begin();
        let index = 0;
        for (const pillar of list ?? []) {
            const key = `h${index++}`;
            const node = this.hazards.acquire(key, () => this.createFlamePillar(pillar));
            node.position.set(pillar.x, 0, pillar.y);
            // Fade out as the pillar expires, matching the 2D timer.
            const remaining = pillar.activeDuration > 0 ? pillar.activeTimer / pillar.activeDuration : 1;
            const flicker = 0.85 + 0.15 * Math.sin(time * 14 + index);
            node.scale.set(flicker, Math.max(0.15, remaining) * flicker, flicker);
        }
        this.hazards.end();
    }

    private createFlamePillar(pillar: FlamePillarLike): THREE.Object3D {
        const group = new THREE.Group();
        const radius = pillar.radius;
        const scorch = new THREE.Mesh(geometries.groundDisc(), unlit(0x3a1408, 0.6));
        scorch.scale.set(radius * 2, 1, radius * 2);
        scorch.position.y = 0.8;
        group.add(scorch);
        for (let i = 0; i < 3; i++) {
            const t = i / 2;
            const column = new THREE.Mesh(
                geometries.cylinder(),
                unlit(i === 0 ? 0xff4a10 : i === 1 ? 0xffa030 : 0xffe08a, 0.55 - t * 0.1)
            );
            column.scale.set(radius * (1.8 - t * 0.7), radius * (2.6 - t * 0.5), radius * (1.8 - t * 0.7));
            column.position.y = radius * (1.3 - t * 0.2);
            group.add(column);
        }
        const light = new THREE.PointLight(0xff6a20, 3, radius * 12, 2);
        light.position.y = radius;
        group.add(light);
        return group;
    }

    syncDamageNumbers(list: DamageNumberLike[] | null | undefined): void {
        this.numbers.begin();
        let index = 0;
        for (const entry of list ?? []) {
            const key = `n${index++}`;
            const node = this.numbers.acquire(key, () => {
                const container = new THREE.Group();
                container.name = key;
                const billboard = new CanvasBillboard(40, 24);
                this.numberBillboards.set(key, billboard);
                container.add(billboard.sprite);
                return container;
            });
            const billboard = this.numberBillboards.get(key);
            if (!billboard) continue;

            const progress = entry.lifetime / entry.maxLifetime;
            const opacity = Math.max(0, 1 - progress);
            const color = entry.isBlocked ? '#8888ff' : entry.isPlayerDamage ? '#ff4444' : '#ff8844';
            const text = Math.round(entry.damage).toString();
            billboard.drawIfChanged(`${text}|${color}`, (ctx, width, height) =>
                drawDamageNumber(ctx, width, height, text, color)
            );
            billboard.setOpacity(opacity);
            // offsetY rises in screen pixels in 2D; one pixel is one world unit at the reference zoom.
            billboard.sprite.scale.set(40 * entry.scale, 24 * entry.scale, 1);
            node.position.set(entry.x + entry.offsetX, 40 - entry.offsetY, entry.y);
        }
        this.numbers.end();
    }

    dispose(): void {
        this.projectiles.clear();
        this.pickups.clear();
        this.gatherables.clear();
        this.hazards.clear();
        this.numbers.clear();
        for (const billboard of this.numberBillboards.values()) billboard.dispose();
        this.numberBillboards.clear();
        this.group.removeFromParent();
    }
}
