/**
 * Renders the "Quest Complete!" flair overlay when the player finishes the quest objective.
 * remaining: seconds left to show (e.g. 2.5 down to 0). Fade in ~0.3s, hold, fade out last ~0.5s.
 */
export function renderQuestCompleteFlair(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    remaining: number
): void {
    if (remaining <= 0) return;

    const total = 2.5;
    const fadeIn = 0.3;
    const fadeOut = 0.5;
    const elapsed = total - remaining;

    let alpha = 1;
    if (elapsed < fadeIn) {
        alpha = elapsed / fadeIn;
    } else if (remaining < fadeOut) {
        alpha = remaining / fadeOut;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Subtle scale-in at start (1 -> 1.1 in first 0.15s, then settle to 1)
    const scaleT = Math.min(1, elapsed / 0.2);
    const scale = 0.92 + 0.08 * (1 - Math.pow(1 - scaleT, 2));
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // Semi-transparent vignette behind text
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(canvas.width, canvas.height) * 0.6);
    gradient.addColorStop(0, `rgba(20, 12, 8, ${0.4 * alpha})`);
    gradient.addColorStop(0.5, `rgba(10, 6, 4, ${0.25 * alpha})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Main title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 42px Cinzel, Georgia, serif';
    const title = 'Quest Complete!';
    const titleY = cy - 16;

    // Outline for readability
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.9 * alpha})`;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(title, cx, titleY);

    // Gold/amber fill
    const fillGradient = ctx.createLinearGradient(cx, titleY - 32, cx, titleY + 32);
    fillGradient.addColorStop(0, `rgba(255, 220, 140, ${alpha})`);
    fillGradient.addColorStop(0.5, `rgba(201, 162, 39, ${alpha})`);
    fillGradient.addColorStop(1, `rgba(180, 140, 50, ${alpha})`);
    ctx.fillStyle = fillGradient;
    ctx.fillText(title, cx, titleY);

    // Subline
    ctx.font = '500 18px Cinzel, Georgia, serif';
    ctx.fillStyle = `rgba(220, 200, 170, ${0.95 * alpha})`;
    ctx.fillText('Return to the portal to leave', cx, titleY + 36);

    ctx.restore();
}
