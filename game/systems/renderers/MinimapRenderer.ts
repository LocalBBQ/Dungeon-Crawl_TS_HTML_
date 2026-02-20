// Renders minimap panel. data: { entityManager, worldWidth, worldHeight, portal, currentLevel }
import { GameConfig } from '../../config/GameConfig.ts';
import { DELVE_LEVEL } from '../../config/questConfig.ts';
import { Transform } from '../../components/Transform.ts';
import { Renderable } from '../../components/Renderable.ts';
import type { RenderContext } from './RenderContext.ts';

export const MINIMAP_ZOOM_MIN = 0.5;
export const MINIMAP_ZOOM_MAX = 3;
export const MINIMAP_ZOOM_STEP = 0.25;

const MINIMAP_SIZE = 220;
const MINIMAP_PADDING = 16;
const PANEL_PADDING = 14;
const LABEL_HEIGHT = 22;
const ZOOM_BUTTON_SIZE = 24;
const ZOOM_BUTTON_GAP = 4;

export interface MinimapLayout {
    minimapX: number;
    minimapY: number;
    minimapSize: number;
    plusRect: { x: number; y: number; w: number; h: number };
    minusRect: { x: number; y: number; w: number; h: number };
}

export function getMinimapLayout(canvasWidth: number, canvasHeight: number): MinimapLayout {
    const minimapX = canvasWidth - MINIMAP_SIZE - MINIMAP_PADDING;
    const minimapY = MINIMAP_PADDING;
    const innerSize = MINIMAP_SIZE - PANEL_PADDING * 2;
    const buttonsY = minimapY + MINIMAP_SIZE - PANEL_PADDING - ZOOM_BUTTON_SIZE;
    const minusX = minimapX + MINIMAP_SIZE - PANEL_PADDING - ZOOM_BUTTON_SIZE * 2 - ZOOM_BUTTON_GAP;
    const plusX = minimapX + MINIMAP_SIZE - PANEL_PADDING - ZOOM_BUTTON_SIZE;
    return {
        minimapX,
        minimapY,
        minimapSize: MINIMAP_SIZE,
        minusRect: { x: minusX, y: buttonsY, w: ZOOM_BUTTON_SIZE, h: ZOOM_BUTTON_SIZE },
        plusRect: { x: plusX, y: buttonsY, w: ZOOM_BUTTON_SIZE, h: ZOOM_BUTTON_SIZE }
    };
}

function hitRect(x: number, y: number, rect: { x: number; y: number; w: number; h: number }): boolean {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export function hitTestMinimapZoomButtons(canvasWidth: number, canvasHeight: number, clickX: number, clickY: number): 'plus' | 'minus' | null {
    const layout = getMinimapLayout(canvasWidth, canvasHeight);
    if (hitRect(clickX, clickY, layout.minusRect)) return 'minus';
    if (hitRect(clickX, clickY, layout.plusRect)) return 'plus';
    return null;
}

export class MinimapRenderer {
    render(context: RenderContext, data: { entityManager?: { get?(id: string): unknown; getGroup?(name: string): unknown[] }; worldWidth: number; worldHeight: number; portal?: unknown; currentLevel?: number }): void {
        const { ctx, canvas, systems } = context;
        const { entityManager, worldWidth, worldHeight, portal = null, currentLevel = 1 } = data;
        const minimapZoom = Math.max(MINIMAP_ZOOM_MIN, Math.min(MINIMAP_ZOOM_MAX, (context.settings.minimapZoom as number) ?? 1));

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const minimapSize = MINIMAP_SIZE;
        const minimapPadding = MINIMAP_PADDING;
        const minimapX = canvas.width - minimapSize - minimapPadding;
        const minimapY = minimapPadding;
        const panelPadding = PANEL_PADDING;
        const labelHeight = LABEL_HEIGHT;
        const innerSize = minimapSize - panelPadding * 2;
        const mapAreaHeight = innerSize - labelHeight;
        const innerX = minimapX + panelPadding;
        const innerY = minimapY + panelPadding;

        const camera = context.camera as { x: number; y: number; zoom?: number };
        const camCenterX = camera.x + (canvas.width / (camera.zoom ?? 1)) / 2;
        const camCenterY = camera.y + (canvas.height / (camera.zoom ?? 1)) / 2;
        const viewWidth = worldWidth / minimapZoom;
        const viewHeight = worldHeight / minimapZoom;
        const viewLeft = Math.max(0, Math.min(worldWidth - viewWidth, camCenterX - viewWidth / 2));
        const viewTop = Math.max(0, Math.min(worldHeight - viewHeight, camCenterY - viewHeight / 2));

        const scaleX = innerSize / viewWidth;
        const scaleY = mapAreaHeight / viewHeight;
        const scale = Math.min(scaleX, scaleY);
        const minimapWidth = viewWidth * scale;
        const minimapHeight = viewHeight * scale;

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

        const mapDestX = innerX + (innerSize - minimapWidth) / 2;
        const mapDestY = innerY + labelHeight + (mapAreaHeight - minimapHeight) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(mapDestX, mapDestY, minimapWidth, minimapHeight);
        ctx.clip();
        ctx.translate(mapDestX, mapDestY);
        ctx.scale(scale, scale);
        ctx.translate(-viewLeft, -viewTop);

        const tileSize = isHub && GameConfig.hub.tileSize ? GameConfig.hub.tileSize : GameConfig.world.tileSize;
        const levelConfigMinimap = isHub ? GameConfig.hub : (GameConfig.levels && GameConfig.levels[currentLevel]);
        const theme = levelConfigMinimap && levelConfigMinimap.theme ? levelConfigMinimap.theme : null;
        const ground = theme && theme.ground ? theme.ground : { r: 30, g: 50, b: 30, variation: 18 };
        const patch = ground.patch != null && typeof ground.patch === 'object' ? ground.patch as { r: number; g: number; b: number; variation?: number; chance: number } : null;
        const tileHash = (tx: number, ty: number) => ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        const isPatchTile = patch && patch.chance > 0 ? (x: number, y: number) => (tileHash(Math.floor(x / tileSize), Math.floor(y / tileSize)) % 1000) / 1000 < patch.chance : () => false;
        for (let x = 0; x < worldWidth; x += tileSize) {
            for (let y = 0; y < worldHeight; y += tileSize) {
                const usePatch = isPatchTile(x, y);
                const base = usePatch && patch ? patch : ground;
                const vari = base.variation ?? ground.variation ?? 15;
                const v = Math.floor((x + y) % 3) * vari;
                const r = Math.max(0, Math.min(255, base.r + v));
                const gVal = Math.max(0, Math.min(255, base.g + v));
                const b = Math.max(0, Math.min(255, base.b + v));
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

        const layout = getMinimapLayout(canvas.width, canvas.height);
        const drawZoomButton = (rect: { x: number; y: number; w: number; h: number }, label: string) => {
            ctx.fillStyle = '#2c1810';
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.strokeStyle = '#4a3020';
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
            ctx.fillStyle = '#c9a227';
            ctx.font = '600 16px Cinzel, Georgia, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
        };
        drawZoomButton(layout.minusRect, '−');
        drawZoomButton(layout.plusRect, '+');

        const isDelve = currentLevel === DELVE_LEVEL;
        const objectiveText = isHub ? 'Approach the board and press E to select a level' : (() => {
            if (portal && portal.spawned) {
                if (isDelve) return portal.hasNextLevel ? 'E Descend' : 'E Return to Sanctuary';
                return portal.hasNextLevel ? 'E Next area' : 'E Return to Sanctuary';
            }
            if (isDelve) return 'Slay all foes to open the stairs';
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

