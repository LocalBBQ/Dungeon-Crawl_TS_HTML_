// Render System - orchestrates layer renderers.
import { WorldLayerRenderer } from './renderers/WorldLayerRenderer.ts';
import { ObstacleLayerRenderer } from './renderers/ObstacleLayerRenderer.ts';
import { PortalRenderer } from './renderers/PortalRenderer.ts';
import { BoardRenderer } from './renderers/BoardRenderer.ts';
import { ChestRenderer } from './renderers/ChestRenderer.ts';
import { ShopkeeperRenderer } from './renderers/ShopkeeperRenderer.ts';
import { RerollStationRenderer } from './renderers/RerollStationRenderer.ts';
import { EntityLayerRenderer } from './renderers/EntityLayerRenderer.ts';
import { MinimapRenderer } from './renderers/MinimapRenderer.ts';
import { createRenderContext } from './renderers/RenderContext.ts';
import type { SystemManager } from '../core/SystemManager.ts';

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

    renderPortal(portal, camera, playerNearPortal?, promptLines?: string[], isStairs?: boolean, channelProgress?: number) {
        this.portalRenderer.render(this._getContext(camera), { portal, playerNearPortal, promptLines, isStairs, channelProgress });
    }

    renderPortalInteractionPrompt(portal, camera, showPrompt, promptLines?: string[], isStairs?: boolean, channelProgress?: number) {
        this.portalRenderer.render(this._getContext(camera), { portal, playerNearPortal: showPrompt, promptLines, isStairs, channelProgress });
    }

    renderBoard(board, camera, playerNearBoard) {
        this.boardRenderer.render(this._getContext(camera), { board, playerNearBoard });
    }

    renderBoardInteractionPrompt(board, camera, showPrompt) {
        this.boardRenderer.render(this._getContext(camera), { board, playerNearBoard: showPrompt });
    }

    renderChest(chest, camera, playerNearChest) {
        this.chestRenderer.render(this._getContext(camera), { chest, playerNearChest });
    }

    renderChestInteractionPrompt(chest, camera, showPrompt) {
        this.chestRenderer.render(this._getContext(camera), { chest, playerNearChest: showPrompt });
    }

    renderShopkeeper(shop, camera, playerNearShop) {
        this.shopkeeperRenderer.render(this._getContext(camera), { shop, playerNearShop });
    }

    renderRerollStation(rerollStation, camera, playerNearRerollStation) {
        this.rerollStationRenderer.render(this._getContext(camera), { rerollStation, playerNearRerollStation });
    }

    /** Draw entities and depth-sort obstacles (trees, etc.) interleaved by Y so layering respects player and enemies. */
    renderEntities(entities, camera, obstacleManager = null, currentLevel = 1) {
        const context = this._getContext(camera);
        const data = { entities };
        if (obstacleManager) {
            data.obstacleManager = obstacleManager;
            data.obstacleLayerRenderer = this.obstacleLayer;
        }
        this.entityLayer.render(context, data);
    }

    renderMinimap(camera, entityManager, worldWidth, worldHeight, portal = null, currentLevel = 1) {
        this.minimapRenderer.render(this._getContext(camera), {
            entityManager,
            worldWidth,
            worldHeight,
            portal,
            currentLevel
        });
    }
  }
