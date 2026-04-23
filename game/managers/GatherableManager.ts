// Gatherable Manager - handles herbs, ore, chests, shrine blessings placed from scene tiles.
import { Transform } from '../components/Transform.js';
import { Health } from '../components/Health.js';
import { Utils } from '../utils/Utils.js';
import type { SystemManager } from '../core/SystemManager.js';
import type { CameraShape } from '../types/camera.js';
import type { EntityShape } from '../types/entity.js';
import { drawHerbIcon, drawMushroomIcon } from '../graphics/herbMushroomIcons.js';

export type GatherableType = 'herb' | 'mushroom' | 'ore' | 'chest' | 'shrineBlessing';

export interface GatherableItem {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: GatherableType | string;
    collected: boolean;
    pulsePhase: number;
}

interface GatheringState {
    item: GatherableItem;
}

interface GameRefLike {
    playerInGatherableRange?: boolean;
    addHerbToInventory?(): boolean;
    addMushroomToInventory?(): boolean;
    addGold?(amount: number): boolean;
}

interface InputSystemLike {
    mouseClicked?: boolean;
    isKeyPressed(key: string): boolean;
    clearClick?(): void;
}

export class GatherableManager {
    static GATHER_DURATION = 0.35;
    static INTERACT_RANGE = 30;

    items: GatherableItem[] = [];
    useCooldown = 0;
    /** Count of items collected this run by gatherable type (for quest objectives). Reset in clear(). */
    collectedThisRunByType: Record<string, number> = {};
    gameRef: GameRefLike | null = null;
    gathering: GatheringState | null = null;
    gatherProgress = 0;
    playerInGatherableRange = false;
    playerNearGatherable = false;
    /** World prompt above player when near a gatherable (herb/mushroom = "Pick", else "E"). */
    gatherInteractPromptLabel = 'E';

    constructor(gameRef?: GameRefLike | null) {
        this.gameRef = gameRef ?? null;
    }

    add(x: number, y: number, width: number, height: number, type: GatherableType | string): void {
        this.items.push({
            id: `gath_${this.items.length}_${Date.now()}`,
            x,
            y,
            width: width || 32,
            height: height || 32,
            type: type || 'herb',
            collected: false,
            pulsePhase: Math.random() * Math.PI * 2
        });
    }

    clear(): void {
        this.items = [];
        this.useCooldown = 0;
        this.collectedThisRunByType = {};
        this.gathering = null;
        this.gatherProgress = 0;
        this.playerInGatherableRange = false;
        this.playerNearGatherable = false;
        this.gatherInteractPromptLabel = 'E';
    }

    getCollectedCount(type: string): number {
        return this.collectedThisRunByType[type] ?? 0;
    }

    applyReward(type: string, player: EntityShape, _systems: SystemManager | null): void {
        const game = this.gameRef as GameRefLike | null;
        const health = player.getComponent(Health);
        switch (type) {
            case 'herb':
                if (game?.addHerbToInventory) game.addHerbToInventory();
                break;
            case 'mushroom':
                if (game?.addMushroomToInventory) game.addMushroomToInventory();
                break;
            case 'ore':
                if (game?.addGold) game.addGold(5);
                break;
            case 'chest':
                if (game?.addGold) game.addGold(15);
                break;
            case 'shrineBlessing':
                if (health) health.heal(Math.floor(health.maxHealth * 0.5));
                break;
        }
    }

    update(deltaTime: number, systems: SystemManager | null): void {
        if (this.useCooldown > 0) this.useCooldown -= deltaTime;

        const entityManager = systems?.get ? systems.get<{ get(id: string): EntityShape | undefined }>('entities') : null;
        const player = entityManager ? entityManager.get('player') : null;
        const inputSystem = systems?.get ? systems.get<InputSystemLike>('input') : null;

        this.playerInGatherableRange = false;
        this.playerNearGatherable = false;
        this.gatherInteractPromptLabel = 'E';

        if (!player || !inputSystem) return;

        const transform = player.getComponent(Transform);
        if (!transform) return;

        const playerLeft = transform.left;
        const playerTop = transform.top;
        const playerWidth = transform.width;
        const playerHeight = transform.height;

        const clicked = inputSystem.mouseClicked === true;
        const ePressed = inputSystem.isKeyPressed('e');

        const canInteractWith = (item: GatherableItem): boolean => {
            const R = GatherableManager.INTERACT_RANGE;
            const ix = item.x - R;
            const iy = item.y - R;
            const iw = item.width + 2 * R;
            const ih = item.height + 2 * R;
            return Utils.rectCollision(playerLeft, playerTop, playerWidth, playerHeight, ix, iy, iw, ih);
        };

        if (this.gathering) {
            const item = this.gathering.item;
            const stillOverlapping = canInteractWith(item);
            if (!stillOverlapping) {
                this.gathering = null;
                this.gatherProgress = 0;
            } else {
                this.gatherProgress += deltaTime / GatherableManager.GATHER_DURATION;
                if (this.gatherProgress >= 1) {
                    item.collected = true;
                    this.collectedThisRunByType[item.type] = (this.collectedThisRunByType[item.type] ?? 0) + 1;
                    this.useCooldown = 0.4;
                    this.applyReward(item.type, player, systems);
                    this.gathering = null;
                    this.gatherProgress = 0;
                }
                if (clicked && inputSystem.clearClick) inputSystem.clearClick();
            }
        } else {
            for (const item of this.items) {
                if (item.collected) continue;
                const overlapping = canInteractWith(item);
                if (overlapping) this.playerNearGatherable = true;
                if (!overlapping) continue;
                if (this.useCooldown > 0) continue;
                if (this.gathering) continue;
                if (!ePressed) continue;
                this.gathering = { item };
                this.gatherProgress = 0;
                break;
            }
        }

        if (this.gathering) {
            this.playerInGatherableRange = true;
        } else {
            for (const item of this.items) {
                if (item.collected) continue;
                if (canInteractWith(item)) {
                    this.playerNearGatherable = true;
                    this.gatherInteractPromptLabel =
                        item.type === 'herb' || item.type === 'mushroom' ? 'Pick' : 'E';
                    break;
                }
            }
        }

        this.items = this.items.filter(i => !i.collected);
        if (this.gameRef) this.gameRef.playerInGatherableRange = this.playerInGatherableRange;
    }

    renderGatherRing(ctx: CanvasRenderingContext2D, camera: CameraShape, player: EntityShape | null): void {
        if (!this.gathering || !player) return;
        const transform = player.getComponent(Transform);
        if (!transform) return;
        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        const screenX = camera.toScreenX(centerX) + 22;
        const screenY = camera.toScreenY(centerY) - 28;
        const radius = 14;
        const lineWidth = 5;
        const progress = Math.min(1, this.gatherProgress);
        ctx.save();
        ctx.beginPath();
        ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(40, 35, 30, 0.75)';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + Math.PI * 2 * progress;
        if (progress > 0.001) {
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, startAngle, endAngle);
            ctx.strokeStyle = 'rgba(120, 200, 120, 0.95)';
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        ctx.restore();
    }

    renderInteractPrompt(ctx: CanvasRenderingContext2D, camera: CameraShape, player: EntityShape | null): void {
        if (this.gathering || !this.playerNearGatherable || !player) return;
        const transform = player.getComponent(Transform);
        if (!transform) return;
        const centerX = transform.x + transform.width / 2;
        const centerY = transform.y + transform.height / 2;
        const screenX = camera.toScreenX(centerX);
        const screenY = camera.toScreenY(centerY) - 48;
        ctx.save();
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = 'rgba(20, 20, 20, 0.9)';
        ctx.lineWidth = 3;
        const label = this.gatherInteractPromptLabel;
        ctx.strokeText(label, screenX, screenY);
        ctx.fillText(label, screenX, screenY);
        ctx.restore();
    }

    /** Small blue flame drawn above shrine blessing gatherables; not drawn for collected (removed) shrines. */
    private renderShrineFlame(ctx: CanvasRenderingContext2D, screenX: number, screenY: number, zoom: number, pulsePhase: number): void {
        const t = Date.now() / 400 + pulsePhase;
        const flicker = 0.85 + 0.15 * Math.sin(t * 3);
        const h = Math.max(6, 14 * zoom * flicker);
        const w = Math.max(3, 8 * zoom * flicker);
        const flameY = screenY - h * 0.6;
        ctx.save();
        ctx.translate(screenX, flameY);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.bezierCurveTo(-w, -h / 3, -w * 0.4, -h / 2, 0, -h / 2);
        ctx.bezierCurveTo(w * 0.4, -h / 2, w, -h / 3, 0, h / 2);
        ctx.closePath();
        const g = ctx.createRadialGradient(0, -h / 4, 0, 0, -h / 4, w * 1.2);
        g.addColorStop(0, 'rgba(120, 200, 255, 0.95)');
        g.addColorStop(0.5, 'rgba(80, 150, 220, 0.7)');
        g.addColorStop(1, 'rgba(50, 100, 180, 0.25)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    render(ctx: CanvasRenderingContext2D, camera: CameraShape): void {
        const colors: Record<string, { fill: string }> = {
            herb: { fill: '#4a7c4a' },
            mushroom: { fill: '#6b4a3a' },
            ore: { fill: '#6b5b4f' },
            chest: { fill: '#8b6914' },
            shrineBlessing: { fill: '#7b9ed4' }
        };
        for (const item of this.items) {
            const screenX = camera.toScreenX(item.x + item.width / 2);
            const screenY = camera.toScreenY(item.y + item.height / 2);
            if (screenX < -60 || screenX > ctx.canvas.width + 60 ||
                screenY < -60 || screenY > ctx.canvas.height + 60) continue;
            const sizeScale = 0.5;
            const w = ((item.width * camera.zoom) / 2) * sizeScale;
            const h = ((item.height * camera.zoom) / 2) * sizeScale;
            const style = colors[item.type] || colors.herb;
            ctx.save();
            if (item.type === 'herb') {
                drawHerbIcon(ctx, screenX, screenY, Math.max(w, h));
            } else if (item.type === 'mushroom') {
                drawMushroomIcon(ctx, screenX, screenY, Math.max(w, h));
            } else {
                ctx.fillStyle = style.fill;
                ctx.beginPath();
                ctx.ellipse(screenX, screenY, w, h, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();
                if (item.type === 'shrineBlessing') {
                    this.renderShrineFlame(ctx, screenX, screenY, camera.zoom, item.pulsePhase);
                }
            }
            ctx.restore();
        }
    }
}
