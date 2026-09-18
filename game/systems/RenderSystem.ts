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
import { GameConfig } from '../config/GameConfig.js';
import type { SystemManager } from '../core/SystemManager.js';
import type { EntityShape } from '../types/entity.js';
import type { CameraShape } from '../types/camera.js';
import type { Renderer3D } from '../../game3d/Renderer3D.js';

export class RenderSystem {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    settings: Record<string, unknown> | null;
    systems: SystemManager | null;
    /**
     * When set, world geometry is mirrored into a three.js scene instead of being drawn to the 2D
     * canvas. Screen-space UI still draws to the 2D canvas, which sits on top of the WebGL one.
     */
    renderer3D: Renderer3D | null = null;
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

    /** True while the world is being drawn in 3D. */
    get is3D(): boolean {
        return this.renderer3D !== null;
    }

    clear() {
        if (this.renderer3D) {
            // The WebGL canvas behind supplies the background; keep the 2D canvas transparent for UI.
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _getContext(camera) {
        const settings = this.settings != null ? this.settings : {};
        return createRenderContext(this.ctx, this.canvas, camera, this.systems, settings);
    }

    /** Draw world + non-depth obstacles only. Depth-sort obstacles (trees, etc.) are drawn with entities in renderEntities. */
    renderWorld(camera, obstacleManager, currentLevel = 1, worldWidth = null, worldHeight = null) {
        if (this.renderer3D) {
            // First world call of the frame, so this is where the 3D frame opens.
            this.renderer3D.beginFrame(camera);
            const isHub = currentLevel === 0;
            const levelConfig = isHub ? GameConfig.hub : GameConfig.levels?.[currentLevel];
            const size = this._resolveWorldSize(currentLevel, worldWidth, worldHeight);
            const tileSize = isHub && GameConfig.hub.tileSize ? GameConfig.hub.tileSize : GameConfig.world.tileSize;
            const useEnvironmentSprites = !this.settings || this.settings.useEnvironmentSprites !== false;
            this.renderer3D.syncTerrain(currentLevel, size.width, size.height, tileSize, levelConfig?.theme, useEnvironmentSprites);
            this.renderer3D.syncObstacles(obstacleManager);
            return;
        }
        const context = this._getContext(camera);
        this.worldLayer.render(context, { currentLevel, worldWidth, worldHeight });
        if (obstacleManager) {
            this.obstacleLayer.render(context, { obstacleManager, currentLevel, playerY: null, phase: 'noDepth' });
        }
    }

    /** Level bounds for the 3D ground plane, falling back to the level config then the world default. */
    private _resolveWorldSize(
        currentLevel: number,
        worldWidth: number | null,
        worldHeight: number | null
    ): { width: number; height: number } {
        if (worldWidth != null && worldHeight != null) return { width: worldWidth, height: worldHeight };
        const levelConfig = (currentLevel === 0 ? GameConfig.hub : GameConfig.levels?.[currentLevel]) as
            | { width?: number; height?: number; worldWidth?: number; worldHeight?: number }
            | undefined;
        return {
            width: levelConfig?.worldWidth ?? levelConfig?.width ?? GameConfig.world.width,
            height: levelConfig?.worldHeight ?? levelConfig?.height ?? GameConfig.world.height,
        };
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
        if (this.renderer3D) {
            if (!interactionPromptOnly) this.renderer3D.syncPortal(portal as never, isStairs === true);
            if (playerNearPortal && !skipInteractionPrompt) {
                this._queuePortalPrompt(portal, promptLines, isStairs, channelProgress ?? 0);
            }
            return;
        }
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
        if (this.renderer3D) {
            if (showPrompt) this._queuePortalPrompt(portal, promptLines, isStairs, channelProgress ?? 0);
            return;
        }
        this.portalRenderer.render(this._getContext(camera), {
            portal,
            playerNearPortal: showPrompt,
            promptLines,
            isStairs,
            channelProgress,
            interactionPromptOnly: true
        });
    }

    private _queuePortalPrompt(portal: unknown, promptLines: string[] | undefined, isStairs: boolean | undefined, channelProgress: number) {
        const rect = portal as { x: number; y: number; width: number; height: number; hasNextLevel?: boolean } | null;
        if (!rect || !this.renderer3D) return;
        const lines = promptLines ?? [isStairs ? 'E Descend' : rect.hasNextLevel === false ? 'E Return' : 'E Enter'];
        this.renderer3D.queuePrompt('prompt:portal', rect, lines, channelProgress);
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
        if (this.renderer3D) {
            if (!interactionPromptOnly) this.renderer3D.syncRecallPortal(recallPortal);
            if (playerNearRecallPortal && !skipInteractionPrompt) {
                this.renderer3D.queuePrompt('prompt:recall', recallPortal, promptLines ?? ['E Recall'], channelProgress);
            }
            return;
        }
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
        if (this.renderer3D) {
            this.renderer3D.queuePrompt('prompt:sceneEntrance', worldRect, ['E Enter'], channelProgress ?? 0);
            return;
        }
        this.portalRenderer.renderPromptAtRect(this._getContext(camera), { worldRect, promptLines: ['E Enter'], channelProgress: channelProgress ?? 0 });
    }

    /** Interior exit: prompt only, no channel bar (instant on E). */
    renderSceneExitPrompt(worldRect: { x: number; y: number; width: number; height: number }, camera) {
        if (this.renderer3D) {
            this.renderer3D.queuePrompt('prompt:sceneExit', worldRect, ['E Leave'], 0);
            return;
        }
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
        if (this.renderer3D) {
            if (!opts?.interactionPromptOnly) this.renderer3D.syncBoard(board as never);
            if (playerNearBoard && !opts?.skipInteractionPrompt) {
                this.renderer3D.queuePrompt('prompt:board', board as never, ['E Quest board']);
            }
            return;
        }
        this.boardRenderer.render(this._getContext(camera), { board, playerNearBoard, ...opts });
    }

    renderBoardInteractionPrompt(board: unknown, camera: unknown, showPrompt: boolean) {
        if (this.renderer3D) {
            if (showPrompt) this.renderer3D.queuePrompt('prompt:board', board as never, ['E Quest board']);
            return;
        }
        this.boardRenderer.render(this._getContext(camera), { board, playerNearBoard: showPrompt, interactionPromptOnly: true });
    }

    renderChest(
        chest: unknown,
        camera: unknown,
        playerNearChest: boolean,
        opts?: { skipInteractionPrompt?: boolean; interactionPromptOnly?: boolean }
    ) {
        if (this.renderer3D) {
            if (!opts?.interactionPromptOnly) this.renderer3D.syncChest(chest as never);
            if (playerNearChest && !opts?.skipInteractionPrompt) {
                this.renderer3D.queuePrompt('prompt:chest', chest as never, ['E Equipment']);
            }
            return;
        }
        this.chestRenderer.render(this._getContext(camera), { chest, playerNearChest, ...opts });
    }

    renderChestInteractionPrompt(chest: unknown, camera: unknown, showPrompt: boolean) {
        if (this.renderer3D) {
            if (showPrompt) this.renderer3D.queuePrompt('prompt:chest', chest as never, ['E Equipment']);
            return;
        }
        this.chestRenderer.render(this._getContext(camera), { chest, playerNearChest: showPrompt, interactionPromptOnly: true });
    }

    renderShopkeeper(
        shop: unknown,
        camera: unknown,
        playerNearShop: boolean,
        playerWorldPos?: { x: number; y: number } | null,
        opts?: { skipInteractionPrompt?: boolean; interactionPromptOnly?: boolean }
    ) {
        if (this.renderer3D) {
            if (!opts?.interactionPromptOnly) this.renderer3D.syncShopkeeper(shop as never, playerWorldPos ?? null);
            if (playerNearShop && !opts?.skipInteractionPrompt) {
                this.renderer3D.queuePrompt('prompt:shop', shop as never, ['E Trade']);
            }
            return;
        }
        this.shopkeeperRenderer.render(this._getContext(camera), { shop, playerNearShop, playerWorldPos, ...opts });
    }

    renderRerollStation(
        rerollStation: unknown,
        camera: unknown,
        playerNearRerollStation: boolean,
        opts?: {
            skipInteractionPrompt?: boolean;
            interactionPromptOnly?: boolean;
            interactionPromptText?: string;
            /** Distinguishes the hub's two stations, which otherwise share this renderer. */
            variant?: 'reroll' | 'crafting';
        }
    ) {
        if (this.renderer3D) {
            const variant = opts?.variant ?? 'reroll';
            if (!opts?.interactionPromptOnly) this.renderer3D.syncStation(rerollStation as never, variant);
            if (playerNearRerollStation && !opts?.skipInteractionPrompt) {
                const text = opts?.interactionPromptText ?? 'Press E to reroll enchantments';
                this.renderer3D.queuePrompt(`prompt:station:${variant}`, rerollStation as never, [text]);
            }
            return;
        }
        this.rerollStationRenderer.render(this._getContext(camera), { rerollStation, playerNearRerollStation, ...opts });
    }

    /** Draw entities and depth-sort obstacles (trees, etc.) interleaved by Y so layering respects player and enemies. */
    renderEntities(entities: unknown, camera: { x: number; y: number; zoom: number }, obstacleManager: unknown = null, currentLevel = 1): void {
        if (this.renderer3D) {
            // Depth ordering is handled by the depth buffer, so obstacles stay in renderWorld.
            const playingState = this.systems?.get?.('playingState') as { playerClass?: string } | undefined;
            this.renderer3D.syncEntities(entities as never, this.settings ?? {}, playingState?.playerClass);
            return;
        }
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
        if (this.renderer3D) {
            this.renderer3D.syncProjectiles(typed.projectiles?.projectiles as never);
            this.renderer3D.syncPickups(typed.pickups?.items as never);
            this.renderer3D.syncDamageNumbers(typed.damageNumbers?.damageNumbers as never);
            return;
        }
        const cam = camera as CameraShape;
        if (typed.projectiles) typed.projectiles.render(ctx, cam);
        if (typed.pickups) typed.pickups.render(ctx, cam);
        if (typed.damageNumbers) typed.damageNumbers.render(ctx, cam);
    }

    /** Gatherables and hazards are drawn by their managers in 2D; mirror them into the 3D scene. */
    renderWorldManagers(gatherables: { items?: unknown[] } | null, hazards: { flamePillars?: unknown[] } | null): void {
        if (!this.renderer3D) return;
        this.renderer3D.syncGatherables(gatherables?.items as never);
        this.renderer3D.syncHazards(hazards?.flamePillars as never);
    }

    /** Present the 3D frame. Called once per frame after all world and UI drawing. */
    present(): void {
        this.renderer3D?.endFrame();
    }
  }
