// Renders minimap panel. data: { entityManager, worldWidth, worldHeight, portal, currentLevel }
import { GameConfig } from '../../config/GameConfig.ts';
import { Transform } from '../../components/Transform.ts';
import { Renderable } from '../../components/Renderable.ts';
import type { RenderContext } from './RenderContext.ts';

export class MinimapRenderer {
    render(context: RenderContext, data: { entityManager?: { get?(id: string): unknown; getGroup?(name: string): unknown[] }; worldWidth: number; worldHeight: number; portal?: unknown; currentLevel?: number }): void {
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
            const objectiveY = minimapY + minimapSize + 10;
            const lineHeight = 16;
            const maxLines = 3;
            const objectiveHeight = lineHeight * maxLines;
            const objectiveWidth = minimapSize;
            const objectiveLeft = minimapX;
            const textPadding = panelPadding;
            const maxTextWidth = objectiveWidth - textPadding * 2;

            ctx.save();
            ctx.beginPath();
            ctx.rect(objectiveLeft, objectiveY, objectiveWidth, objectiveHeight);
            ctx.clip();

            ctx.fillStyle = '#c4a574';
            ctx.font = '600 13px Cinzel, Georgia, serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const lines: string[] = [];
            const words = objectiveText.split(/\s+/);
            let line = '';
            for (const word of words) {
                const candidate = line ? line + ' ' + word : word;
                if (ctx.measureText(candidate).width <= maxTextWidth) {
                    line = candidate;
                } else {
                    if (line) lines.push(line);
                    line = '';
                    let remainder = word;
                    while (remainder && ctx.measureText(remainder).width > maxTextWidth) {
                        let i = 1;
                        while (i <= remainder.length && ctx.measureText(remainder.slice(0, i)).width <= maxTextWidth) i++;
                        lines.push(remainder.slice(0, i - 1));
                        remainder = remainder.slice(i - 1);
                    }
                    if (remainder) line = remainder;
                }
            }
            if (line) lines.push(line);

            const clampedLines = lines.slice(0, maxLines);
            for (let i = 0; i < clampedLines.length; i++) {
                const y = objectiveY + lineHeight * (i + 0.5);
                ctx.fillText(clampedLines[i], objectiveLeft + textPadding, y);
            }

            ctx.restore();
        }
    }
}

