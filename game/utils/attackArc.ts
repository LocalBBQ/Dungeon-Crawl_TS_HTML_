/**
 * Single source of truth for attack arc and sweep angles.
 * Used by PlayerCombatRenderer, EnemyEntityRenderer, EnemyManager, WeaponAttackHandler.
 */

export interface SweepAngles {
  startAngle: number;
  endAngle: number;
  arcCenter: number;
  halfArc: number;
}

/**
 * Get start and end angles for a sweeping attack arc (for drawing and hit tests).
 * @param facingAngle - Entity facing direction (radians).
 * @param arcOffset - Offset from facing (e.g. combat.attackArcOffset).
 * @param arcRad - Full arc width in radians.
 * @param sweepProgress - 0 = start of sweep, 1 = end of sweep.
 * @param reverseSweep - If true, sweep from right to left instead of left to right.
 * @param pullBack - Optional pull-back in radians (blade starts slightly behind for anticipation).
 */
export function getSweepAngles(
  facingAngle: number,
  arcOffset: number,
  arcRad: number,
  sweepProgress: number,
  reverseSweep: boolean,
  pullBack = 0
): SweepAngles {
  const arcCenter = facingAngle + arcOffset;
  const halfArc = arcRad / 2;
  let startAngle: number;
  let endAngle: number;
  if (reverseSweep) {
    startAngle = arcCenter + halfArc - sweepProgress * arcRad;
    endAngle = arcCenter + halfArc - pullBack;
  } else {
    startAngle = arcCenter - halfArc + pullBack;
    endAngle = arcCenter - halfArc + sweepProgress * arcRad;
  }
  return { startAngle, endAngle, arcCenter, halfArc };
}

/**
 * Draw an arc cone (filled sector) on the canvas. Used by player and enemy combat renderers.
 */
export function drawArcCone(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  range: number,
  startAngle: number,
  endAngle: number,
  options: {
    fillStyle?: string;
    strokeStyle?: string;
    lineWidth?: number;
    innerRadius?: number; // optional inner arc for highlight
  } = {}
): void {
  const { fillStyle, strokeStyle, lineWidth = 2, innerRadius } = options;
  if (fillStyle) ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.arc(screenX, screenY, range, startAngle, endAngle);
  ctx.lineTo(screenX, screenY);
  ctx.closePath();
  if (fillStyle) ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  if (innerRadius != null && innerRadius > 0 && strokeStyle) {
    ctx.beginPath();
    ctx.arc(screenX, screenY, innerRadius, startAngle, endAngle);
    ctx.stroke();
  }
}
