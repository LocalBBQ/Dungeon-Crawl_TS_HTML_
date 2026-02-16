// Entity layer: orchestrator. Delegates to EntitySpriteRenderer, EnemyEntityRenderer, PlayerEntityRenderer.
import { Transform } from '../../components/Transform.ts';
import { Renderable } from '../../components/Renderable.ts';
import { Sprite } from '../../components/Sprite.ts';
import type { RenderContext } from './RenderContext.ts';
import type { EntityShape } from '../../types/entity.ts';
import { PlayerEntityRenderer } from './PlayerEntityRenderer.ts';
import { EnemyEntityRenderer } from './EnemyEntityRenderer.ts';
import { EntitySpriteRenderer } from './EntitySpriteRenderer.ts';
import type { ObstacleLayerRenderer } from './ObstacleLayerRenderer.ts';
import { AI } from '../../components/AI.ts';

export class EntityLayerRenderer {
    _spriteRenderer: InstanceType<typeof EntitySpriteRenderer> | null = null;

    /** Draw a single entity (used when interleaving with depth obstacles by Y). */
    drawOneEntity(context: RenderContext, entity: EntityShape, screenX: number, screenY: number): void {
        const { systems, settings } = context;
        const renderable = entity.getComponent(Renderable);
        if (!renderable) return;
        const spriteManager = systems ? systems.get('sprites') : null;
        const useCharacterSprites = !settings || settings.useCharacterSprites !== false;
        const sprite = entity.getComponent(Sprite);
        const isCharacter = renderable.type === 'enemy';
        try {
            if (renderable.type === 'player') {
                PlayerEntityRenderer.render(context, entity, screenX, screenY);
                return;
            }
            if (sprite && spriteManager && (useCharacterSprites || !isCharacter)) {
                if (!this._spriteRenderer) this._spriteRenderer = new EntitySpriteRenderer();
                this._spriteRenderer.render(context, entity, screenX, screenY);
            } else if (renderable.type === 'enemy') {
                EnemyEntityRenderer.render(context, entity, screenX, screenY);
            }
        } catch (err) {
            console.warn('Render entity failed (skipping):', entity.id || renderable.type, err);
        }
    }

    render(context: RenderContext, data: { entities?: EntityShape[]; obstacleManager?: { obstacles: unknown[] }; obstacleLayerRenderer?: ObstacleLayerRenderer }): void {
        const { entities, obstacleManager, obstacleLayerRenderer } = data;
        if (!entities) return;

        const { ctx, canvas, camera, systems, settings } = context;
        const useCharacterSprites = !settings || settings.useCharacterSprites !== false;

        // Y-sorted interleave: depth obstacles (trees, etc.) + entities so layering respects all entities
        if (obstacleManager && obstacleLayerRenderer) {
            this._renderWithDepthObstacles(context, data);
            return;
        }

        // Fallback: no obstacleManager — draw all non-player entities then player last
        const spriteManager = systems ? systems.get('sprites') : null;
        let playerDraw = null;

        for (const entity of entities) {
            if (!entity.active) continue;
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            if (!transform || !renderable) continue;
            const screenX = camera.toScreenX(transform.x);
            const screenY = camera.toScreenY(transform.y);
            if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) continue;

            if (renderable.type === 'player') {
                playerDraw = { entity, screenX, screenY };
                continue;
            }

            const sprite = entity.getComponent(Sprite);
            const isCharacter = renderable.type === 'enemy';
            try {
                if (sprite && spriteManager && (useCharacterSprites || !isCharacter)) {
                    if (!this._spriteRenderer) this._spriteRenderer = new EntitySpriteRenderer();
                    this._spriteRenderer.render(context, entity, screenX, screenY);
                } else if (renderable.type === 'enemy') {
                    EnemyEntityRenderer.render(context, entity, screenX, screenY);
                }
            } catch (err) {
                console.warn('Render entity failed (skipping):', entity.id || renderable.type, err);
            }
        }

        if (playerDraw) {
            const { entity, screenX, screenY } = playerDraw;
            try {
                PlayerEntityRenderer.render(context, entity, screenX, screenY);
            } catch (err) {
                console.warn('Render entity failed (skipping):', entity.id || 'player', err);
            }
        }
    }

    _renderWithDepthObstacles(context, data) {
        const { entities, obstacleManager, obstacleLayerRenderer } = data;
        const { canvas, camera } = context;
        const zoom = camera.zoom;
        const depthSortTypes = ['tree', 'rock', 'pillar', 'brokenPillar', 'column', 'statueBase', 'arch'];

        const margin = 80;
        const viewLeft = camera.x - margin;
        const viewTop = camera.y - margin;
        const viewRight = camera.x + canvas.width / zoom + margin;
        const viewBottom = camera.y + canvas.height / zoom + margin;

        const items = [];

        // Depth obstacles in view with sort Y = center
        for (const obstacle of obstacleManager.obstacles) {
            if (!depthSortTypes.includes(obstacle.type)) continue;
            const obsRight = obstacle.x + obstacle.width;
            const obsBottom = obstacle.y + obstacle.height;
            if (obsRight < viewLeft || obstacle.x > viewRight || obsBottom < viewTop || obstacle.y > viewBottom) continue;
            items.push({ type: 'obstacle', sortY: obstacle.y + obstacle.height / 2, obstacle });
        }

        // Entities in view with sort Y = center (transform.y)
        for (const entity of entities) {
            if (!entity.active) continue;
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            if (!transform || !renderable) continue;
            const screenX = camera.toScreenX(transform.x);
            const screenY = camera.toScreenY(transform.y);
            if (screenX < -50 || screenX > canvas.width + 50 || screenY < -50 || screenY > canvas.height + 50) continue;
            items.push({ type: 'entity', sortY: transform.y, entity, screenX, screenY });
        }

        items.sort((a, b) => a.sortY - b.sortY);

        for (const item of items) {
            if (item.type === 'obstacle') {
                obstacleLayerRenderer.drawOne(context, { obstacle: item.obstacle, obstacleManager });
            } else {
                this.drawOneEntity(context, item.entity, item.screenX, item.screenY);
            }
        }
    }
}

