// Drives a perspective camera from the 2D CameraSystem so framing, follow and zoom stay identical.
//
// World mapping: 2D world x -> 3D x, 2D world y -> 3D z, ground plane is y = 0.
// The 2D camera stores the top-left of the view in world units plus a zoom (pixels per world unit).
// The view centre is therefore (x + canvasW / 2z, y + canvasH / 2z); pointing the 3D camera at that
// same centre puts every world point at the same screen position it had in 2D.
import * as THREE from 'three';

export interface Camera2DState {
    x: number;
    y: number;
    zoom: number;
    shakeOffsetX?: number;
    shakeOffsetY?: number;
}

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const DEFAULT_PITCH = THREE.MathUtils.degToRad(54);
const MIN_PITCH = THREE.MathUtils.degToRad(18);
const MAX_PITCH = THREE.MathUtils.degToRad(88);
/** Radians of rotation per pixel of middle-drag; a full turn takes roughly one screen width. */
const ORBIT_SENSITIVITY = 0.005;

export class CameraRig3D {
    readonly camera: THREE.PerspectiveCamera;

    /** Tilt away from straight-down, in radians measured from the ground plane. */
    pitch = DEFAULT_PITCH;
    /** Rotation of the view around the vertical axis. 0 keeps 2D screen-up pointing at -y in world space. */
    yaw = 0;

    private readonly target = new THREE.Vector3();
    private readonly raycaster = new THREE.Raycaster();
    private readonly ndc = new THREE.Vector2();
    private readonly hit = new THREE.Vector3();
    private viewportWidth = 1;
    private viewportHeight = 1;

    constructor() {
        this.camera = new THREE.PerspectiveCamera(45, 1, 1, 12000);
    }

    /** World-space point the camera is aimed at (the 2D view centre, on the ground plane). */
    getTarget(): THREE.Vector3 {
        return this.target;
    }

    /**
     * Swing the camera around its target by a middle-drag, measured in canvas pixels. Dragging right
     * walks the camera around to the right; dragging down lifts it towards a top-down view.
     */
    orbit(deltaX: number, deltaY: number): void {
        this.yaw = (this.yaw + deltaX * ORBIT_SENSITIVITY) % (Math.PI * 2);
        this.pitch = THREE.MathUtils.clamp(this.pitch + deltaY * ORBIT_SENSITIVITY, MIN_PITCH, MAX_PITCH);
    }

    /** Return to the framing that matches the 2D camera. */
    resetOrbit(): void {
        this.yaw = 0;
        this.pitch = DEFAULT_PITCH;
    }

    /**
     * Distance needed so the ground strip visible down the middle of the screen spans `worldDepth`
     * units, which is what the 2D camera showed at the current zoom.
     */
    private distanceForDepth(worldDepth: number): number {
        const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
        const p = this.pitch;
        // Ground reach of a frustum edge is height * cot(its angle below horizontal). Only the top edge
        // needs guarding, against grazing the horizon; past vertical the bottom edge's cotangent goes
        // negative on its own, which correctly widens the strip rather than pinning it at the nadir.
        const top = Math.max(p - halfFov, THREE.MathUtils.degToRad(6));
        const bottom = p + halfFov;
        const spread = 1 / Math.tan(top) - 1 / Math.tan(bottom);
        if (spread <= 1e-4) return worldDepth;
        return worldDepth / (Math.sin(p) * spread);
    }

    sync(camera2D: Camera2DState, viewportWidth: number, viewportHeight: number): void {
        this.viewportWidth = Math.max(1, viewportWidth);
        this.viewportHeight = Math.max(1, viewportHeight);
        const zoom = camera2D.zoom > 0 ? camera2D.zoom : 1;

        const centreX = camera2D.x + this.viewportWidth / (2 * zoom);
        const centreZ = camera2D.y + this.viewportHeight / (2 * zoom);
        this.target.set(centreX, 0, centreZ);

        const distance = this.distanceForDepth(this.viewportHeight / zoom);
        const horizontal = Math.cos(this.pitch) * distance;
        // The camera sits opposite the direction it looks, so at yaw 0 it must be at *greater* z than
        // the target for world +y to run down the screen and world +x to run right, as it does in 2D.
        const offsetX = Math.sin(this.yaw) * horizontal;
        const offsetZ = Math.cos(this.yaw) * horizontal;

        // Camera shake is a screen-space nudge in 2D; convert it to world units so it reads the same.
        const shakeX = (camera2D.shakeOffsetX ?? 0) / zoom;
        const shakeZ = (camera2D.shakeOffsetY ?? 0) / zoom;

        this.camera.aspect = this.viewportWidth / this.viewportHeight;
        this.camera.position.set(
            centreX + offsetX + shakeX,
            Math.sin(this.pitch) * distance,
            centreZ + offsetZ + shakeZ
        );
        this.camera.far = Math.max(4000, distance * 4);
        this.camera.near = Math.max(1, distance / 200);
        this.camera.updateProjectionMatrix();
        this.camera.lookAt(centreX + shakeX, 0, centreZ + shakeZ);
        this.camera.updateMatrixWorld();
    }

    /** Canvas pixel coordinates to the world point under the cursor on the ground plane. */
    screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        this.ndc.set((screenX / this.viewportWidth) * 2 - 1, -((screenY / this.viewportHeight) * 2 - 1));
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const point = this.raycaster.ray.intersectPlane(GROUND_PLANE, this.hit);
        if (!point) {
            // Ray parallel to (or above) the ground: project far along the ray so aiming stays usable.
            const fallback = this.raycaster.ray.at(10000, this.hit);
            return { x: fallback.x, y: fallback.z };
        }
        return { x: point.x, y: point.z };
    }

    /** World ground position to canvas pixel coordinates. */
    worldToScreen(worldX: number, worldY: number, worldHeight = 0): { x: number; y: number } {
        this.hit.set(worldX, worldHeight, worldY).project(this.camera);
        return {
            x: (this.hit.x * 0.5 + 0.5) * this.viewportWidth,
            y: (-this.hit.y * 0.5 + 0.5) * this.viewportHeight,
        };
    }
}
