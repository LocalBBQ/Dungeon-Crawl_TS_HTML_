// Render System - orchestrates layer renderers.
import { WorldLayerRenderer } from './renderers/WorldLayerRenderer.js';
import { ObstacleLayerRenderer } from './renderers/ObstacleLayerRenderer.js';
import { PortalRenderer } from './renderers/PortalRenderer.js';
import { BoardRenderer } from './renderers/BoardRenderer.js';
import { ChestRenderer } from './renderers/ChestRenderer.js';
import { ShopkeeperRenderer } from './renderers/ShopkeeperRenderer.js';
import { RerollStationRenderer } from './renderers/RerollStationRenderer.js';
import { EntityLayerRenderer } from './renderers/EntityLayerRenderer.js';
import { MinimapRenderer } from './renderers/MinimapRenderer.js';
import { createRenderContext } from './renderers/RenderContext.js';
import type { SystemManager } from '../core/SystemManager.js';
import type { EntityShape } from '../types/entity.js';
import type { CameraShape } from '../types/camera.js';

export class RenderSystem {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    settings: Record<string, unknown> | null;
    systems: SystemManager | null;
    worldLayer: WorldLayerRenderer;
    obstacleLayer: ObstacleLayerRenderer;
    portalRenderer: PortalRenderer;
    boardRenderer: BoardRenderer;
    chestRenderer: ChestRenderer;
    shopkeeperRenderer: ShopkeeperRenderer;
    rerollStationRenderer: RerollStationRenderer;
    entityLayer: EntityLayerRenderer;
    minimapRenderer: MinimapRenderer;

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.settings = null;
        this.systems = null;
        this.worldLayer = new WorldLayerRenderer();
        this.obstacleLayer = new ObstacleLayerRenderer();
        this.portalRenderer = new PortalRenderer();
        this.boardRenderer = new BoardRenderer();
        this.chestRenderer = new ChestRenderer();
        this.shopkeeperRenderer = new ShopkeeperRenderer();
        this.rerollStationRenderer = new RerollStationRenderer();
        this.entityLayer = new EntityLayerRenderer();
        this.minimapRenderer = new MinimapRenderer();
    }

    init(systems: SystemManager): void {
        this.systems = systems;
    }

    clear() {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _getContext(camera) {
        const settings = this.settings != null ? this.settings : {};
        return createRenderContext(this.ctx, this.canvas, camera, this.systems, settings);
    }

    /** Draw world + non-depth obstacles only. Depth-sort obstacles (trees, etc.) are drawn with entities in renderEntities. */
    renderWorld(camera, obstacleManager, currentLevel = 1, worldWidth = null, worldHeight = null) {
        const context = this._getContext(camera);
        this.worldLayer.render(context, { currentLevel, worldWidth, worldHeight });
        if (obstacleManager) {
            this.obstacleLayer.render(context, { obstacleManager, currentLevel, playerY: null, phase: 'noDepth' });
        }
    }

    renderPortal(
        portal: unknown,
        camera: unknown,
        playerNearPortal?: boolean,
        promptLines?: string[],
        isStairs?: boolean,
        channelProgress?: number,
        skipInteractionPrompt?: boolean,
        interactionPromptOnly?: boolean
    ) {
        this.portalRenderer.render(this._getContext(camera), {
            portal,
            playerNearPortal,
            promptLines,
            isStairs,
            channelProgress,
            skipInteractionPrompt,
            interactionPromptOnly
        });
    }

    renderPortalInteractionPrompt(portal: unknown, camera: unknown, showPrompt: boolean, promptLines?: string[], isStairs?: boolean, channelProgress?: number) {
        this.portalRenderer.render(this._getContext(camera), {
            portal,
            playerNearPortal: showPrompt,
            promptLines,
            isStairs,
            channelProgress,
            interactionPromptOnly: true
        });
    }

    renderRecallPortal(
        recallPortal: { x: number; y: number; width: number; height: number; spawned: boolean },
        camera: { x: number; y: number; zoom: number },
        playerNearRecallPortal: boolean,
        channelProgress: number,
        promptLines?: string[],
        skipInteractionPrompt?: boolean,
        interactionPromptOnly?: boolean
    ) {
        this.portalRenderer.renderRecallPortal(this._getContext(camera), {
            recallPortal,
            playerNearRecallPortal,
            channelProgress,
            promptLines,
            skipInteractionPrompt,
            interactionPromptOnly
        });
    }

    renderSceneEntrancePrompt(worldRect: { x: number; y: number; width: number; height: number }, camera, channelProgress?: number) {
        this.portalRenderer.renderPromptAtRect(this._getContext(camera), { worldRect, promptLines: ['E Enter'], channelProgress: channelProgress ?? 0 });
    }

    /** Interior exit: prompt only, no channel bar (instant on E). */
    renderSceneExitPrompt(worldRect: { x: number; y: number; width: number; height: number }, camera) {
        this.portalRenderer.renderPromptAtRect(this._getContext(camera), { worldRect, promptLines: ['E Leave'], channelProgress: 0 });
    }

    // Backward-compatible wrappers.
    renderCaveEntrancePrompt(worldRect: { x: number; y: number; width: number; height: number }, camera, channelProgress?: number) {
        this.renderSceneEntrancePrompt(worldRect, camera, channelProgress);
    }

    renderCaveExitPrompt(worldRect: { x: number; y: number; width: number; height: number }, camera) {
        this.renderSceneExitPrompt(worldRect, camera);
    }

    renderBoard(
        board: unknown,
        camera: unknown,
        playerNearBoard: boolean,
        opts?: { skipInteractionPrompt?: boolean; interactionPromptOnly?: boolean }
    ) {
        this.boardRenderer.render(this._getContext(camera), { board, playerNearBoard, ...opts });
    }

    renderBoardInteractionPrompt(board: unknown, camera: unknown, showPrompt: boolean) {
        this.boardRenderer.render(this._getContext(camera), { board, playerNearBoard: showPrompt, interactionPromptOnly: true });
    }

    renderChest(
        chest: unknown,
        camera: unknown,
        playerNearChest: boolean,
        opts?: { skipInteractionPrompt?: boolean; interactionPromptOnly?: boolean }
    ) {
        this.chestRenderer.render(this._getContext(camera), { chest, playerNearChest, ...opts });
    }

    renderChestInteractionPrompt(chest: unknown, camera: unknown, showPrompt: boolean) {
        this.chestRenderer.render(this._getContext(camera), { chest, playerNearChest: showPrompt, interactionPromptOnly: true });
    }

    renderShopkeeper(
        shop: unknown,
        camera: unknown,
        playerNearShop: boolean,
        playerWorldPos?: { x: number; y: number } | null,
        opts?: { skipInteractionPrompt?: boolean; interactionPromptOnly?: boolean }
    ) {
        this.shopkeeperRenderer.render(this._getContext(camera), { shop, playerNearShop, playerWorldPos, ...opts });
    }

    renderRerollStation(
        rerollStation: unknown,
        camera: unknown,
        playerNearRerollStation: boolean,
        opts?: { skipInteractionPrompt?: boolean; interactionPromptOnly?: boolean; interactionPromptText?: string }
    ) {
        this.rerollStationRenderer.render(this._getContext(camera), { rerollStation, playerNearRerollStation, ...opts });
    }

    /** Draw entities and depth-sort obstacles (trees, etc.) interleaved by Y so layering respects player and enemies. */
    renderEntities(entities: unknown, camera: { x: number; y: number; zoom: number }, obstacleManager: unknown = null, currentLevel = 1): void {
        const context = this._getContext(camera);
        const data: { entities: unknown; obstacleManager?: unknown; obstacleLayerRenderer?: unknown } = { entities };
        if (obstacleManager) {
            data.obstacleManager = obstacleManager;
            data.obstacleLayerRenderer = this.obstacleLayer;
        }
        this.entityLayer.render(context, data as { entities?: EntityShape[]; obstacleManager?: { obstacles: unknown[] }; obstacleLayerRenderer?: ObstacleLayerRenderer });
    }

    renderMinimap(camera, entityManager, worldWidth, worldHeight, portal = null, currentLevel = 1, activeQuest = null, questSurviveStartTime?: number) {
        this.minimapRenderer.render(this._getContext(camera), {
            entityManager,
            worldWidth,
            worldHeight,
            portal,
            currentLevel,
            activeQuest,
            questSurviveStartTime
        });
    }

    /** Draw overlay layer: projectiles, pickups, damage numbers (fixed order). */
    renderOverlay(ctx: CanvasRenderingContext2D, camera: { x: number; y: number; zoom: number }): void {
        if (!this.systems) return;
        const typed = this.systems.getTyped();
        const cam = camera as CameraShape;
        if (typed.projectiles) typed.projectiles.render(ctx, cam);
        if (typed.pickups) typed.pickups.render(ctx, cam);
        if (typed.damageNumbers) typed.damageNumbers.render(ctx, cam);
    }
  }
