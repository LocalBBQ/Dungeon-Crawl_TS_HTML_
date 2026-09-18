// Canvas-backed billboards for world-anchored UI: health bars, floating damage and interaction prompts.
//
// These elements are text and thin bars, so redrawing them as 2D canvas art and hanging that on a
// camera-facing sprite keeps them crisp and identical to the 2D build. Sizes are expressed in world
// units, which is exactly what the 2D renderer used (it multiplied pixel sizes by the camera zoom, and
// zoom is pixels per world unit).
import * as THREE from 'three';

/** Pixels of canvas resolution per world unit. Enough to keep small text legible when zoomed in. */
const PIXELS_PER_UNIT = 6;

export class CanvasBillboard {
    readonly sprite: THREE.Sprite;
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
    private readonly texture: THREE.CanvasTexture;
    private worldWidth = 1;
    private worldHeight = 1;
    private signature = '';

    constructor(worldWidth: number, worldHeight: number) {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false })
        );
        // Drawn after the world so bars are never buried inside geometry.
        this.sprite.renderOrder = 10;
        this.resize(worldWidth, worldHeight);
    }

    resize(worldWidth: number, worldHeight: number): void {
        if (worldWidth === this.worldWidth && worldHeight === this.worldHeight && this.canvas.width > 0) return;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.canvas.width = Math.max(2, Math.ceil(worldWidth * PIXELS_PER_UNIT));
        this.canvas.height = Math.max(2, Math.ceil(worldHeight * PIXELS_PER_UNIT));
        this.sprite.scale.set(worldWidth, worldHeight, 1);
        this.signature = '';
    }

    /**
     * Redraw only when the content actually changed. `signature` should capture every value the
     * drawing depends on.
     */
    drawIfChanged(signature: string, draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): void {
        if (signature === this.signature) return;
        this.signature = signature;
        this.ctx.setTransform(PIXELS_PER_UNIT, 0, 0, PIXELS_PER_UNIT, 0, 0);
        this.ctx.clearRect(0, 0, this.worldWidth, this.worldHeight);
        draw(this.ctx, this.worldWidth, this.worldHeight);
        this.texture.needsUpdate = true;
    }

    setOpacity(opacity: number): void {
        (this.sprite.material as THREE.SpriteMaterial).opacity = opacity;
    }

    dispose(): void {
        this.texture.dispose();
        (this.sprite.material as THREE.SpriteMaterial).dispose();
    }
}

export interface EntityBarsState {
    isPlayer: boolean;
    healthPercent: number | null;
    showHealth: boolean;
    staminaPercent: number | null;
    showStamina: boolean;
    stunMeterPercent: number;
    showStunMeter: boolean;
    stunDurationPercent: number;
    rallyFraction: number;
    /** Tier marker drawn above the bar for veteran/elite variants, mirroring the 2D star. */
    tier: number;
}

/** Total world height the bar stack occupies, used to place the billboard above the character. */
export function barsStackHeight(state: EntityBarsState): number {
    const barHeight = state.isPlayer ? 5 : 4;
    let height = barHeight;
    if (state.showStamina) height += 2 + (state.isPlayer ? 4 : 3);
    if (state.showStunMeter) height += 2 + 3;
    if (state.stunDurationPercent > 0) height += 2 + 3;
    if (state.tier > 0) height += 8;
    return height;
}

/** Draw the same bar stack the 2D EntityEffectsRenderer produces, in world units. */
export function drawEntityBars(
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number,
    state: EntityBarsState
): void {
    const barWidth = state.isPlayer ? 40 : 30;
    const barHeight = state.isPlayer ? 5 : 4;
    const x = (width - barWidth) / 2;
    let y = 0;

    if (state.tier > 0) {
        ctx.fillStyle = state.tier >= 2 ? '#ffd24a' : '#c8c8d8';
        ctx.font = '700 7px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(state.tier >= 2 ? '★★' : '★', width / 2, y);
        y += 8;
    }

    if (state.stunDurationPercent > 0) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, 3);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, barWidth, 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, barWidth * state.stunDurationPercent, 3);
        y += 5;
    }

    if (state.showHealth && state.healthPercent != null) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        const percent = state.healthPercent;
        ctx.fillStyle = percent > 0.5 ? '#44ff44' : percent > 0.25 ? '#ffff44' : '#ff4444';
        ctx.fillRect(x, y, barWidth * percent, barHeight);
        if (state.rallyFraction > 0) {
            ctx.fillStyle = '#cc8800';
            ctx.fillRect(x + barWidth * percent, y, barWidth * state.rallyFraction, barHeight);
        }
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
    y += barHeight + 2;

    if (state.showStamina && state.staminaPercent != null) {
        const height = state.isPlayer ? 4 : 3;
        ctx.fillStyle = '#1a2520';
        ctx.fillRect(x, y, barWidth, height);
        ctx.strokeStyle = '#2a3a32';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, barWidth, height);
        ctx.fillStyle = '#2a7050';
        ctx.fillRect(x, y, barWidth * state.staminaPercent, height);
        y += height + 2;
    }

    if (state.showStunMeter) {
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, barWidth, 3);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, barWidth, 3);
        ctx.fillStyle = state.stunMeterPercent >= 1 ? '#ff6600' : '#ffaa00';
        ctx.fillRect(x, y, barWidth * state.stunMeterPercent, 3);
    }
}

/** Draw a floating damage number matching the 2D colours and drop shadow. */
export function drawDamageNumber(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    text: string,
    color: string
): void {
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText(text, width / 2 + 1, height / 2 + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, width / 2, height / 2);
}

/** Draw an interaction prompt panel, matching the 2D prompt styling. */
export function drawPrompt(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    lines: string[],
    channelProgress: number
): void {
    const padding = 4;
    const lineHeight = 13;
    const panelHeight = lines.length * lineHeight + padding * 2 + (channelProgress > 0 ? 7 : 0);
    const panelY = height - panelHeight;

    ctx.fillStyle = 'rgba(12, 10, 8, 0.82)';
    ctx.strokeStyle = 'rgba(190, 160, 100, 0.55)';
    ctx.lineWidth = 0.8;
    const panelX = width * 0.08;
    const panelWidth = width * 0.84;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 3);
    ctx.fill();
    ctx.stroke();

    ctx.font = '600 11px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8d8b0';
    lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, panelY + padding + lineHeight * (index + 0.5));
    });

    if (channelProgress > 0) {
        const barY = panelY + panelHeight - padding - 3;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(panelX + 4, barY, panelWidth - 8, 3);
        ctx.fillStyle = '#c8a850';
        ctx.fillRect(panelX + 4, barY, (panelWidth - 8) * Math.min(1, channelProgress), 3);
    }
}
