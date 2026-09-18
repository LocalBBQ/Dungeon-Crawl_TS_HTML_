// Weapon and off-hand meshes, built from the same keys the 2D combat renderer uses.
//
// Player weapons are `type_material` keys (sword_bronze, bow_yew, shield_iron...) and the material
// determines the blade/limb colour, so tier upgrades are visible in 3D exactly as they are in the
// inventory icons. Enemy weapons come through as a display name plus an optional `visual` hint.
import * as THREE from 'three';
import { geometries, surface, unlit, shade } from '../core/MaterialLibrary.js';
import { MATERIALS, WOOD_MATERIALS, SHIELD_MATERIALS } from '../../game/weapons/materialTiers.js';

export type WeaponFamily =
    | 'sword'
    | 'greatsword'
    | 'dagger'
    | 'mace'
    | 'club'
    | 'claw'
    | 'bow'
    | 'crossbow'
    | 'staff'
    | 'none';

export type OffhandFamily = 'shield' | 'defender' | 'none';

export interface WeaponDescriptor {
    key: string;
    family: WeaponFamily;
    /** Blade, head or limb colour. */
    color: number;
    /** Reach in world units; mirrors the 2D `weaponLength` when one is supplied. */
    length: number;
}

const MATERIAL_COLORS = new Map<string, string>([
    ...MATERIALS.map((m) => [m.id, m.color] as [string, string]),
    ...WOOD_MATERIALS.map((m) => [m.id, m.color] as [string, string]),
    ...SHIELD_MATERIALS.map((m) => [m.id, m.color] as [string, string]),
]);

function materialColor(key: string, fallback: number): number {
    const suffix = key.includes('_') ? key.slice(key.lastIndexOf('_') + 1) : '';
    const color = MATERIAL_COLORS.get(suffix);
    if (!color) return fallback;
    try {
        return new THREE.Color(color).getHex();
    } catch {
        return fallback;
    }
}

/** Work out what to draw from a weapon key, display name and optional visual hint. */
export function describeWeapon(
    key: string | null | undefined,
    name: string | null | undefined,
    visual: string | null | undefined,
    flags: { isRanged?: boolean; isBow?: boolean; isStaff?: boolean } = {},
    weaponLength?: number | null
): WeaponDescriptor {
    const id = (key ?? name ?? visual ?? '').toLowerCase();
    const label = `${id} ${(visual ?? '').toLowerCase()} ${(name ?? '').toLowerCase()}`;

    let family: WeaponFamily = 'none';
    if (flags.isStaff || label.includes('staff')) family = 'staff';
    else if (flags.isBow || label.includes('bow') && !label.includes('crossbow')) family = 'bow';
    else if (label.includes('crossbow')) family = 'crossbow';
    else if (label.includes('greatsword')) family = 'greatsword';
    else if (label.includes('dagger') || label.includes('shiv')) family = 'dagger';
    else if (label.includes('mace')) family = 'mace';
    else if (label.includes('club')) family = 'club';
    else if (label.includes('claw')) family = 'claw';
    else if (label.includes('sword') || label.includes('blade')) family = 'sword';
    else if (flags.isRanged) family = 'crossbow';
    else if (id) family = 'sword';

    const defaultColor = family === 'bow' || family === 'staff' ? 0x8b6914 : 0xa8a8b0;
    const color = materialColor(id, defaultColor);
    const defaultLength: Record<WeaponFamily, number> = {
        sword: 34,
        greatsword: 52,
        dagger: 18,
        mace: 30,
        club: 34,
        claw: 16,
        bow: 40,
        crossbow: 30,
        staff: 52,
        none: 0,
    };
    return {
        key: id || 'none',
        family,
        color,
        length: weaponLength && weaponLength > 0 ? weaponLength : defaultLength[family],
    };
}

function piece(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number]
): THREE.Mesh {
    const node = new THREE.Mesh(geometry, material);
    node.position.set(...position);
    node.scale.set(...scale);
    node.castShadow = true;
    return node;
}

/**
 * Weapons are built pointing down the -Y axis from the grip at the origin, because the hand anchor
 * hangs off the end of the arm. The rig's arm rotation then swings them naturally.
 */
export function createWeaponMesh(descriptor: WeaponDescriptor, scale: number): THREE.Object3D | null {
    if (descriptor.family === 'none') return null;

    const group = new THREE.Group();
    const length = descriptor.length * scale;
    const metal = surface({ color: descriptor.color, roughness: 0.35, metalness: 0.65 });
    const grip = surface({ color: 0x3a2a1c, roughness: 0.95 });
    const gold = surface({ color: 0xb9963f, roughness: 0.4, metalness: 0.7 });

    switch (descriptor.family) {
        case 'sword':
        case 'greatsword': {
            const bladeLength = length;
            const width = descriptor.family === 'greatsword' ? 6 * scale : 4 * scale;
            group.add(piece(geometries.box(), grip, [0, -length * 0.1, 0], [width * 0.5, length * 0.22, width * 0.5]));
            group.add(piece(geometries.box(), gold, [0, -length * 0.2, 0], [width * 2.6, width * 0.6, width * 0.8]));
            group.add(piece(geometries.box(), metal, [0, -length * 0.2 - bladeLength / 2, 0], [width, bladeLength, width * 0.38]));
            const tip = piece(geometries.cone(), metal, [0, -length * 0.2 - bladeLength - width * 0.6, 0], [width, width * 2, width * 0.38]);
            tip.rotation.x = Math.PI;
            group.add(tip);
            group.add(piece(geometries.sphere(), gold, [0, 0, 0], [width * 0.9, width * 0.9, width * 0.9]));
            break;
        }
        case 'dagger': {
            const width = 3.2 * scale;
            group.add(piece(geometries.box(), grip, [0, -length * 0.16, 0], [width * 0.55, length * 0.34, width * 0.55]));
            group.add(piece(geometries.box(), gold, [0, -length * 0.34, 0], [width * 1.8, width * 0.5, width * 0.7]));
            group.add(piece(geometries.box(), metal, [0, -length * 0.34 - length * 0.33, 0], [width, length * 0.66, width * 0.3]));
            const tip = piece(geometries.cone(), metal, [0, -length, 0], [width, width * 1.8, width * 0.3]);
            tip.rotation.x = Math.PI;
            group.add(tip);
            break;
        }
        case 'mace':
        case 'club': {
            const isClub = descriptor.family === 'club';
            const headSize = (isClub ? 11 : 8) * scale;
            group.add(piece(geometries.cylinder(), grip, [0, -length * 0.35, 0], [3.2 * scale, length * 0.7, 3.2 * scale]));
            const headMaterial = isClub
                ? surface({ color: 0x6b4a2a, roughness: 0.95 })
                : metal;
            group.add(piece(geometries.sphere(), headMaterial, [0, -length * 0.82, 0], [headSize, headSize * 1.1, headSize]));
            if (!isClub) {
                // Flanges around the head.
                for (let i = 0; i < 4; i++) {
                    const angle = (i / 4) * Math.PI * 2;
                    group.add(
                        piece(geometries.box(), metal,
                            [Math.cos(angle) * headSize * 0.5, -length * 0.82, Math.sin(angle) * headSize * 0.5],
                            [headSize * 0.32, headSize * 0.9, headSize * 0.32])
                    );
                }
            } else {
                // Studs on the club.
                for (let i = 0; i < 5; i++) {
                    const angle = (i / 5) * Math.PI * 2;
                    group.add(
                        piece(geometries.cone(), surface({ color: 0x3a2a1c, roughness: 0.9 }),
                            [Math.cos(angle) * headSize * 0.52, -length * (0.78 + (i % 2) * 0.08), Math.sin(angle) * headSize * 0.52],
                            [headSize * 0.24, headSize * 0.4, headSize * 0.24])
                    );
                }
            }
            break;
        }
        case 'claw': {
            const clawMaterial = surface({ color: 0x2a1418, roughness: 0.6 });
            for (let i = -1; i <= 1; i++) {
                const talon = piece(geometries.cone(), clawMaterial,
                    [i * 4 * scale, -length * 0.5, 0], [3 * scale, length, 3 * scale]);
                talon.rotation.x = Math.PI;
                talon.rotation.z = i * 0.2;
                group.add(talon);
            }
            break;
        }
        case 'bow': {
            const wood = surface({ color: descriptor.color, roughness: 0.9 });
            const limb = new THREE.Mesh(
                new THREE.TorusGeometry(length * 0.45, 1.8 * scale, 6, 20, Math.PI * 1.15),
                wood
            );
            limb.position.set(0, -length * 0.42, 0);
            limb.rotation.z = Math.PI / 2 - Math.PI * 0.075;
            limb.castShadow = true;
            group.add(limb);
            group.add(
                piece(geometries.box(), unlit(0xe8e0c8, 0.8), [length * 0.2, -length * 0.42, 0],
                    [0.8 * scale, length * 0.8, 0.8 * scale])
            );
            break;
        }
        case 'crossbow': {
            const wood = surface({ color: 0x6b4a2a, roughness: 0.9 });
            group.add(piece(geometries.box(), wood, [0, -length * 0.4, 0], [4 * scale, length * 0.8, 4 * scale]));
            group.add(piece(geometries.box(), metal, [0, -length * 0.62, 0], [length * 0.8, 2.6 * scale, 3 * scale]));
            group.add(piece(geometries.box(), unlit(0xe8e0c8, 0.8), [0, -length * 0.55, 0], [length * 0.72, 0.7 * scale, 0.7 * scale]));
            break;
        }
        case 'staff': {
            const wood = surface({ color: descriptor.color, roughness: 0.92 });
            group.add(piece(geometries.cylinder(), wood, [0, -length * 0.45, 0], [2.6 * scale, length * 0.95, 2.6 * scale]));
            const orb = piece(geometries.smoothSphere(), unlit(0x88aaff, 0.9), [0, -length * 0.96, 0],
                [8 * scale, 8 * scale, 8 * scale]);
            orb.name = 'staffOrb';
            orb.castShadow = false;
            group.add(orb);
            const light = new THREE.PointLight(0x88aaff, 1.2, 180, 2);
            light.position.set(0, -length * 0.96, 0);
            group.add(light);
            break;
        }
        default:
            return null;
    }

    return group;
}

export function describeOffhand(key: string | null | undefined): { family: OffhandFamily; color: number } {
    const id = (key ?? '').toLowerCase();
    if (!id || id === 'none') return { family: 'none', color: 0 };
    if (id.startsWith('defender')) return { family: 'defender', color: materialColor(id, 0xa8a8b0) };
    if (id.startsWith('shield')) return { family: 'shield', color: materialColor(id, 0x8b6914) };
    return { family: 'none', color: 0 };
}

/** Off-hand items hang from the left hand, angled to present their face forwards. */
export function createOffhandMesh(family: OffhandFamily, color: number, scale: number): THREE.Object3D | null {
    if (family === 'none') return null;
    const group = new THREE.Group();
    const size = (family === 'defender' ? 20 : 26) * scale;
    const base = new THREE.Color(color);

    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.5, size * 0.5, size * 0.12, family === 'defender' ? 6 : 16),
        surface({ color: base.getHex(), roughness: 0.6, metalness: family === 'defender' ? 0.5 : 0.15 })
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    const boss = new THREE.Mesh(
        geometries.sphere(),
        surface({ color: shade(base, 0.25).getHex(), roughness: 0.4, metalness: 0.6 })
    );
    boss.scale.setScalar(size * 0.26);
    boss.position.z = size * 0.1;
    group.add(boss);

    group.position.set(0, 0, size * 0.25);
    return group;
}
