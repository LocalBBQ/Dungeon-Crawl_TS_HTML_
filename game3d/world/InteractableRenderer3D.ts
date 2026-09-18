// Portals, stairs, the equipment chest, shopkeeper, quest board and crafting stations, plus the
// floating "press E" prompts that go with them.
//
// Every one of these is positioned by a top-left x/y and a width/height in the playing state, exactly
// as the 2D renderers consume them, so the 3D versions line up with the collision and interaction
// ranges the simulation already uses.
import * as THREE from 'three';
import { ScenePool } from '../core/ScenePool.js';
import { geometries, surface, unlit } from '../core/MaterialLibrary.js';
import { CanvasBillboard, drawPrompt } from '../fx/Billboards.js';

export interface RectLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PortalLike extends RectLike {
    spawned?: boolean;
    hasNextLevel?: boolean;
}

interface PromptRequest {
    key: string;
    x: number;
    y: number;
    height: number;
    lines: string[];
    channelProgress: number;
}

export class InteractableRenderer3D {
    private readonly group = new THREE.Group();
    private readonly objects: ScenePool;
    private readonly prompts: ScenePool<THREE.Group>;
    private readonly promptBillboards = new Map<string, CanvasBillboard>();
    private readonly pendingPrompts: PromptRequest[] = [];

    constructor(parent: THREE.Object3D) {
        this.group.name = 'interactables';
        parent.add(this.group);
        this.objects = new ScenePool(this.group);
        this.prompts = new ScenePool<THREE.Group>(this.group, (object) => {
            this.promptBillboards.get(object.name)?.dispose();
            this.promptBillboards.delete(object.name);
        });
    }

    begin(): void {
        this.objects.begin();
        this.pendingPrompts.length = 0;
    }

    /** The main level portal, or a stairwell when in the Delve. */
    syncPortal(portal: PortalLike | null | undefined, isStairs: boolean, time: number, key = 'portal'): void {
        if (!portal || !portal.spawned) return;
        const node = this.objects.acquire(`${key}:${isStairs ? 'stairs' : 'gate'}`, () =>
            isStairs ? this.createStairs(portal) : this.createPortal(portal)
        );
        node.position.set(portal.x + portal.width / 2, 0, portal.y + portal.height / 2);
        if (!isStairs) {
            const swirl = node.getObjectByName('swirl');
            if (swirl) {
                swirl.rotation.y = time * 1.4;
                const pulse = 0.85 + 0.15 * Math.sin(time * 2);
                swirl.scale.setScalar(pulse);
            }
        }
    }

    /** Blue recall portal back to the Sanctuary. */
    syncRecallPortal(portal: PortalLike | null | undefined, time: number): void {
        if (!portal || !portal.spawned) return;
        const node = this.objects.acquire('recallPortal', () => this.createPortal(portal, 0x3ca0ff));
        node.position.set(portal.x + portal.width / 2, 0, portal.y + portal.height / 2);
        const swirl = node.getObjectByName('swirl');
        if (swirl) {
            swirl.rotation.y = -time * 1.6;
            swirl.scale.setScalar(0.85 + 0.15 * Math.sin(time * 2.4));
        }
    }

    private createPortal(portal: PortalLike, tint = 0x7850ff): THREE.Object3D {
        const group = new THREE.Group();
        const width = portal.width;
        const height = portal.height;
        const radius = Math.min(width, height) * 0.45;

        // Standing ring with a swirling core, the 3D reading of the 2D radial gradient.
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius, radius * 0.12, 8, 24),
            surface({ color: 0x2a2038, roughness: 0.5, metalness: 0.5 })
        );
        ring.position.y = radius * 1.05;
        ring.castShadow = true;
        group.add(ring);

        const swirl = new THREE.Group();
        swirl.name = 'swirl';
        swirl.position.y = radius * 1.05;
        for (let i = 0; i < 3; i++) {
            const disc = new THREE.Mesh(geometries.smoothSphere(), unlit(tint, 0.55 - i * 0.14));
            disc.scale.set(radius * (1.6 - i * 0.3), radius * (1.9 - i * 0.35), radius * 0.4);
            swirl.add(disc);
        }
        group.add(swirl);

        const glow = new THREE.Mesh(geometries.groundDisc(), unlit(tint, 0.3));
        glow.scale.set(radius * 4, 1, radius * 4);
        glow.position.y = 0.7;
        group.add(glow);

        const light = new THREE.PointLight(tint, 2.4, radius * 16, 2);
        light.position.y = radius * 1.2;
        group.add(light);
        return group;
    }

    private createStairs(portal: RectLike): THREE.Object3D {
        const group = new THREE.Group();
        const steps = 5;
        const stone = surface({ color: 0x4a4038, roughness: 0.95 });
        const dark = surface({ color: 0x1a1512, roughness: 1 });

        // Descending steps sinking into a dark shaft.
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const step = new THREE.Mesh(geometries.box(), stone);
            const width = portal.width * (0.4 + 0.6 * ((i + 1) / steps));
            step.scale.set(width, portal.height * 0.12, portal.height / steps);
            step.position.set(0, -portal.height * 0.1 * i, (t - 0.4) * portal.height);
            step.receiveShadow = true;
            step.castShadow = true;
            group.add(step);
        }
        const shaft = new THREE.Mesh(geometries.box(), dark);
        shaft.scale.set(portal.width * 0.5, portal.height * 0.7, portal.height * 0.5);
        shaft.position.set(0, -portal.height * 0.4, portal.height * 0.3);
        group.add(shaft);
        return group;
    }

    syncChest(chest: RectLike | null | undefined): void {
        if (!chest) return;
        const node = this.objects.acquire('chest', () => {
            const group = new THREE.Group();
            const w = chest.width;
            const d = chest.height;
            const h = Math.min(w, d) * 0.8;
            const body = new THREE.Mesh(geometries.box(), surface({ color: 0x3d2914, roughness: 0.9 }));
            body.scale.set(w, h * 0.65, d);
            body.position.y = h * 0.325;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // Domed lid with gold banding, echoing the 2D gold trim.
            const lid = new THREE.Mesh(geometries.cylinder(), surface({ color: 0x5c3d1e, roughness: 0.85 }));
            // Scale is local, so the roll swaps which axes the length and the two radii end up on:
            // local Y becomes the chest's width, local X its height and local Z its depth.
            lid.scale.set(h * 0.55, w, d);
            lid.rotation.z = Math.PI / 2;
            lid.position.y = h * 0.65;
            lid.castShadow = true;
            group.add(lid);

            const band = surface({ color: 0xc9a227, roughness: 0.35, metalness: 0.75 });
            for (const offset of [-0.3, 0.3]) {
                const strap = new THREE.Mesh(geometries.box(), band);
                strap.scale.set(w * 0.06, h * 0.72, d * 1.04);
                strap.position.set(w * offset, h * 0.36, 0);
                group.add(strap);
            }
            const lock = new THREE.Mesh(geometries.box(), band);
            lock.scale.set(w * 0.12, h * 0.18, d * 0.08);
            lock.position.set(0, h * 0.6, d * 0.5);
            group.add(lock);
            return group;
        });
        node.position.set(chest.x + chest.width / 2, 0, chest.y + chest.height / 2);
    }

    /** Shopkeeper NPC; the head turns towards the player just as it does in 2D. */
    syncShopkeeper(shop: RectLike | null | undefined, playerWorldPos: { x: number; y: number } | null): void {
        if (!shop) return;
        const node = this.objects.acquire('shop', () => {
            const group = new THREE.Group();
            const size = Math.min(shop.width, shop.height);
            const robe = new THREE.Mesh(geometries.cone(), surface({ color: 0x4a3a5a, roughness: 0.9 }));
            robe.scale.set(size * 1.1, size * 1.5, size * 1.1);
            robe.position.y = size * 0.75;
            robe.castShadow = true;
            group.add(robe);

            const head = new THREE.Group();
            head.name = 'head';
            head.position.y = size * 1.62;
            const skull = new THREE.Mesh(geometries.sphere(), surface({ color: 0x8b7355, roughness: 0.75 }));
            skull.scale.setScalar(size * 0.46);
            skull.castShadow = true;
            head.add(skull);
            const hat = new THREE.Mesh(geometries.cone(), surface({ color: 0x3a2d4a, roughness: 0.9 }));
            hat.scale.set(size * 0.7, size * 0.7, size * 0.7);
            hat.position.y = size * 0.36;
            head.add(hat);
            for (const side of [-1, 1]) {
                const eye = new THREE.Mesh(geometries.sphere(), unlit(0x1a1410, 1));
                eye.scale.setScalar(size * 0.07);
                eye.position.set(side * size * 0.14, size * 0.04, size * 0.22);
                head.add(eye);
            }
            group.add(head);

            // Market stall counter in front of the keeper.
            const counter = new THREE.Mesh(geometries.box(), surface({ color: 0x6b4a2a, roughness: 0.95 }));
            counter.scale.set(size * 2.1, size * 0.16, size * 0.55);
            counter.position.set(0, size * 0.72, size * 0.85);
            counter.castShadow = true;
            group.add(counter);
            return group;
        });
        const centerX = shop.x + shop.width / 2;
        const centerY = shop.y + shop.height / 2;
        node.position.set(centerX, 0, centerY);

        const head = node.getObjectByName('head');
        if (head) {
            // Within the same 140-unit radius the 2D renderer uses.
            if (playerWorldPos) {
                const dx = playerWorldPos.x - centerX;
                const dy = playerWorldPos.y - centerY;
                if (Math.hypot(dx, dy) <= 140) {
                    head.rotation.y = Math.PI / 2 - Math.atan2(dy, dx);
                    return;
                }
            }
            head.rotation.y = 0;
        }
    }

    syncBoard(board: RectLike | null | undefined): void {
        if (!board) return;
        const node = this.objects.acquire('board', () => {
            const group = new THREE.Group();
            const w = board.width;
            const h = Math.max(board.width, board.height) * 1.1;
            const frame = new THREE.Mesh(geometries.box(), surface({ color: 0x3d3020, roughness: 0.95 }));
            frame.scale.set(w, h * 0.7, board.height * 0.28);
            frame.position.y = h * 0.6;
            frame.castShadow = true;
            group.add(frame);

            const notice = new THREE.Mesh(geometries.box(), surface({ color: 0x5a4a38, roughness: 0.95 }));
            notice.scale.set(w * 0.86, h * 0.58, board.height * 0.1);
            notice.position.set(0, h * 0.6, board.height * 0.18);
            group.add(notice);

            // Pinned quest papers.
            const paper = surface({ color: 0xe0d6bc, roughness: 1 });
            for (let i = 0; i < 3; i++) {
                const sheet = new THREE.Mesh(geometries.box(), paper);
                sheet.scale.set(w * 0.2, h * 0.16, board.height * 0.04);
                sheet.position.set((i - 1) * w * 0.26, h * (0.55 + (i % 2) * 0.12), board.height * 0.24);
                sheet.rotation.z = (i - 1) * 0.08;
                group.add(sheet);
            }

            for (const side of [-1, 1]) {
                const leg = new THREE.Mesh(geometries.cylinder(), surface({ color: 0x2a2018, roughness: 1 }));
                leg.scale.set(w * 0.09, h * 0.45, w * 0.09);
                leg.position.set(side * w * 0.36, h * 0.22, 0);
                leg.castShadow = true;
                group.add(leg);
            }
            return group;
        });
        node.position.set(board.x + board.width / 2, 0, board.y + board.height / 2);
    }

    /** Reroll and crafting stations share an anvil-style shape; `variant` tints them apart. */
    syncStation(station: RectLike | null | undefined, variant: 'reroll' | 'crafting', time: number): void {
        if (!station) return;
        const node = this.objects.acquire(`station:${variant}`, () => {
            const group = new THREE.Group();
            const w = station.width;
            const d = station.height;
            const h = Math.min(w, d) * 0.9;

            const base = new THREE.Mesh(geometries.box(), surface({ color: 0x3d3428, roughness: 0.95 }));
            base.scale.set(w * 0.8, h * 0.28, d * 0.8);
            base.position.y = h * 0.14;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            const waist = new THREE.Mesh(geometries.box(), surface({ color: 0x2f281f, roughness: 0.95 }));
            waist.scale.set(w * 0.4, h * 0.3, d * 0.4);
            waist.position.y = h * 0.42;
            group.add(waist);

            const top = new THREE.Mesh(geometries.box(), surface({ color: 0x53483a, roughness: 0.7, metalness: 0.35 }));
            top.scale.set(w * 0.95, h * 0.2, d * 0.7);
            top.position.y = h * 0.66;
            top.castShadow = true;
            group.add(top);

            const tint = variant === 'reroll' ? 0x9b7bff : 0xffb347;
            const rune = new THREE.Mesh(geometries.groundDisc(), unlit(tint, 0.75));
            rune.name = 'rune';
            rune.scale.set(w * 0.5, 1, w * 0.5);
            rune.position.y = h * 0.77;
            group.add(rune);

            const light = new THREE.PointLight(tint, 1.4, w * 8, 2);
            light.position.y = h;
            group.add(light);
            return group;
        });
        node.position.set(station.x + station.width / 2, 0, station.y + station.height / 2);
        const rune = node.getObjectByName('rune');
        if (rune) rune.rotation.y = time * (variant === 'reroll' ? 0.9 : -0.7);
    }

    /**
     * Queue an interaction prompt above a world rectangle. Prompts are drawn as camera-facing sprites
     * so their text stays readable regardless of the camera tilt.
     */
    queuePrompt(key: string, rect: RectLike, lines: string[], channelProgress = 0, heightOffset = 0): void {
        this.pendingPrompts.push({
            key,
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            height: Math.max(rect.width, rect.height) * 0.9 + 26 + heightOffset,
            lines,
            channelProgress,
        });
    }

    end(): void {
        this.objects.end();

        this.prompts.begin();
        for (const request of this.pendingPrompts) {
            const node = this.prompts.acquire(request.key, () => {
                const container = new THREE.Group();
                container.name = request.key;
                const billboard = new CanvasBillboard(120, 46);
                this.promptBillboards.set(request.key, billboard);
                container.add(billboard.sprite);
                return container;
            });
            const billboard = this.promptBillboards.get(request.key);
            if (!billboard) continue;
            const width = Math.max(90, request.lines.reduce((max, line) => Math.max(max, line.length * 7 + 26), 0));
            const height = request.lines.length * 13 + 12 + (request.channelProgress > 0 ? 7 : 0);
            billboard.resize(width, height);
            billboard.drawIfChanged(
                `${request.lines.join('\n')}|${request.channelProgress.toFixed(2)}|${width}x${height}`,
                (ctx, w, h) => drawPrompt(ctx, w, h, request.lines, request.channelProgress)
            );
            node.position.set(request.x, request.height, request.y);
        }
        this.prompts.end();
    }

    clear(): void {
        this.objects.clear();
        this.prompts.clear();
        for (const billboard of this.promptBillboards.values()) billboard.dispose();
        this.promptBillboards.clear();
    }

    dispose(): void {
        this.clear();
        this.group.removeFromParent();
    }
}
