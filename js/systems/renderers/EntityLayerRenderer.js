// Entity layer: orchestrator only. Delegates to EntitySpriteRenderer, EnemyEntityRenderer, PlayerEntityRenderer.
// Shared effects (shadow, vial, tags, bars) in EntityEffectsRenderer.js.
// When obstacleManager + obstacleLayerRenderer are provided, depth-sort obstacles (trees, etc.) and entities by Y
// so that tree layering respects both player and enemies (things further down screen draw on top).
// See ENTITY_LAYER_REFACTOR.md for structure.
class EntityLayerRenderer {
    constructor() {
        this._spriteRenderer = null;
    }

    /** Draw a single entity (used when interleaving with depth obstacles by Y). */
    drawOneEntity(context, entity, screenX, screenY) {
        const { systems, settings } = context;
        const renderable = entity.getComponent(Renderable);
        if (!renderable) return;
        const spriteManager = systems ? systems.get('sprites') : null;
        const useCharacterSprites = !settings || settings.useCharacterSprites !== false;
        const sprite = entity.getComponent(Sprite);
        const isCharacter = renderable.type === 'enemy';
        try {
            if (renderable.type === 'player') {
                if (typeof PlayerEntityRenderer !== 'undefined') {
                    PlayerEntityRenderer.render(context, entity, screenX, screenY);
                }
                return;
            }
            if (sprite && spriteManager && (useCharacterSprites || !isCharacter)) {
                if (!this._spriteRenderer && typeof EntitySpriteRenderer !== 'undefined') this._spriteRenderer = new EntitySpriteRenderer();
                if (this._spriteRenderer) this._spriteRenderer.render(context, entity, screenX, screenY);
            } else if (renderable.type === 'enemy' && typeof EnemyEntityRenderer !== 'undefined') {
                EnemyEntityRenderer.render(context, entity, screenX, screenY);
            }
        } catch (err) {
            console.warn('Render entity failed (skipping):', entity.id || renderable.type, err);
        }
    }

    render(context, data) {
        const { entities, obstacleManager, obstacleLayerRenderer } = data;
        if (!entities) return;

        const { ctx, canvas, camera, systems, settings } = context;
        const useCharacterSprites = !settings || settings.useCharacterSprites !== false;

        // Y-sorted interleave: depth obstacles (trees, etc.) + entities so layering respects all entities
        if (obstacleManager && obstacleLayerRenderer) {
            this._renderWithDepthObstacles(context, data);
            return;
        }

        // Legacy path: no obstacleManager — draw all non-player entities then player last
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
                    if (!this._spriteRenderer && typeof EntitySpriteRenderer !== 'undefined') this._spriteRenderer = new EntitySpriteRenderer();
                    if (this._spriteRenderer) this._spriteRenderer.render(context, entity, screenX, screenY);
                } else if (renderable.type === 'enemy' && typeof EnemyEntityRenderer !== 'undefined') {
                    EnemyEntityRenderer.render(context, entity, screenX, screenY);
                }
            } catch (err) {
                console.warn('Render entity failed (skipping):', entity.id || renderable.type, err);
            }
        }

        if (playerDraw && typeof PlayerEntityRenderer !== 'undefined') {
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

if (typeof window !== 'undefined') {
    window.EntityLayerRenderer = EntityLayerRenderer;
}
