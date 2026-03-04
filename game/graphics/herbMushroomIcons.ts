/**
 * Canvas-drawn herb and mushroom icons for world gatherables and inventory.
 * Draw at (cx, cy) with given size (half-width/radius scale).
 */
export function drawHerbIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    const s = size;
    // Stem
    ctx.strokeStyle = '#3d5c34';
    ctx.fillStyle = '#4a7c4a';
    ctx.lineWidth = Math.max(1, s / 8);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.5);
    ctx.lineTo(cx, cy - s * 0.15);
    ctx.stroke();
    // Three leaves (clover-style)
    ctx.fillStyle = '#4a7c4a';
    ctx.strokeStyle = '#3d5c34';
    ctx.lineWidth = Math.max(1, s / 12);
    for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const lx = cx + Math.cos(angle) * s * 0.5;
        const ly = cy - s * 0.1 + Math.sin(angle) * s * 0.4;
        ctx.beginPath();
        ctx.ellipse(lx, ly, s * 0.28, s * 0.2, angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    // Small center
    ctx.fillStyle = '#5a9060';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.12, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

export function drawMushroomIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    const s = size;
    // Stem
    ctx.fillStyle = '#e8dcc8';
    ctx.strokeStyle = '#c4b898';
    ctx.lineWidth = Math.max(1, s / 12);
    const stemW = s * 0.3;
    const stemH = s * 0.55;
    ctx.fillRect(cx - stemW / 2, cy + s * 0.1, stemW, stemH);
    ctx.strokeRect(cx - stemW / 2, cy + s * 0.1, stemW, stemH);
    // Cap (domed)
    ctx.fillStyle = '#6b4a3a';
    ctx.strokeStyle = '#5a3d30';
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.05, s * 0.45, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cap spots (white dots)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(cx - s * 0.15, cy - s * 0.12, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, cy - s * 0.02, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + s * 0.05, cy - s * 0.18, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Potion icon: small bottle with liquid (crafted via Strategy Crafting). */
export function drawPotionIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    const s = size;
    // Bottle body (trapezoid / flask)
    ctx.fillStyle = 'rgba(80, 100, 140, 0.5)';
    ctx.strokeStyle = '#5a6a8a';
    ctx.lineWidth = Math.max(1, s / 12);
    const bodyW = s * 0.5;
    const bodyH = s * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - bodyW / 2, cy + s * 0.2);
    ctx.lineTo(cx - bodyW / 3, cy - s * 0.35);
    ctx.lineTo(cx + bodyW / 3, cy - s * 0.35);
    ctx.lineTo(cx + bodyW / 2, cy + s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Liquid (reddish potion)
    ctx.fillStyle = 'rgba(180, 60, 50, 0.85)';
    ctx.beginPath();
    ctx.moveTo(cx - bodyW / 3 + 2, cy + s * 0.1);
    ctx.lineTo(cx, cy - s * 0.25);
    ctx.lineTo(cx + bodyW / 3 - 2, cy + s * 0.1);
    ctx.closePath();
    ctx.fill();
    // Neck
    ctx.fillStyle = '#6a7a9a';
    ctx.strokeStyle = '#5a6a8a';
    ctx.fillRect(cx - s * 0.12, cy - s * 0.5, s * 0.24, s * 0.2);
    ctx.strokeRect(cx - s * 0.12, cy - s * 0.5, s * 0.24, s * 0.2);
    ctx.restore();
}

/** Gold icon: coin shape with golden fill (inventory currency). */
export function drawGoldIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    const s = size;
    const r = s * 0.42;
    // Coin body
    ctx.fillStyle = '#c9a227';
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = Math.max(1, s / 14);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Inner circle (face of coin)
    ctx.fillStyle = '#e8d060';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8922a';
    ctx.lineWidth = Math.max(1, s / 20);
    ctx.stroke();
    ctx.restore();
}

/** Honey icon: honeycomb shape with golden fill (for beehive gatherable and inventory). */
export function drawHoneyIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    const s = size;
    // Honeycomb: hexagon cluster
    ctx.fillStyle = '#c9a227';
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = Math.max(1, s / 16);
    const r = s * 0.32;
    const hexY = r * Math.sqrt(3);
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const x = cx + (col - 0.5) * r * 1.5;
            const y = cy + (row - 0.5) * hexY;
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
                const hx = x + r * Math.cos(angle);
                const hy = y + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(hx, hy);
                else ctx.lineTo(hx, hy);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
    // Highlight
    ctx.fillStyle = 'rgba(255, 235, 180, 0.5)';
    ctx.beginPath();
    const hcx = cx - r * 0.4;
    const hcy = cy - r * 0.3;
    ctx.arc(hcx, hcy, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Page icon: parchment sheet with text lines (crafting ingredient for enchant scrolls). */
export function drawPageIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    const s = size;
    const w = s * 0.72;
    const h = s * 0.88;
    const left = cx - w / 2;
    const top = cy - h / 2;
    const lw = Math.max(1, s / 20);

    // Shadow / depth
    ctx.fillStyle = 'rgba(80, 70, 60, 0.35)';
    ctx.fillRect(left + 2, top + 2, w, h);
    // Paper fill
    ctx.fillStyle = '#e8e0d0';
    ctx.strokeStyle = '#a89878';
    ctx.lineWidth = lw;
    ctx.fillRect(left, top, w, h);
    ctx.strokeRect(left, top, w, h);
    // Inner margin line (optional)
    ctx.strokeStyle = 'rgba(168, 152, 120, 0.5)';
    ctx.lineWidth = Math.max(1, s / 24);
    const margin = s * 0.08;
    ctx.strokeRect(left + margin, top + margin, w - margin * 2, h - margin * 2);
    // Text lines (3 lines of parchment)
    ctx.strokeStyle = '#b0a088';
    ctx.lineWidth = Math.max(1, s / 28);
    const lineGap = h * 0.22;
    const lineY0 = top + h * 0.28;
    const pad = w * 0.15;
    for (let i = 0; i < 3; i++) {
        const y = lineY0 + i * lineGap;
        ctx.beginPath();
        ctx.moveTo(left + pad, y);
        ctx.lineTo(left + w - pad, y);
        ctx.stroke();
    }
    ctx.restore();
}

/** Enchant scroll icon: rolled scroll shape (use at reroll station). */
export function drawEnchantScrollIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    const s = size;
    const r = s * 0.4;
    ctx.fillStyle = '#8a7a5a';
    ctx.strokeStyle = '#6a5a3a';
    ctx.lineWidth = Math.max(1, s / 14);
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9a227';
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = Math.max(1, s / 20);
    ctx.beginPath();
    ctx.arc(cx + r * 0.2, cy - r * 0.1, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}
