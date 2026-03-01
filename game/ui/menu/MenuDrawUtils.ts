/**
 * Shared menu drawing helpers for title, class select, and other menu screens.
 * All functions take ctx as first argument so they can be used from ScreenManager or per-screen renderers.
 */

export function drawMenuButton(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    label: string,
    pressed: boolean,
    options?: { dim?: boolean; fontSize?: number }
): void {
    const dy = pressed ? 2 : 0;
    const y = centerY + dy;
    const h = pressed ? height - 2 : height;
    ctx.fillStyle = pressed ? '#120d08' : '#1a1008';
    ctx.fillRect(centerX - width / 2, y - h / 2, width, h);
    ctx.strokeStyle = pressed ? '#3a2820' : '#4a3020';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - width / 2, y - h / 2, width, h);
    if (!pressed) {
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - width / 2 + 2, y - h / 2 + 2, width - 4, h - 4);
    }
    ctx.fillStyle = options?.dim ? '#a08060' : '#e8dcc8';
    ctx.font = `600 ${options?.fontSize ?? 15}px Cinzel, Georgia, serif`;
    ctx.fillText(label, centerX, y);
}

export function drawSmallButton(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    label: string,
    pressed: boolean
): void {
    const dy = pressed ? 2 : 0;
    const y = centerY + dy;
    const h = pressed ? height - 2 : height;
    ctx.fillStyle = pressed ? '#120d08' : '#1a1008';
    ctx.fillRect(centerX - width / 2, y - h / 2, width, h);
    ctx.strokeStyle = pressed ? '#3a2820' : '#4a3020';
    ctx.lineWidth = 2;
    ctx.strokeRect(centerX - width / 2, y - h / 2, width, h);
    if (!pressed) {
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - width / 2 + 2, y - h / 2 + 2, width - 4, h - 4);
    }
    ctx.fillStyle = '#e8dcc8';
    ctx.font = '600 14px Cinzel, Georgia, serif';
    ctx.fillText(label, centerX, y);
}

/** Draw a stone brazier with flame at center (centerX, centerY), total size w×h. */
export function drawTitleBrazier(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, w: number, h: number): void {
    const baseH = h * 0.22;
    const stemW = w * 0.35;
    const stemH = h * 0.4;
    const bowlDepth = h * 0.38;
    const bowlTopW = w * 0.9;
    const bowlBottomW = w * 0.7;
    const left = centerX - w / 2;

    ctx.fillStyle = '#3d3630';
    ctx.beginPath();
    ctx.roundRect(left, centerY + h / 2 - baseH, w, baseH, 2);
    ctx.fill();
    ctx.strokeStyle = '#2a2520';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#4a443c';
    ctx.fillRect(centerX - stemW / 2, centerY + h / 2 - baseH - stemH, stemW, stemH);
    ctx.strokeStyle = '#35302a';
    ctx.strokeRect(centerX - stemW / 2, centerY + h / 2 - baseH - stemH, stemW, stemH);

    const bowlTop = centerY + h / 2 - baseH - stemH - bowlDepth;
    ctx.fillStyle = '#5a5348';
    ctx.beginPath();
    ctx.moveTo(centerX - bowlTopW / 2, bowlTop);
    ctx.lineTo(centerX + bowlTopW / 2, bowlTop);
    ctx.lineTo(centerX + bowlBottomW / 2, bowlTop + bowlDepth);
    ctx.lineTo(centerX - bowlBottomW / 2, bowlTop + bowlDepth);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3d3630';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = '#6b6458';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - bowlTopW / 2 + 2, bowlTop + 3);
    ctx.lineTo(centerX + bowlTopW / 2 - 2, bowlTop + 3);
    ctx.stroke();

    const flameCenterY = bowlTop + 8;
    const flameH = 28;
    const t = (Date.now() / 120) % (Math.PI * 2);
    const sway = Math.sin(t) * 2;

    const glowGrad = ctx.createRadialGradient(
        centerX + sway, flameCenterY, 0,
        centerX + sway, flameCenterY, flameH * 1.2
    );
    glowGrad.addColorStop(0, 'rgba(255, 180, 60, 0.7)');
    glowGrad.addColorStop(0.4, 'rgba(220, 100, 30, 0.25)');
    glowGrad.addColorStop(1, 'rgba(180, 50, 10, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.ellipse(centerX + sway, flameCenterY, 10, flameH, 0, 0, Math.PI * 2);
    ctx.fill();

    const coreGrad = ctx.createLinearGradient(centerX, flameCenterY - flameH, centerX, flameCenterY + flameH);
    coreGrad.addColorStop(0, '#fff8b0');
    coreGrad.addColorStop(0.3, '#ffcc40');
    coreGrad.addColorStop(0.7, '#e07020');
    coreGrad.addColorStop(1, '#802010');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(centerX + sway, flameCenterY - flameH * 0.85);
    ctx.bezierCurveTo(
        centerX + 8 + sway, flameCenterY - 4,
        centerX + 6 + sway, flameCenterY + flameH,
        centerX + sway, flameCenterY + flameH * 0.3
    );
    ctx.bezierCurveTo(
        centerX - 6 + sway, flameCenterY + flameH,
        centerX - 8 + sway, flameCenterY - 4,
        centerX + sway, flameCenterY - flameH * 0.85
    );
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
    ctx.beginPath();
    ctx.ellipse(centerX + sway, flameCenterY - flameH * 0.5, 3, 10, 0, 0, Math.PI * 2);
    ctx.fill();
}

export const CLASS_SELECT_PORTRAIT_SIZE = 96;

/** Top-down class portrait: warrior (knight). */
export function drawClassPortraitWarrior(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
    const s = size / 2;
    ctx.fillStyle = '#1a1410';
    ctx.beginPath();
    ctx.arc(centerX, centerY, s - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 2;
    ctx.stroke();
    const w = (s - 2) * 1.9;
    const lw = Math.max(1, 2);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 2);
    const steel = '#8b8b9a';
    const steelDark = '#5a5a68';
    const steelDarker = '#4a4a58';
    const helmetRx = w * 0.42;
    const helmetRy = w * 0.38;
    const paulOffsetY = helmetRy * 0.72;
    const paulRx = w * 0.22;
    const paulRy = w * 0.28;
    ctx.fillStyle = steel;
    ctx.strokeStyle = steelDarker;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
    ctx.ellipse(0, -paulOffsetY, paulRx, paulRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = steelDark;
    ctx.strokeStyle = steelDarker;
    ctx.beginPath();
    ctx.ellipse(0, 0, helmetRx, helmetRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = Math.max(1.5, lw * 1.2);
    ctx.beginPath();
    ctx.moveTo(helmetRx * 0.35, 0);
    ctx.lineTo(helmetRx * 0.95, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = lw * 0.5;
    ctx.beginPath();
    ctx.moveTo(-helmetRx * 0.5, 0);
    ctx.lineTo(helmetRx * 0.5, 0);
    ctx.stroke();
    ctx.restore();
}

/** Top-down class portrait: mage. */
export function drawClassPortraitMage(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
    const s = size / 2;
    ctx.fillStyle = '#1a1410';
    ctx.beginPath();
    ctx.arc(centerX, centerY, s - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 2;
    ctx.stroke();
    const w = (s - 2) * 1.9;
    const lw = Math.max(1, 2);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 2);
    const hoodRx = w * 0.42;
    const hoodRy = w * 0.38;
    const sleeveOffsetY = hoodRy * 0.72;
    const sleeveRx = w * 0.22;
    const sleeveRy = w * 0.28;
    const robeFill = '#3d2d4d';
    const robeStroke = '#2a2035';
    const hoodFill = '#352540';
    const hoodStroke = '#2a2035';
    const headFill = '#8b7355';
    const headStroke = '#6a5a48';
    ctx.fillStyle = robeFill;
    ctx.strokeStyle = robeStroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, sleeveOffsetY, sleeveRx, sleeveRy, 0, 0, Math.PI * 2);
    ctx.ellipse(0, -sleeveOffsetY, sleeveRx, sleeveRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = headFill;
    ctx.strokeStyle = headStroke;
    ctx.beginPath();
    ctx.ellipse(0, 0, hoodRx * 0.5, hoodRy * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hoodFill;
    ctx.strokeStyle = hoodStroke;
    ctx.beginPath();
    ctx.ellipse(0, 0, hoodRx, hoodRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/** Top-down class portrait: rogue. */
export function drawClassPortraitRogue(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
    const s = size / 2;
    ctx.fillStyle = '#1a1410';
    ctx.beginPath();
    ctx.arc(centerX, centerY, s - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 2;
    ctx.stroke();
    const w = (s - 2) * 1.9;
    const lw = Math.max(1, 2);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.PI / 2);
    const hoodRx = w * 0.44;
    const hoodRy = w * 0.40;
    const shoulderOffsetY = hoodRy * 0.68;
    const shoulderRx = w * 0.18;
    const shoulderRy = w * 0.24;
    const brownFill = '#5a4a3a';
    const brownStroke = '#3d3228';
    ctx.fillStyle = brownFill;
    ctx.strokeStyle = brownStroke;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, shoulderOffsetY, shoulderRx, shoulderRy, 0, 0, Math.PI * 2);
    ctx.ellipse(0, -shoulderOffsetY, shoulderRx, shoulderRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = brownFill;
    ctx.strokeStyle = brownStroke;
    ctx.beginPath();
    ctx.ellipse(0, 0, hoodRx, hoodRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}
