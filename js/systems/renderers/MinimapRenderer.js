// Renders minimap panel. data: { entityManager, worldWidth, worldHeight, portal, currentLevel }
class MinimapRenderer {
    render(context, data) {
        const { ctx, canvas, systems } = context;
        const { entityManager, worldWidth, worldHeight, portal = null, currentLevel = 1 } = data;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const minimapSize = 220;
        const minimapPadding = 16;
        const minimapX = canvas.width - minimapSize - minimapPadding;
        const minimapY = minimapPadding;
        const panelPadding = 14;
        const labelHeight = 22;
        const innerSize = minimapSize - panelPadding * 2;
        const mapAreaHeight = innerSize - labelHeight;
        const innerX = minimapX + panelPadding;
        const innerY = minimapY + panelPadding;

        const scaleX = innerSize / worldWidth;
        const scaleY = mapAreaHeight / worldHeight;
        const scale = Math.min(scaleX, scaleY);
        const minimapWidth = worldWidth * scale;
        const minimapHeight = worldHeight * scale;

        ctx.fillStyle = '#1a1008';
        ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
        ctx.fillStyle = '#2c1810';
        ctx.fillRect(minimapX + 2, minimapY + 2, minimapSize - 4, minimapSize - 4);
        ctx.strokeStyle = '#4a3020';
        ctx.lineWidth = 2;
        ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(minimapX + 3, minimapY + 3, minimapSize - 6, minimapSize - 6);

        const isHub = currentLevel === 0;
        const levelConfigLabel = isHub ? GameConfig.hub : (GameConfig.levels && GameConfig.levels[currentLevel]);
        const mapLabel = (levelConfigLabel && levelConfigLabel.name) ? levelConfigLabel.name : 'Map';
        ctx.fillStyle = '#c9a227';
        ctx.font = '600 12px Cinzel, Georgia, serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(mapLabel, innerX + 2, innerY + labelHeight / 2);
        ctx.textBaseline = 'alphabetic';

        ctx.save();
        ctx.translate(
            innerX + (innerSize - minimapWidth) / 2,
            innerY + labelHeight + (mapAreaHeight - minimapHeight) / 2
        );
        ctx.scale(scale, scale);

        const tileSize = isHub && GameConfig.hub.tileSize ? GameConfig.hub.tileSize : GameConfig.world.tileSize;
        const levelConfigMinimap = isHub ? GameConfig.hub : (GameConfig.levels && GameConfig.levels[currentLevel]);
        const theme = levelConfigMinimap && levelConfigMinimap.theme ? levelConfigMinimap.theme : null;
        const ground = theme && theme.ground ? theme.ground : { r: 30, g: 50, b: 30, variation: 18 };
        for (let x = 0; x < worldWidth; x += tileSize) {
            for (let y = 0; y < worldHeight; y += tileSize) {
                const v = Math.floor((x + y) % 3) * (ground.variation || 15);
                const r = Math.max(0, Math.min(255, ground.r + v));
                const gVal = Math.max(0, Math.min(255, ground.g + v));
                const b = Math.max(0, Math.min(255, ground.b + v));
                ctx.fillStyle = `rgb(${r}, ${gVal}, ${b})`;
                ctx.fillRect(x, y, tileSize, tileSize);
            }
        }

        const obstacleManager = systems && systems.get ? systems.get('obstacles') : null;
        if (obstacleManager) {
            for (const obstacle of obstacleManager.obstacles) {
                ctx.fillStyle = obstacle.color || '#2d5016';
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            }
        }

        const entities = entityManager ? entityManager.getAll() : [];
        for (const entity of entities) {
            if (!entity.active) continue;
            const transform = entity.getComponent(Transform);
            const renderable = entity.getComponent(Renderable);
            if (!transform || !renderable) continue;
            const isEnemy = renderable.type === 'enemy';
            const dotRadius = isEnemy ? 1.5 / scale : 3 / scale;
            ctx.fillStyle = renderable.color;
            ctx.beginPath();
            ctx.arc(transform.x, transform.y, dotRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        if (portal && portal.spawned) {
            const px = portal.x + portal.width / 2;
            const py = portal.y + portal.height / 2;
            const r = Math.max(6 / scale, (portal.width + portal.height) / 4);
            ctx.fillStyle = 'rgba(120, 80, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(180, 140, 255, 1)';
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
        }

        ctx.restore();

        const objectiveText = isHub ? 'Approach the board and press E to select a level' : (() => {
            if (portal && portal.spawned) {
                return portal.hasNextLevel ? 'E Next area · B Return to Sanctuary' : 'B Return to Sanctuary';
            }
            const enemyManager = systems && systems.get ? systems.get('enemies') : null;
            const kills = enemyManager ? enemyManager.getEnemiesKilledThisLevel() : 0;
            const levelCfg = GameConfig.levels && GameConfig.levels[currentLevel];
            const required = (levelCfg && levelCfg.killsToUnlockPortal != null) ? levelCfg.killsToUnlockPortal : 0;
            const hasPortalGoal = required > 0;
            return hasPortalGoal
                ? `Slay ${required} foes to open the portal (${kills}/${required})`
                : (required > 0 ? `Foes felled: ${kills}` : '');
        })();
        if (objectiveText) {
            ctx.fillStyle = '#c4a574';
            ctx.font = '600 13px Cinzel, Georgia, serif';
            ctx.textAlign = 'left';
            ctx.fillText(objectiveText, minimapX + panelPadding, minimapY + minimapSize + 14);
        }
    }
}

if (typeof window !== 'undefined') {
    window.MinimapRenderer = MinimapRenderer;
}
