// A posable 3D character built from a CharacterProfile.
//
// Rather than ship skinned model assets, each creature is assembled from primitives into a small
// hierarchy (hips, torso, head, four limbs, weapon anchors) and animated procedurally. That keeps the
// faceted look of the 2D art, scales to every enemy tier, and lets combat state drive the pose so a
// wind-up, swing or lunge reads the same in 3D as the arc telegraphs did in 2D.
import * as THREE from 'three';
import { geometries, surface, unlit, shade } from '../core/MaterialLibrary.js';
import type { CharacterProfile } from './CharacterProfiles.js';

export interface CharacterPose {
    /** Ground speed in world units per second; drives the walk cycle. */
    speed: number;
    /** Seconds since the scene started, used for idle motion. */
    time: number;
    delta: number;
    isAttacking: boolean;
    isWindingUp: boolean;
    /** 0..1 through the current swing. */
    swingProgress: number;
    /** 0..1 through a wind-up or charge. */
    chargeProgress: number;
    isBlocking: boolean;
    isDodging: boolean;
    isLunging: boolean;
    isStunned: boolean;
    isHealing: boolean;
    isResting: boolean;
    /** Attack reads as an overhead slam rather than a horizontal sweep. */
    overheadSlam: boolean;
    /** Ranged weapon pose: both hands forward. */
    isAiming: boolean;
    hitFlash: number;
}

const UP = new THREE.Vector3(0, 1, 0);

function part(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number],
    scale: [number, number, number]
): THREE.Mesh {
    const node = new THREE.Mesh(geometry, material);
    node.position.set(...position);
    node.scale.set(...scale);
    node.castShadow = true;
    node.receiveShadow = true;
    return node;
}

export class CharacterRig {
    readonly root = new THREE.Group();
    /** Vertical bounce and lean applied on top of the root transform. */
    private readonly body = new THREE.Group();
    private readonly hips = new THREE.Group();
    private readonly torso = new THREE.Group();
    private readonly head = new THREE.Group();
    private readonly armLeft = new THREE.Group();
    private readonly armRight = new THREE.Group();
    private readonly legLeft = new THREE.Group();
    private readonly legRight = new THREE.Group();
    /** Where the main-hand weapon mesh is parented. */
    readonly weaponAnchor = new THREE.Group();
    /** Where the off-hand item (shield, quiver) is parented. */
    readonly offhandAnchor = new THREE.Group();
    private readonly extras = new THREE.Group();
    private readonly tintTargets: THREE.MeshStandardMaterial[] = [];
    private readonly wings: THREE.Object3D[] = [];
    private tail: THREE.Object3D | null = null;

    /** Height of the character in world units; used to place bars and floating text. */
    readonly height: number;
    private readonly unit: number;
    private readonly profile: CharacterProfile;
    private readonly baseColor: THREE.Color;
    private walkPhase = Math.random() * Math.PI * 2;
    private lean = 0;
    private bounce = 0;

    constructor(profile: CharacterProfile, hitboxWidth: number, bodyColor: THREE.Color) {
        this.profile = profile;
        this.unit = hitboxWidth;
        this.baseColor = bodyColor;
        this.height = hitboxWidth * profile.heightScale;

        this.root.add(this.body);
        this.body.add(this.hips);
        this.hips.add(this.torso);
        this.torso.add(this.head);
        this.torso.add(this.armLeft);
        this.torso.add(this.armRight);
        this.hips.add(this.legLeft);
        this.hips.add(this.legRight);
        this.body.add(this.extras);

        this.build();
    }

    /** Material that tints with damage flashes and wind-up glow. */
    private bodyMaterial(color: THREE.ColorRepresentation, roughness = 0.75): THREE.MeshStandardMaterial {
        // Cloned per rig so per-entity tinting does not leak into the shared cache.
        const material = surface({ color, roughness }).clone() as THREE.MeshStandardMaterial;
        (material as THREE.Material & { shared?: boolean }).shared = false;
        this.tintTargets.push(material);
        return material;
    }

    private build(): void {
        const u = this.unit;
        const p = this.profile;
        const height = this.height;
        const legLength = height * 0.34;
        const torsoHeight = height * 0.38;
        const headSize = u * p.headScale;
        const shoulderWidth = u * p.shoulderScale;
        const limb = u * p.limbThickness;

        const bodyColor = this.baseColor.getHex();
        const accent = p.accentColor ?? shade(this.baseColor, -0.35).getHex();
        const bodyMat = this.bodyMaterial(bodyColor);
        const accentMat = this.bodyMaterial(accent, 0.8);
        const skinMat = this.bodyMaterial(p.skinTint ?? shade(this.baseColor, 0.12).getHex(), 0.7);

        // Legs pivot at the hip and hang downwards.
        this.hips.position.y = legLength;
        for (const [leg, side] of [
            [this.legLeft, -1],
            [this.legRight, 1],
        ] as const) {
            leg.position.set(side * shoulderWidth * 0.26, 0, 0);
            if (p.features.quadruped) {
                // Dragons stand on four legs: the "legs" group holds the hind pair.
                leg.add(part(geometries.cylinder(), accentMat, [0, -legLength / 2, -u * 0.35], [limb * 1.4, legLength, limb * 1.4]));
                leg.add(part(geometries.sphere(), accentMat, [0, -legLength, -u * 0.35], [limb * 1.8, limb * 1.1, limb * 2.2]));
                continue;
            }
            leg.add(part(geometries.cylinder(), accentMat, [0, -legLength / 2, 0], [limb, legLength, limb]));
            leg.add(part(geometries.box(), accentMat, [0, -legLength + limb * 0.3, limb * 0.3], [limb * 1.15, limb * 0.6, limb * 1.7]));
        }

        // Torso pivots at the hips.
        this.torso.position.y = 0;
        const chest = part(
            geometries.sphere(),
            bodyMat,
            [0, torsoHeight * 0.5, 0],
            [shoulderWidth, torsoHeight, shoulderWidth * 0.72]
        );
        this.torso.add(chest);
        this.torso.add(
            part(geometries.sphere(), bodyMat, [0, torsoHeight * 0.14, 0],
                [shoulderWidth * p.waistScale, torsoHeight * 0.5, shoulderWidth * 0.62 * p.waistScale])
        );
        this.torso.add(
            part(geometries.box(), accentMat, [0, torsoHeight * 0.18, 0],
                [shoulderWidth * 0.98 * p.waistScale, u * 0.1, shoulderWidth * 0.7 * p.waistScale])
        );

        // Arms pivot at the shoulders.
        const armLength = height * 0.3;
        for (const [arm, side] of [
            [this.armLeft, -1],
            [this.armRight, 1],
        ] as const) {
            arm.position.set(side * shoulderWidth * 0.52, torsoHeight * 0.82, 0);
            arm.add(part(geometries.sphere(), bodyMat, [0, 0, 0], [limb * 1.6, limb * 1.5, limb * 1.6]));
            arm.add(part(geometries.cylinder(), skinMat, [0, -armLength / 2, 0], [limb * 0.9, armLength, limb * 0.9]));
            arm.add(part(geometries.sphere(), accentMat, [0, -armLength, 0], [limb * 1.15, limb * 1.15, limb * 1.15]));
        }
        this.armRight.add(this.weaponAnchor);
        this.weaponAnchor.position.set(0, -armLength, 0);
        this.armLeft.add(this.offhandAnchor);
        this.offhandAnchor.position.set(0, -armLength, 0);

        // Head.
        this.head.position.y = torsoHeight * 1.0;
        this.buildHead(headSize, bodyMat, accentMat, skinMat);
        this.buildFeatures(headSize, shoulderWidth, torsoHeight, limb, bodyMat, accentMat);
    }

    private buildHead(
        size: number,
        bodyMat: THREE.MeshStandardMaterial,
        accentMat: THREE.MeshStandardMaterial,
        skinMat: THREE.MeshStandardMaterial
    ): void {
        const p = this.profile;
        const eyeMaterial = p.eyeGlow
            ? unlit(p.eyeColor, 1)
            : surface({ color: p.eyeColor, roughness: 0.4 });

        switch (p.headShape) {
            case 'skull': {
                this.head.add(part(geometries.sphere(), skinMat, [0, size * 0.5, 0], [size, size * 1.05, size * 0.95]));
                // Jaw juts forward, echoing the 2D skull silhouette.
                this.head.add(part(geometries.box(), skinMat, [0, size * 0.22, size * 0.28], [size * 0.62, size * 0.3, size * 0.45]));
                break;
            }
            case 'helmet': {
                this.head.add(part(geometries.sphere(), accentMat, [0, size * 0.52, 0], [size * 1.02, size * 1.1, size * 1.02]));
                // Visor slit.
                this.head.add(part(geometries.box(), unlit(0x000000, 1), [0, size * 0.5, size * 0.44], [size * 0.7, size * 0.16, size * 0.16]));
                this.head.add(part(geometries.box(), bodyMat, [0, size * 0.95, 0], [size * 0.18, size * 0.32, size * 0.9]));
                break;
            }
            case 'hood': {
                this.head.add(part(geometries.sphere(), skinMat, [0, size * 0.5, 0], [size * 0.78, size * 0.86, size * 0.78]));
                const hood = part(geometries.cone(), accentMat, [0, size * 0.62, -size * 0.06], [size * 1.35, size * 1.35, size * 1.35]);
                hood.castShadow = true;
                this.head.add(hood);
                // Shadowed face opening.
                this.head.add(part(geometries.sphere(), unlit(0x0a0806, 1), [0, size * 0.46, size * 0.3], [size * 0.5, size * 0.4, size * 0.3]));
                break;
            }
            case 'brute': {
                this.head.add(part(geometries.sphere(), skinMat, [0, size * 0.45, 0], [size * 1.25, size * 1.0, size * 1.15]));
                this.head.add(part(geometries.box(), skinMat, [0, size * 0.18, size * 0.4], [size * 0.85, size * 0.4, size * 0.4]));
                break;
            }
            case 'draconic': {
                this.head.add(part(geometries.sphere(), bodyMat, [0, size * 0.4, size * 0.2], [size * 1.0, size * 0.85, size * 1.5]));
                const snout = part(geometries.cone(), bodyMat, [0, size * 0.34, size * 0.95], [size * 0.7, size * 0.9, size * 0.7]);
                snout.rotation.x = Math.PI / 2;
                this.head.add(snout);
                break;
            }
            case 'sack': {
                this.head.add(part(geometries.sphere(), accentMat, [0, size * 0.5, 0], [size, size * 1.1, size]));
                this.head.add(part(geometries.cylinder(), surface({ color: 0x4a3a20 }), [0, size * 1.02, 0], [size * 0.3, size * 0.16, size * 0.3]));
                break;
            }
            default: {
                this.head.add(part(geometries.sphere(), skinMat, [0, size * 0.5, 0], [size, size * 1.02, size]));
            }
        }

        if (p.headShape !== 'sack' && p.headShape !== 'helmet' && p.headShape !== 'hood') {
            const eyeSize = size * 0.15;
            for (const side of [-1, 1]) {
                this.head.add(
                    part(geometries.sphere(), eyeMaterial,
                        [side * size * 0.24, size * 0.56, size * 0.42], [eyeSize, eyeSize, eyeSize * 0.6])
                );
            }
        }

        if (p.features.earsPointed) {
            const earMat = this.bodyMaterial(shade(this.baseColor, 0.08).getHex());
            for (const side of [-1, 1]) {
                const ear = part(geometries.cone(), earMat,
                    [side * size * 0.6, size * 0.72, -size * 0.05], [size * 0.3, size * 0.85, size * 0.3]);
                ear.rotation.z = side * -1.15;
                this.head.add(ear);
            }
        }

        if (p.features.horns) {
            const great = p.features.horns === 'great';
            const hornMat = surface({ color: great ? 0x2a0a12 : 0x3a1a1a, roughness: 0.7 });
            for (const side of [-1, 1]) {
                const horn = part(geometries.cone(), hornMat,
                    [side * size * 0.45, size * (great ? 1.0 : 0.9), -size * 0.1],
                    [size * (great ? 0.42 : 0.28), size * (great ? 1.3 : 0.75), size * (great ? 0.42 : 0.28)]);
                horn.rotation.z = side * -0.45;
                horn.rotation.x = -0.35;
                this.head.add(horn);
            }
        }

        if (p.features.tusks) {
            const tuskMat = surface({ color: 0xe0d8c0, roughness: 0.6 });
            for (const side of [-1, 1]) {
                const tusk = part(geometries.cone(), tuskMat,
                    [side * size * 0.3, size * 0.24, size * 0.4], [size * 0.16, size * 0.44, size * 0.16]);
                tusk.rotation.x = -0.3;
                this.head.add(tusk);
            }
        }

        if (p.features.crown) {
            const crownMat = surface({ color: 0x8b7355, roughness: 0.6, metalness: 0.35 });
            const crown = part(geometries.cylinder(), crownMat, [0, size * 1.0, 0], [size * 0.95, size * 0.22, size * 0.95]);
            this.head.add(crown);
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                this.head.add(
                    part(geometries.cone(), crownMat,
                        [Math.cos(angle) * size * 0.42, size * 1.2, Math.sin(angle) * size * 0.42],
                        [size * 0.16, size * 0.3, size * 0.16])
                );
            }
        }
    }

    private buildFeatures(
        headSize: number,
        shoulderWidth: number,
        torsoHeight: number,
        limb: number,
        bodyMat: THREE.MeshStandardMaterial,
        accentMat: THREE.MeshStandardMaterial
    ): void {
        const p = this.profile;
        const u = this.unit;

        if (p.features.ribs) {
            const boneMat = surface({ color: 0xd8d2c0, roughness: 0.65 });
            // Thin horizontal bands stacked up the torso, which is what reads as a ribcage at this scale.
            for (let i = 0; i < 3; i++) {
                this.extras.add(part(geometries.cylinder(), boneMat,
                    [0, torsoHeight * (0.45 + i * 0.16) + this.hips.position.y, 0],
                    [shoulderWidth * 0.82, limb * 0.09, shoulderWidth * 0.6]));
            }
        }

        if (p.features.tatters) {
            const ragMat = surface({ color: shade(this.baseColor, -0.45).getHex(), roughness: 1, side: THREE.DoubleSide });
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2;
                const rag = part(geometries.quad(), ragMat,
                    [Math.cos(angle) * shoulderWidth * 0.45, this.hips.position.y + torsoHeight * 0.1, Math.sin(angle) * shoulderWidth * 0.35],
                    [u * 0.3, u * 0.55, 1]);
                rag.rotation.y = -angle;
                rag.castShadow = false;
                this.extras.add(rag);
            }
        }

        if (p.features.robe) {
            const robe = part(geometries.cone(), accentMat,
                [0, this.hips.position.y * 0.52, 0],
                [shoulderWidth * 1.5, this.hips.position.y * 1.15, shoulderWidth * 1.5]);
            this.extras.add(robe);
        }

        if (p.features.cape) {
            const capeMat = surface({ color: shade(this.baseColor, -0.3).getHex(), roughness: 0.95, side: THREE.DoubleSide });
            const cape = part(geometries.quad(), capeMat,
                [0, this.hips.position.y + torsoHeight * 0.35, -shoulderWidth * 0.42],
                [shoulderWidth * 1.25, torsoHeight * 1.5, 1]);
            cape.rotation.x = 0.16;
            this.extras.add(cape);
        }

        if (p.features.wings) {
            const wingMat = surface({
                color: shade(this.baseColor, -0.45).getHex(),
                roughness: 0.9,
                side: THREE.DoubleSide,
            });
            for (const side of [-1, 1]) {
                const pivot = new THREE.Group();
                pivot.position.set(side * shoulderWidth * 0.45, this.hips.position.y + torsoHeight * 0.75, -shoulderWidth * 0.2);
                const membrane = part(geometries.quad(), wingMat, [side * u * 0.75, u * 0.15, 0], [u * 1.7, u * 1.1, 1]);
                membrane.rotation.y = side * -0.5;
                membrane.castShadow = false;
                pivot.add(membrane);
                pivot.userData.wingSide = side;
                this.extras.add(pivot);
                this.wings.push(pivot);
            }
        }

        if (p.features.tail) {
            const tail = new THREE.Group();
            tail.position.set(0, this.hips.position.y * 0.85, -shoulderWidth * 0.35);
            const segments = 4;
            for (let i = 0; i < segments; i++) {
                const t = i / segments;
                tail.add(
                    part(geometries.sphere(), bodyMat,
                        [0, -t * u * 0.25, -t * u * 1.1], [u * (0.3 - t * 0.18), u * (0.3 - t * 0.18), u * 0.38])
                );
            }
            this.extras.add(tail);
            this.tail = tail;
        }

        if (p.features.quadruped) {
            // Front legs and a lowered chest so dragons read as four-legged.
            for (const side of [-1, 1]) {
                const front = part(geometries.cylinder(), accentMat,
                    [side * shoulderWidth * 0.4, this.hips.position.y * 0.5, shoulderWidth * 0.5],
                    [limb * 1.3, this.hips.position.y, limb * 1.3]);
                this.extras.add(front);
            }
        }

        if (p.features.stake) {
            this.extras.add(
                part(geometries.cylinder(), surface({ color: 0x4a3a20, roughness: 1 }),
                    [0, this.hips.position.y * 0.5, 0], [u * 0.16, this.hips.position.y, u * 0.16])
            );
        }
    }

    /** Apply the animation state for this frame. */
    update(pose: CharacterPose): void {
        const p = this.profile;
        const u = this.unit;
        const moving = pose.speed > 4;

        // Walk cycle: phase advances with distance travelled so the gait matches the actual speed.
        const strideRate = (pose.speed / Math.max(1, u * 2.4)) * p.gaitRate;
        this.walkPhase += pose.delta * (moving ? strideRate * Math.PI * 2 : 0);
        const swing = moving ? Math.min(1, pose.speed / 220) : 0;
        const stride = Math.sin(this.walkPhase) * 0.85 * swing;

        if (!p.features.quadruped) {
            this.legLeft.rotation.x = stride;
            this.legRight.rotation.x = -stride;
        } else {
            this.legLeft.rotation.x = stride * 0.45;
            this.legRight.rotation.x = -stride * 0.45;
        }

        // Idle breathing keeps characters alive when standing still.
        const breathe = Math.sin(pose.time * 1.9 + this.walkPhase * 0.1) * 0.02;
        const bounceTarget = moving ? Math.abs(Math.sin(this.walkPhase)) * u * 0.06 : 0;
        this.bounce += (bounceTarget - this.bounce) * Math.min(1, pose.delta * 14);

        let leanTarget = p.stoop + (moving ? 0.12 * swing : 0) + breathe;
        if (pose.isDodging) leanTarget += 0.55;
        if (pose.isLunging) leanTarget += 0.4;
        if (pose.isStunned) leanTarget -= 0.25;
        if (pose.isResting) leanTarget += 0.3;
        this.lean += (leanTarget - this.lean) * Math.min(1, pose.delta * 12);

        this.body.position.y = this.bounce - (pose.isResting ? this.height * 0.22 : 0);
        this.body.rotation.x = this.lean;
        this.body.rotation.z = pose.isStunned ? Math.sin(pose.time * 18) * 0.09 : 0;

        this.torso.rotation.y = moving ? Math.sin(this.walkPhase) * 0.12 * swing : 0;
        this.head.rotation.x = -this.lean * 0.6;

        // Arms: counter-swing while walking, then overridden by combat poses.
        const armSwing = -stride * 0.7;
        let rightArm = armSwing;
        let leftArm = -armSwing;
        let rightArmZ = 0.08;
        let leftArmZ = -0.08;

        if (pose.isAiming) {
            rightArm = -1.45;
            leftArm = -1.35;
            rightArmZ = 0.28;
            leftArmZ = -0.28;
        } else if (pose.isWindingUp) {
            // Pull the weapon back and up in proportion to the charge.
            const charge = THREE.MathUtils.clamp(pose.chargeProgress, 0, 1);
            rightArm = pose.overheadSlam ? -2.3 * charge - 0.3 : 0.9 * charge;
            rightArmZ = pose.overheadSlam ? 0.1 : -0.5 * charge;
        } else if (pose.isAttacking) {
            const t = THREE.MathUtils.clamp(pose.swingProgress, 0, 1);
            if (pose.overheadSlam) {
                // Drive down through the arc.
                rightArm = THREE.MathUtils.lerp(-2.6, 0.6, t);
            } else {
                // Horizontal sweep across the body.
                rightArm = THREE.MathUtils.lerp(-0.7, -1.5, Math.sin(t * Math.PI));
                rightArmZ = THREE.MathUtils.lerp(-0.9, 1.1, t);
                this.torso.rotation.y = THREE.MathUtils.lerp(0.5, -0.6, t);
            }
        } else if (pose.isHealing) {
            rightArm = -2.2;
            rightArmZ = 0.35;
        }

        if (pose.isBlocking) {
            leftArm = -1.5;
            leftArmZ = -0.45;
        }

        this.armRight.rotation.x = rightArm;
        this.armRight.rotation.z = rightArmZ;
        this.armLeft.rotation.x = leftArm;
        this.armLeft.rotation.z = leftArmZ;

        for (const wing of this.wings) {
            const side = wing.userData.wingSide as number;
            wing.rotation.z = side * (0.25 + Math.sin(pose.time * 3.1) * 0.22);
            wing.rotation.y = Math.sin(pose.time * 3.1 + 0.6) * 0.16;
        }
        if (this.tail) {
            this.tail.rotation.y = Math.sin(pose.time * 2.2 + this.walkPhase * 0.5) * 0.3;
        }
    }

    /**
     * Tint the whole body. The 2D renderer recolours enemies during wind-ups, lunges and hits; the same
     * cue is applied here as an emissive flash so it survives the scene lighting.
     */
    applyTint(color: THREE.Color | null, emissive: number): void {
        for (const material of this.tintTargets) {
            if (color) {
                material.emissive.copy(color);
                material.emissiveIntensity = emissive;
            } else {
                material.emissiveIntensity = 0;
            }
        }
    }

    setOpacity(opacity: number): void {
        const transparent = opacity < 1;
        for (const material of this.tintTargets) {
            material.transparent = transparent;
            material.opacity = opacity;
        }
    }

    /** Face the given 2D world heading. */
    setFacing(facingAngle: number): void {
        // Default forward for these meshes is +z; world heading 0 points along +x.
        this.root.rotation.y = Math.PI / 2 - facingAngle;
    }

    setPosition(x: number, z: number, y = 0): void {
        this.root.position.set(x, y, z);
    }

    setScale(scale: number): void {
        this.root.scale.setScalar(scale);
    }

    dispose(): void {
        for (const material of this.tintTargets) material.dispose();
        this.tintTargets.length = 0;
    }
}

export { UP };
