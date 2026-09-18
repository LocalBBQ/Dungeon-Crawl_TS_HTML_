// Builds a 3D mesh for each obstacle type.
//
// The 2D renderers draw these as top-down silhouettes with a fixed palette. Each builder below keeps
// that palette and footprint (obstacle x/y is the top-left of a width x height box) but gives the
// object real volume and height so it casts shadows and occludes correctly.
import * as THREE from 'three';
import { geometries, surface, unlit, shade } from '../core/MaterialLibrary.js';

export interface ObstacleShape3D {
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
    color?: string;
    id?: string;
    breakable?: boolean;
    hp?: number;
    maxHp?: number;
    passable?: boolean;
    targetLevel?: number;
    campfireHealRemaining?: number;
    fenceAxis?: string;
    leafless?: boolean;
    leaflessVariant?: number;
    spriteFrameIndex?: number;
}

/** Stable pseudo-random stream so an obstacle looks the same every frame and across reloads. */
function seededRandom(seed: number): () => number {
    let state = (seed * 1664525 + 1013904223) >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0xffffffff;
    };
}

function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number],
    rotationY = 0
): THREE.Mesh {
    const node = new THREE.Mesh(geometry, material);
    node.position.set(position[0], position[1], position[2]);
    node.scale.set(scale[0], scale[1], scale[2]);
    node.rotation.y = rotationY;
    node.castShadow = true;
    node.receiveShadow = true;
    return node;
}

/** Marks a child as an animated flame so ObstacleRenderer3D can flicker it. */
function tagFlame(node: THREE.Object3D, phase: number): THREE.Object3D {
    node.userData.flamePhase = phase;
    node.castShadow = false;
    node.receiveShadow = false;
    return node;
}

type Builder = (obstacle: ObstacleShape3D, random: () => number) => THREE.Object3D;

const TREE_CANOPY = [0x2d5016, 0x35601b, 0x264512];
const TRUNK_COLOR = 0x4a2c1a;

const builders: Record<string, Builder> = {
    tree(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const trunkHeight = w * 1.15;
        const trunkRadius = w * 0.11;
        group.add(
            mesh(geometries.cylinder(), surface({ color: TRUNK_COLOR, roughness: 0.95 }),
                [0, trunkHeight / 2, 0], [trunkRadius * 2, trunkHeight, trunkRadius * 2])
        );

        const canopyColor = TREE_CANOPY[Math.floor(random() * TREE_CANOPY.length)];
        const canopyMaterial = surface({ color: canopyColor, roughness: 0.9 });
        // Three overlapping blobs give a fuller silhouette than a single sphere.
        const blobs = 3;
        for (let i = 0; i < blobs; i++) {
            const radius = w * (0.46 - i * 0.07);
            const lift = trunkHeight + w * (0.18 + i * 0.3);
            const drift = w * 0.12;
            group.add(
                mesh(geometries.sphere(), canopyMaterial,
                    [(random() - 0.5) * drift, lift, (random() - 0.5) * drift],
                    [radius * 2, radius * 1.7, radius * 2])
            );
        }
        return group;
    },

    deadTree(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const trunkHeight = w * 1.35;
        const trunkMaterial = surface({ color: 0x2a2520, roughness: 1 });
        group.add(
            mesh(geometries.cylinder(), trunkMaterial, [0, trunkHeight / 2, 0],
                [w * 0.2, trunkHeight, w * 0.2])
        );
        const branchMaterial = surface({ color: 0x1e1b18, roughness: 1 });
        const branchCount = 4;
        for (let i = 0; i < branchCount; i++) {
            const angle = (i / branchCount) * Math.PI * 2 + random() * 0.6;
            const length = w * (0.4 + random() * 0.28);
            const branch = mesh(geometries.cylinder(), branchMaterial,
                [0, trunkHeight * (0.7 + random() * 0.25), 0],
                [w * 0.07, length, w * 0.07]);
            branch.rotation.z = 0.7 + random() * 0.4;
            branch.rotation.y = angle;
            branch.position.x = Math.cos(angle) * length * 0.32;
            branch.position.z = Math.sin(angle) * length * 0.32;
            group.add(branch);
        }
        return group;
    },

    elderTrunk(obstacle, random) {
        const group = new THREE.Group();
        const radius = Math.min(obstacle.width, obstacle.height) * 0.48;
        const trunkHeight = Math.max(obstacle.width, obstacle.height) * 1.1;
        group.add(
            mesh(geometries.cylinder(), surface({ color: 0x2a2518, roughness: 1 }),
                [0, trunkHeight / 2, 0], [radius * 2, trunkHeight, radius * 2])
        );
        // Flared root collar at the base.
        group.add(
            mesh(geometries.cylinder(), surface({ color: 0x3d3528, roughness: 1 }),
                [0, radius * 0.22, 0], [radius * 2.45, radius * 0.45, radius * 2.45])
        );
        // Growth-ring face on top, echoing the 2D heartwood circles.
        group.add(
            mesh(geometries.groundDisc(), surface({ color: 0x4a4035, roughness: 0.9 }),
                [0, trunkHeight + 0.5, 0], [radius * 1.5, 1, radius * 1.5])
        );
        group.add(
            mesh(geometries.groundDisc(), surface({ color: 0x3a3228, roughness: 0.9 }),
                [0, trunkHeight + 1, 0], [radius * 0.7, 1, radius * 0.7])
        );
        const canopyMaterial = surface({ color: 0x1e3d0f, roughness: 0.92 });
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + random();
            const spread = radius * 1.35;
            group.add(
                mesh(geometries.sphere(), canopyMaterial,
                    [Math.cos(angle) * spread * 0.5, trunkHeight + radius * (0.9 + random() * 0.5), Math.sin(angle) * spread * 0.5],
                    [spread * 1.5, spread * 1.1, spread * 1.5])
            );
        }
        return group;
    },

    bush(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const dark = surface({ color: 0x2d4a22, roughness: 0.95 });
        const light = surface({ color: 0x3a5a2a, roughness: 0.95 });
        group.add(mesh(geometries.sphere(), dark, [0, w * 0.26, 0], [w * 0.86, w * 0.6, w * 0.86]));
        for (let i = 0; i < 3; i++) {
            const radius = w * (0.34 - i * 0.05);
            group.add(
                mesh(geometries.sphere(), light,
                    [(random() - 0.5) * w * 0.4, w * (0.34 + i * 0.1), (random() - 0.5) * w * 0.4],
                    [radius * 2, radius * 1.6, radius * 2])
            );
        }
        return group;
    },

    rock(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const base = new THREE.Color(obstacle.color || '#555555');
        const material = surface({ color: base.getHex(), roughness: 0.95 });
        // A couple of jittered boulders read better than one regular shape.
        const boulder = mesh(geometries.sphere(), material, [0, w * 0.26, 0], [w * 0.96, w * 0.62, w * 0.86]);
        boulder.rotation.set(random() * 0.4, random() * Math.PI, random() * 0.4);
        group.add(boulder);
        const chip = mesh(geometries.sphere(), surface({ color: shade(base, -0.18).getHex(), roughness: 0.95 }),
            [w * 0.24, w * 0.14, -w * 0.2], [w * 0.4, w * 0.3, w * 0.36]);
        chip.rotation.y = random() * Math.PI;
        group.add(chip);
        return group;
    },

    rubble(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const base = new THREE.Color(obstacle.color || '#4a4a4a');
        const stones = 5 + Math.floor(random() * 4);
        for (let i = 0; i < stones; i++) {
            const angle = random() * Math.PI * 2;
            const distance = w * random() * 0.3;
            const size = w * (0.16 + random() * 0.16);
            const stone = mesh(
                geometries.sphere(),
                surface({ color: shade(base, (random() - 0.5) * 0.25).getHex(), roughness: 0.98 }),
                [Math.cos(angle) * distance, size * 0.35, Math.sin(angle) * distance],
                [size, size * 0.7, size * 0.9]
            );
            stone.rotation.set(random(), random() * Math.PI, random());
            group.add(stone);
        }
        return group;
    },

    firepit(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const stoneMaterial = surface({ color: 0x5a5550, roughness: 0.95 });
        const stoneCount = 10;
        for (let i = 0; i < stoneCount; i++) {
            const angle = (i / stoneCount) * Math.PI * 2;
            const radius = w * 0.38;
            const stone = mesh(geometries.sphere(), stoneMaterial,
                [Math.cos(angle) * radius, w * 0.07, Math.sin(angle) * radius],
                [w * 0.19, w * 0.16, w * 0.16]);
            stone.rotation.y = angle;
            group.add(stone);
        }
        // Charred logs under the flame.
        const logMaterial = surface({ color: 0x2a201a, roughness: 1 });
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI;
            const log = mesh(geometries.cylinder(), logMaterial, [0, w * 0.07, 0], [w * 0.09, w * 0.6, w * 0.09]);
            log.rotation.z = Math.PI / 2;
            log.rotation.y = angle;
            group.add(log);
        }
        const flame = new THREE.Group();
        flame.name = 'flame';
        flame.add(tagFlame(mesh(geometries.sphere(), unlit(0xff641e, 0.35), [0, w * 0.22, 0], [w * 0.56, w * 0.5, w * 0.56]), 0));
        flame.add(tagFlame(mesh(geometries.sphere(), unlit(0xffa032, 0.6), [0, w * 0.26, 0], [w * 0.36, w * 0.4, w * 0.36]), 1.3));
        flame.add(tagFlame(mesh(geometries.sphere(), unlit(0xffdc78, 0.85), [0, w * 0.3, 0], [w * 0.2, w * 0.26, w * 0.2]), 2.6));
        const light = new THREE.PointLight(0xff8a30, 2.4, w * 9, 2);
        light.position.set(0, w * 0.4, 0);
        light.name = 'flameLight';
        flame.add(light);
        group.add(flame);
        return group;
    },

    brazier(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const metal = surface({ color: 0x4a3020, roughness: 0.7, metalness: 0.35 });
        group.add(mesh(geometries.cylinder(), metal, [0, w * 0.08, 0], [w * 0.5, w * 0.16, w * 0.5]));
        group.add(mesh(geometries.cylinder(), metal, [0, w * 0.45, 0], [w * 0.14, w * 0.75, w * 0.14]));
        const bowl = mesh(geometries.cylinder(), metal, [0, w * 0.92, 0], [w * 0.62, w * 0.28, w * 0.62]);
        bowl.scale.y = w * 0.28;
        group.add(bowl);
        const flame = new THREE.Group();
        flame.name = 'flame';
        flame.add(tagFlame(mesh(geometries.cone(), unlit(0xff5a1e, 0.45), [0, w * 1.3, 0], [w * 0.6, w * 0.9, w * 0.6]), 0.4));
        flame.add(tagFlame(mesh(geometries.cone(), unlit(0xffb43c, 0.8), [0, w * 1.24, 0], [w * 0.36, w * 0.66, w * 0.36]), 1.9));
        const light = new THREE.PointLight(0xff7a28, 2.8, w * 11, 2);
        light.position.set(0, w * 1.3, 0);
        light.name = 'flameLight';
        flame.add(light);
        group.add(flame);
        return group;
    },

    barrel(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = w * 1.05;
        const body = new THREE.Color(obstacle.color || '#5c4a32');
        group.add(
            mesh(geometries.cylinder(), surface({ color: body.getHex(), roughness: 0.9 }),
                [0, height / 2, 0], [w * 0.92, height, w * 0.92])
        );
        const hoop = surface({ color: 0x3d3020, roughness: 0.6, metalness: 0.4 });
        group.add(mesh(geometries.cylinder(), hoop, [0, height * 0.2, 0], [w * 0.97, height * 0.1, w * 0.97]));
        group.add(mesh(geometries.cylinder(), hoop, [0, height * 0.8, 0], [w * 0.97, height * 0.1, w * 0.97]));
        group.add(
            mesh(geometries.cylinder(), surface({ color: 0x4a3820, roughness: 0.95 }),
                [0, height + 0.5, 0], [w * 0.78, 1.5, w * 0.78])
        );
        return group;
    },

    fence(obstacle) {
        const group = new THREE.Group();
        const isVertical = obstacle.fenceAxis === 'y';
        const length = isVertical ? obstacle.height : obstacle.width;
        const thickness = Math.min(obstacle.width, obstacle.height);
        const postHeight = Math.max(28, thickness * 1.6);
        const wood = surface({ color: new THREE.Color(obstacle.color || '#8b7355').getHex(), roughness: 0.95 });
        const darkWood = surface({ color: 0x6b5b45, roughness: 0.95 });

        // The 2D fence puts the post at the start of the segment and runs rails across the whole span.
        const post = mesh(geometries.box(), darkWood, [0, postHeight / 2, 0],
            [thickness * 0.45, postHeight, thickness * 0.45]);
        if (isVertical) post.position.z = -length / 2;
        else post.position.x = -length / 2;
        group.add(post);
        for (const level of [0.4, 0.75]) {
            group.add(
                mesh(geometries.box(), wood, [0, postHeight * level, 0],
                    isVertical
                        ? [thickness * 0.22, postHeight * 0.14, length]
                        : [length, postHeight * 0.14, thickness * 0.22])
            );
        }
        return group;
    },

    ironFence(obstacle) {
        const group = new THREE.Group();
        const isVertical = obstacle.fenceAxis === 'y';
        const length = isVertical ? obstacle.height : obstacle.width;
        const height = Math.max(34, Math.min(obstacle.width, obstacle.height) * 2.2);
        const iron = surface({ color: 0x1a1a1a, roughness: 0.45, metalness: 0.7 });
        const bars = Math.max(2, Math.round(length / 12));
        for (let i = 0; i < bars; i++) {
            const t = (i / Math.max(1, bars - 1) - 0.5) * length;
            const bar = mesh(geometries.cylinder(), iron, [0, height / 2, 0], [3, height, 3]);
            const tip = mesh(geometries.cone(), iron, [0, height + 4, 0], [5, 9, 5]);
            if (isVertical) {
                bar.position.z = t;
                tip.position.z = t;
            } else {
                bar.position.x = t;
                tip.position.x = t;
            }
            group.add(bar, tip);
        }
        group.add(
            mesh(geometries.box(), iron, [0, height * 0.8, 0],
                isVertical ? [3.5, 3.5, length] : [length, 3.5, 3.5])
        );
        return group;
    },

    pillar(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = w * 2.6;
        const stone = new THREE.Color(obstacle.color || '#6b6b6b');
        group.add(
            mesh(geometries.cylinder(), surface({ color: stone.getHex(), roughness: 0.9 }),
                [0, height / 2, 0], [w * 0.7, height, w * 0.7])
        );
        const capMaterial = surface({ color: shade(stone, 0.12).getHex(), roughness: 0.85 });
        group.add(mesh(geometries.box(), capMaterial, [0, height * 0.035, 0], [w * 0.95, height * 0.07, w * 0.95]));
        group.add(mesh(geometries.box(), capMaterial, [0, height * 0.965, 0], [w * 0.95, height * 0.07, w * 0.95]));
        return group;
    },

    brokenPillar(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = w * (0.9 + random() * 0.5);
        const stone = new THREE.Color(obstacle.color || '#5a5a5a');
        const shaft = mesh(geometries.cylinder(), surface({ color: stone.getHex(), roughness: 0.92 }),
            [0, height / 2, 0], [w * 0.62, height, w * 0.62]);
        shaft.rotation.z = (random() - 0.5) * 0.12;
        group.add(shaft);
        // Jagged break at the top.
        group.add(
            mesh(geometries.cone(), surface({ color: shade(stone, -0.15).getHex(), roughness: 0.95 }),
                [0, height + w * 0.08, 0], [w * 0.6, w * 0.24, w * 0.6])
        );
        group.add(mesh(geometries.box(), surface({ color: shade(stone, 0.08).getHex(), roughness: 0.9 }),
            [0, w * 0.05, 0], [w * 0.88, w * 0.1, w * 0.88]));
        return group;
    },

    column(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = w * 3.1;
        const stone = new THREE.Color(obstacle.color || '#656565');
        const shaft = mesh(geometries.cylinder(), surface({ color: stone.getHex(), roughness: 0.88 }),
            [0, height / 2, 0], [w * 0.58, height, w * 0.58]);
        group.add(shaft);
        const trim = surface({ color: shade(stone, 0.15).getHex(), roughness: 0.82 });
        group.add(mesh(geometries.cylinder(), trim, [0, height * 0.02, 0], [w * 0.86, height * 0.05, w * 0.86]));
        group.add(mesh(geometries.box(), trim, [0, height * 0.975, 0], [w * 0.92, height * 0.06, w * 0.92]));
        return group;
    },

    statueBase(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const stone = new THREE.Color(obstacle.color || '#707070');
        const plinth = surface({ color: stone.getHex(), roughness: 0.9 });
        group.add(mesh(geometries.box(), plinth, [0, w * 0.1, 0], [w * 1.0, w * 0.2, w * 1.0]));
        group.add(mesh(geometries.box(), plinth, [0, w * 0.42, 0], [w * 0.78, w * 0.48, w * 0.78]));
        group.add(mesh(geometries.box(), surface({ color: shade(stone, 0.12).getHex(), roughness: 0.88 }),
            [0, w * 0.7, 0], [w * 0.92, w * 0.1, w * 0.92]));
        // Weathered figure remnant.
        group.add(mesh(geometries.cylinder(), surface({ color: shade(stone, -0.12).getHex(), roughness: 0.95 }),
            [0, w * 1.0, 0], [w * 0.3, w * 0.5, w * 0.3]));
        return group;
    },

    arch(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = w * 1.6;
        const stone = surface({ color: new THREE.Color(obstacle.color || '#636363').getHex(), roughness: 0.9 });
        const legWidth = w * 0.22;
        group.add(mesh(geometries.box(), stone, [-w * 0.34, height * 0.42, 0], [legWidth, height * 0.85, legWidth]));
        group.add(mesh(geometries.box(), stone, [w * 0.34, height * 0.42, 0], [legWidth, height * 0.85, legWidth]));
        const keystone = new THREE.Mesh(
            new THREE.TorusGeometry(w * 0.34, legWidth * 0.5, 6, 16, Math.PI),
            stone
        );
        keystone.position.set(0, height * 0.85, 0);
        keystone.castShadow = true;
        keystone.receiveShadow = true;
        group.add(keystone);
        return group;
    },

    crumblingWall(obstacle, random) {
        const group = new THREE.Group();
        const length = Math.max(obstacle.width, obstacle.height);
        const depth = Math.min(obstacle.width, obstacle.height);
        const alongX = obstacle.width >= obstacle.height;
        const stone = new THREE.Color(obstacle.color || '#5c5c5c');
        const blocks = Math.max(2, Math.round(length / 14));
        for (let i = 0; i < blocks; i++) {
            const t = (i + 0.5) / blocks - 0.5;
            const blockHeight = depth * (1.2 + random() * 1.2);
            const block = mesh(
                geometries.box(),
                surface({ color: shade(stone, (random() - 0.5) * 0.2).getHex(), roughness: 0.95 }),
                [alongX ? t * length : 0, blockHeight / 2, alongX ? 0 : t * length],
                [alongX ? length / blocks : depth * 0.9, blockHeight, alongX ? depth * 0.9 : length / blocks]
            );
            block.rotation.y = (random() - 0.5) * 0.12;
            group.add(block);
        }
        return group;
    },

    wall(obstacle) {
        const group = new THREE.Group();
        const height = Math.max(46, Math.min(obstacle.width, obstacle.height) * 2.4);
        const stone = new THREE.Color(obstacle.color || '#696969');
        group.add(
            mesh(geometries.box(), surface({ color: stone.getHex(), roughness: 0.95 }),
                [0, height / 2, 0], [obstacle.width, height, obstacle.height])
        );
        // Capstone course to break up the flat top.
        group.add(
            mesh(geometries.box(), surface({ color: shade(stone, 0.1).getHex(), roughness: 0.9 }),
                [0, height + 3, 0], [obstacle.width * 1.05, 6, obstacle.height * 1.05])
        );
        return group;
    },

    house(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const d = obstacle.height;
        const wallHeight = Math.max(w, d) * 0.7;
        group.add(
            mesh(geometries.box(), surface({ color: 0x8b6a45, roughness: 0.95 }),
                [0, wallHeight / 2, 0], [w, wallHeight, d])
        );
        // Gabled roof from a rotated four-sided cone.
        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(0.5, 1, 4),
            surface({ color: 0x5a3320, roughness: 0.95 })
        );
        roof.position.set(0, wallHeight + Math.max(w, d) * 0.22, 0);
        roof.scale.set(Math.hypot(w, d) * 1.05, Math.max(w, d) * 0.45, Math.hypot(w, d) * 1.05);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        roof.receiveShadow = true;
        group.add(roof);
        group.add(
            mesh(geometries.box(), surface({ color: 0x3a2617, roughness: 0.95 }),
                [0, wallHeight * 0.32, d / 2 + 0.6], [w * 0.22, wallHeight * 0.62, 2])
        );
        return group;
    },

    shed(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const d = obstacle.height;
        const wallHeight = Math.max(w, d) * 0.55;
        group.add(
            mesh(geometries.box(), surface({ color: 0x654321, roughness: 0.96 }),
                [0, wallHeight / 2, 0], [w, wallHeight, d])
        );
        // Single-pitch roof.
        const roof = mesh(geometries.box(), surface({ color: 0x4a3018, roughness: 0.95 }),
            [0, wallHeight + Math.max(w, d) * 0.1, 0], [w * 1.12, Math.max(w, d) * 0.1, d * 1.12]);
        roof.rotation.x = 0.16;
        group.add(roof);
        return group;
    },

    door(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = Math.max(w, obstacle.height) * 1.1;
        group.add(
            mesh(geometries.box(), surface({ color: 0x654321, roughness: 0.95 }),
                [0, height / 2, 0], [w, height, Math.max(6, obstacle.height * 0.3)])
        );
        group.add(
            mesh(geometries.sphere(), surface({ color: 0xb9963f, roughness: 0.4, metalness: 0.7 }),
                [w * 0.3, height * 0.5, obstacle.height * 0.22], [5, 5, 5])
        );
        return group;
    },

    stoneDebris(obstacle, random) {
        return builders.rubble(obstacle, random);
    },

    mushroom(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const stalkHeight = w * (obstacle.leafless ? 1.5 : 0.95);
        group.add(
            mesh(geometries.cylinder(), surface({ color: 0x2a221c, roughness: 1 }),
                [0, stalkHeight / 2, 0], [w * (obstacle.leafless ? 0.18 : 0.3), stalkHeight, w * (obstacle.leafless ? 0.18 : 0.3)])
        );
        if (obstacle.leafless) {
            // Leafless variant is a bare branching stalk rather than a capped mushroom.
            const branchMaterial = surface({ color: 0x2a221c, roughness: 1 });
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2 + (obstacle.leaflessVariant ?? 0);
                const length = w * (0.35 + random() * 0.25);
                const branch = mesh(geometries.cylinder(), branchMaterial,
                    [Math.cos(angle) * length * 0.3, stalkHeight * (0.75 + random() * 0.2), Math.sin(angle) * length * 0.3],
                    [w * 0.06, length, w * 0.06]);
                branch.rotation.z = 0.8;
                branch.rotation.y = angle;
                group.add(branch);
            }
            return group;
        }
        const cap = mesh(geometries.sphere(), surface({ color: 0x6b3a3a, roughness: 0.85 }),
            [0, stalkHeight + w * 0.1, 0], [w * 0.92, w * 0.62, w * 0.92]);
        group.add(cap);
        group.add(
            mesh(geometries.groundDisc(), surface({ color: 0xc9b39a, roughness: 0.9, side: THREE.DoubleSide }),
                [0, stalkHeight + w * 0.02, 0], [w * 0.8, 1, w * 0.8])
        );
        return group;
    },

    grave(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = w * 1.05;
        const stone = surface({ color: 0x6a6a68, roughness: 0.95 });
        const slab = mesh(geometries.box(), stone, [0, height / 2, 0], [w * 0.72, height, w * 0.2]);
        slab.rotation.z = (random() - 0.5) * 0.14;
        group.add(slab);
        group.add(mesh(geometries.box(), stone, [0, height * 0.72, 0], [w * 1.0, w * 0.18, w * 0.2]));
        group.add(
            mesh(geometries.box(), surface({ color: 0x4a4a48, roughness: 1 }),
                [0, w * 0.05, 0], [w * 0.95, w * 0.1, w * 0.5])
        );
        return group;
    },

    swampPool(obstacle) {
        const group = new THREE.Group();
        // Pools are walkable, so they sit flush with the ground as a translucent surface.
        const pool = mesh(
            geometries.groundDisc(),
            surface({
                color: 0x2f4438,
                roughness: 0.25,
                metalness: 0.15,
                transparent: true,
                opacity: 0.85,
                flatShading: false,
            }),
            [0, 0.6, 0],
            [obstacle.width, 1, obstacle.height]
        );
        pool.castShadow = false;
        group.add(pool);
        const rim = mesh(geometries.groundDisc(), surface({ color: 0x1f2c22, roughness: 1 }),
            [0, 0.3, 0], [obstacle.width * 1.12, 1, obstacle.height * 1.12]);
        rim.castShadow = false;
        group.add(rim);
        return group;
    },

    demonPillar(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const height = w * 2.8;
        const dark = surface({ color: 0x3a1518, roughness: 0.8 });
        const shaft = mesh(geometries.cylinder(), dark, [0, height / 2, 0], [w * 0.6, height, w * 0.6]);
        shaft.rotation.y = Math.PI / 8;
        group.add(shaft);
        group.add(mesh(geometries.box(), surface({ color: 0x240f12, roughness: 0.85 }),
            [0, w * 0.1, 0], [w * 1.0, w * 0.2, w * 1.0]));
        // Ember glow at the crown.
        const glow = mesh(geometries.sphere(), unlit(0xff3a20, 0.7), [0, height + w * 0.15, 0], [w * 0.5, w * 0.5, w * 0.5]);
        glow.name = 'flame';
        glow.userData.flamePhase = 0.7;
        glow.castShadow = false;
        group.add(glow);
        const light = new THREE.PointLight(0xff3a20, 1.6, w * 9, 2);
        light.position.set(0, height, 0);
        group.add(light);
        return group;
    },

    lavaRock(obstacle, random) {
        const group = new THREE.Group();
        const w = obstacle.width;
        const rock = mesh(geometries.sphere(), surface({ color: 0x4a2520, roughness: 1 }),
            [0, w * 0.28, 0], [w * 0.95, w * 0.62, w * 0.88]);
        rock.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.3);
        group.add(rock);
        // Glowing fissures peeking out from under the rock.
        const glow = mesh(geometries.groundDisc(), unlit(0xff5a1e, 0.55), [0, 1.2, 0], [w * 1.1, 1, w * 1.1]);
        glow.name = 'flame';
        glow.userData.flamePhase = 1.1;
        glow.castShadow = false;
        group.add(glow);
        return group;
    },

    beehive(obstacle) {
        const group = new THREE.Group();
        const w = obstacle.width;
        // Hives hang on tree trunks, so lift them off the ground.
        const hive = mesh(geometries.sphere(), surface({ color: 0x8b6914, roughness: 0.9 }),
            [0, w * 1.6, 0], [w * 0.95, w * 1.2, w * 0.95]);
        group.add(hive);
        group.add(
            mesh(geometries.sphere(), surface({ color: 0x2a1f08, roughness: 1 }),
                [0, w * 1.35, w * 0.4], [w * 0.28, w * 0.28, w * 0.2])
        );
        return group;
    },
};

/** Cave/den mouths: a boulder mass with a black opening the player walks into. */
function buildEntrance(obstacle: ObstacleShape3D, random: () => number): THREE.Object3D {
    const group = new THREE.Group();
    const w = obstacle.width;
    const d = obstacle.height;
    const height = Math.max(w, d) * 0.95;
    const rockColor = new THREE.Color(obstacle.color || '#3d3832');
    const rockMaterial = surface({ color: rockColor.getHex(), roughness: 0.98 });

    // Ring of boulders forming the mouth, left open towards -z (the approach side).
    const lumps = 7;
    for (let i = 0; i < lumps; i++) {
        const angle = Math.PI * (0.15 + (i / (lumps - 1)) * 0.7) + Math.PI * 0.65;
        const radius = w * 0.46;
        const size = w * (0.34 + random() * 0.2);
        const lump = mesh(geometries.sphere(), rockMaterial,
            [Math.cos(angle) * radius, height * (0.3 + random() * 0.32), Math.sin(angle) * radius * 0.8],
            [size, size * 1.5, size]);
        lump.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.3);
        group.add(lump);
    }
    group.add(
        mesh(geometries.sphere(), rockMaterial,
            [0, height * 0.82, -d * 0.1], [w * 1.0, height * 0.7, d * 0.85])
    );

    // The opening itself: an unlit dark disc set into the face.
    const opening = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 20, 0, Math.PI),
        unlit(0x0a0806, 1)
    );
    opening.scale.set(w * 0.62, height * 0.78, 1);
    opening.position.set(0, 0, d * 0.28);
    opening.castShadow = false;
    opening.receiveShadow = false;
    group.add(opening);

    return group;
}

/** Fallback for any type without a dedicated builder: a block matching its footprint and colour. */
function buildGeneric(obstacle: ObstacleShape3D): THREE.Object3D {
    const height = Math.max(18, Math.min(obstacle.width, obstacle.height) * 1.1);
    const node = mesh(
        geometries.box(),
        surface({ color: new THREE.Color(obstacle.color || '#555555').getHex(), roughness: 0.95 }),
        [0, height / 2, 0],
        [obstacle.width, height, obstacle.height]
    );
    const group = new THREE.Group();
    group.add(node);
    return group;
}

export function isEntranceType(type: string, targetLevel?: number): boolean {
    return typeof targetLevel === 'number' || type === 'caveEntrance' || type.endsWith('Entrance');
}

export function isExitType(type: string): boolean {
    return type === 'caveExit' || type.endsWith('Exit');
}

/** Build the mesh for an obstacle, centred on its footprint with the base resting on the ground. */
export function createObstacleMesh(obstacle: ObstacleShape3D): THREE.Object3D {
    const seed = Math.floor(obstacle.x * 31 + obstacle.y * 17 + obstacle.width);
    const random = seededRandom(seed);

    let node: THREE.Object3D;
    if (isEntranceType(obstacle.type, obstacle.targetLevel) || isExitType(obstacle.type)) {
        node = buildEntrance(obstacle, random);
    } else {
        const builder = builders[obstacle.type];
        node = builder ? builder(obstacle, random) : buildGeneric(obstacle);
    }

    const group = new THREE.Group();
    group.add(node);
    // Obstacle coordinates are the top-left of the footprint box.
    group.position.set(obstacle.x + obstacle.width / 2, 0, obstacle.y + obstacle.height / 2);
    group.userData.obstacleType = obstacle.type;
    return group;
}
