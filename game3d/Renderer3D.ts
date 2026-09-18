// The 3D world renderer.
//
// This owns the WebGL canvas that sits behind the existing 2D canvas. The simulation is untouched: the
// renderer reads the same managers and components the 2D renderers read and mirrors them into a three.js
// scene. Screen-space UI (HUD, inventory, minimap, menus) keeps being drawn by the 2D canvas on top.
//
// A frame is: beginFrame() -> a series of sync* calls driven by Game.render() -> endFrame(), which
// hides anything not touched this frame and draws the scene.
import * as THREE from 'three';
import { CameraRig3D, type Camera2DState } from './core/CameraRig3D.js';
import { Atmosphere3D, type LevelTheme } from './world/Atmosphere3D.js';
import { TerrainRenderer3D } from './world/TerrainRenderer3D.js';
import { ObstacleRenderer3D, type ObstacleManagerLike } from './world/ObstacleRenderer3D.js';
import { InteractableRenderer3D, type PortalLike, type RectLike } from './world/InteractableRenderer3D.js';
import { CharacterRenderer3D, type EntityLike } from './characters/CharacterRenderer3D.js';
import { DecalRenderer3D } from './fx/DecalRenderer3D.js';
import { emitCombatTelegraphs } from './fx/CombatTelegraphs3D.js';
import {
    EffectsRenderer3D,
    type DamageNumberLike,
    type FlamePillarLike,
    type GatherableLike,
    type PickupLike,
    type ProjectileLike,
} from './fx/EffectsRenderer3D.js';

export interface Renderer3DOptions {
    /** Existing 2D canvas; the WebGL canvas is inserted behind it and kept the same size. */
    overlayCanvas: HTMLCanvasElement;
    getGroundTexture: (id: string) => HTMLImageElement | null;
}

export class Renderer3D {
    readonly canvas: HTMLCanvasElement;
    readonly cameraRig = new CameraRig3D();
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly world = new THREE.Group();
    private readonly atmosphere: Atmosphere3D;
    private readonly terrain: TerrainRenderer3D;
    private readonly obstacles: ObstacleRenderer3D;
    private readonly characters: CharacterRenderer3D;
    private readonly interactables: InteractableRenderer3D;
    private readonly decals: DecalRenderer3D;
    private readonly effects: EffectsRenderer3D;

    private readonly overlayCanvas: HTMLCanvasElement;
    private sizedWidth = 0;
    private sizedHeight = 0;
    private startTime = performance.now();
    private lastFrameTime = performance.now();
    private time = 0;
    private delta = 0;
    private frameOpen = false;
    /** View rectangle in world units for this frame, used for culling and shadow fitting. */
    private view = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    constructor(options: Renderer3DOptions) {
        this.overlayCanvas = options.overlayCanvas;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'gameCanvas3D';
        this.canvas.setAttribute('aria-hidden', 'true');
        options.overlayCanvas.parentElement?.insertBefore(this.canvas, options.overlayCanvas);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        this.scene.add(this.world);
        this.atmosphere = new Atmosphere3D(this.scene);
        this.terrain = new TerrainRenderer3D(this.world, options.getGroundTexture);
        this.obstacles = new ObstacleRenderer3D(this.world);
        this.characters = new CharacterRenderer3D(this.world);
        this.interactables = new InteractableRenderer3D(this.world);
        this.decals = new DecalRenderer3D(this.world);
        this.effects = new EffectsRenderer3D(this.world);
    }

    setVisible(visible: boolean): void {
        this.canvas.style.display = visible ? '' : 'none';
        // The 2D canvas keeps its own opaque background when it is the only thing drawing the world.
        document.body.classList.toggle('render-3d', visible);
    }

    /** Match the WebGL canvas to the 2D canvas and update the camera for this frame. */
    beginFrame(camera2D: Camera2DState): void {
        const width = this.overlayCanvas.width;
        const height = this.overlayCanvas.height;
        // Compared against the requested size rather than canvas.width, which the pixel ratio scales.
        if (this.sizedWidth !== width || this.sizedHeight !== height) {
            this.renderer.setSize(width, height, false);
            this.sizedWidth = width;
            this.sizedHeight = height;
        }

        const now = performance.now();
        this.delta = Math.min(0.1, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;
        this.time = (now - this.startTime) / 1000;

        this.cameraRig.sync(camera2D, width, height);

        // The 2D camera's visible rectangle, which is what obstacle culling should follow.
        const zoom = camera2D.zoom > 0 ? camera2D.zoom : 1;
        this.view = {
            minX: camera2D.x,
            minY: camera2D.y,
            maxX: camera2D.x + width / zoom,
            maxY: camera2D.y + height / zoom,
        };

        this.interactables.begin();
        this.decals.begin();
        this.frameOpen = true;
    }

    syncTerrain(
        level: number,
        worldWidth: number,
        worldHeight: number,
        tileSize: number,
        theme: LevelTheme | null | undefined,
        useEnvironmentSprites: boolean
    ): void {
        this.atmosphere.apply(level, theme);
        this.terrain.sync(level, worldWidth, worldHeight, tileSize, theme?.ground, useEnvironmentSprites);
    }

    syncObstacles(obstacleManager: ObstacleManagerLike | null | undefined): void {
        this.obstacles.sync(obstacleManager, this.view, this.time);
    }

    syncEntities(
        entities: EntityLike[] | null | undefined,
        settings: Record<string, unknown>,
        playerClass: string | undefined
    ): void {
        this.characters.sync(entities, settings, playerClass, this.time, this.delta);
        const player = this.characters.playerPosition;
        emitCombatTelegraphs(
            this.decals,
            entities,
            settings,
            player ? { x: player.x, y: player.z } : null
        );
    }

    syncPortal(portal: PortalLike | null | undefined, isStairs: boolean, key?: string): void {
        this.interactables.syncPortal(portal, isStairs, this.time, key);
    }

    syncRecallPortal(portal: PortalLike | null | undefined): void {
        this.interactables.syncRecallPortal(portal, this.time);
    }

    syncChest(chest: RectLike | null | undefined): void {
        this.interactables.syncChest(chest);
    }

    syncShopkeeper(shop: RectLike | null | undefined, playerWorldPos: { x: number; y: number } | null): void {
        this.interactables.syncShopkeeper(shop, playerWorldPos);
    }

    syncBoard(board: RectLike | null | undefined): void {
        this.interactables.syncBoard(board);
    }

    syncStation(station: RectLike | null | undefined, variant: 'reroll' | 'crafting'): void {
        this.interactables.syncStation(station, variant, this.time);
    }

    queuePrompt(key: string, rect: RectLike, lines: string[], channelProgress = 0): void {
        this.interactables.queuePrompt(key, rect, lines, channelProgress);
    }

    syncProjectiles(projectiles: ProjectileLike[] | null | undefined): void {
        this.effects.syncProjectiles(projectiles, this.time);
    }

    syncPickups(pickups: PickupLike[] | null | undefined): void {
        this.effects.syncPickups(pickups, this.time);
    }

    syncGatherables(gatherables: GatherableLike[] | null | undefined): void {
        this.effects.syncGatherables(gatherables, this.time);
    }

    syncHazards(pillars: FlamePillarLike[] | null | undefined): void {
        this.effects.syncHazards(pillars, this.time);
    }

    syncDamageNumbers(numbers: DamageNumberLike[] | null | undefined): void {
        this.effects.syncDamageNumbers(numbers);
    }

    /** Reconcile pools, fit the shadow camera and draw. */
    endFrame(): void {
        if (!this.frameOpen) return;
        this.frameOpen = false;
        this.interactables.end();
        this.decals.end();

        const viewRadius = Math.hypot(this.view.maxX - this.view.minX, this.view.maxY - this.view.minY) / 2;
        this.atmosphere.update(this.cameraRig.getTarget(), viewRadius, this.characters.playerPosition);

        this.renderer.render(this.scene, this.cameraRig.camera);
    }

    /** Drop level-specific objects when the world is regenerated. */
    onLevelChanged(): void {
        this.obstacles.clear();
        this.characters.clear();
        this.interactables.clear();
    }

    dispose(): void {
        this.terrain.dispose();
        this.obstacles.dispose();
        this.characters.dispose();
        this.interactables.dispose();
        this.decals.dispose();
        this.effects.dispose();
        this.renderer.dispose();
        this.canvas.remove();
        document.body.classList.remove('render-3d');
    }
}
