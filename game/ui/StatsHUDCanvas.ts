/**
 * Canvas-rendered stats HUD (health/stamina orbs, stun, toolbelt, recall portal).
 * Drawn before inventory/chest/shop/reroll panels so those panels appear on top and are not blocked.
 */
import type { EntityShape } from '../types/entity.js';
import type { PotionConsumable } from '../state/PlayingState.js';
import { Health } from '../components/Health.js';
import { Rally } from '../components/Rally.js';
import { Stamina } from '../components/Stamina.js';
import { Combat } from '../components/Combat.js';
import { StatusEffects } from '../components/StatusEffects.js';
import { DELVE_LEVEL } from '../config/questConfig.js';
import { drawPotionIcon } from '../graphics/herbMushroomIcons.js';
import { TOOLBELT_SLOT_COUNT, MAX_WEAPON_DURABILITY } from '../state/PlayingState.js';

const PAD = 16;
const ORB_RADIUS = 60;
const ORB_SIDE = 160;
const ORB_Y_OFFSET = 50;
/** Extra space below orbs so HEALTH/STAMINA label and value text are visible */
const ORB_TEXT_SPACE = 44;
const BOTTOM_BAR_PAD_BOTTOM = 10;
const STUN_BAR_W = 72;
const STUN_BAR_H = 12;
/** Card style: rounded rect matching orb frame */
const CARD_RADIUS = 8;
const CARD_PAD = 10;
/** Stun-only card width; sits left of toolbelt row */
const STUN_CARD_W = 118;
const STUN_CARD_H = 52;
/** Toolbelt: 4 slots + 1 recall portal slot */
const TOOLBELT_SLOT_SIZE = 48;
const TOOLBELT_SLOT_GAP = 6;
const RECALL_PORTAL_SLOT_COUNT = 1;
const TOTAL_BOTTOM_SLOTS = TOOLBELT_SLOT_COUNT + RECALL_PORTAL_SLOT_COUNT;
const TOOLBELT_ROW_W = TOTAL_BOTTOM_SLOTS * TOOLBELT_SLOT_SIZE + (TOTAL_BOTTOM_SLOTS - 1) * TOOLBELT_SLOT_GAP;
const BAR_GAP = 12;
/** Stun + toolbelt + recall (weapon strip is added separately when shown). */
const BOTTOM_BAR_CORE_W = STUN_CARD_W + BAR_GAP + TOOLBELT_ROW_W;
const WEAPON_TO_STUN_GAP = 8;
/** Sword durability HUD: half-length blade vs prior centered bar; height fits bottom row. */
const SHARP_BLADE_MAIN_W = 114;
const SHARP_BLADE_H = 20;
const SHARP_OFFHAND_W_MULT = 0.7;
const SHARP_OFFHAND_H_MULT = 0.85;
const SHARP_ROW_GAP = 5;
const SHARP_PANEL_PAD_X = 10;
const SHARP_PANEL_PAD_Y = 6;
const FONT_LABEL = '700 14px Cinzel, Georgia, serif';
const FONT_TEXT = '700 15px Cinzel, Georgia, serif';
const FONT_STAT = '600 15px Cinzel, Georgia, serif';
const COLOR_LABEL = '#c9a227';
const COLOR_TEXT = '#d4bc8c';
const COLOR_STUN_LABEL = '#706858';

/** Active loadout durability for Monster Hunter–style blade HUD (optional). */
export interface WeaponDurabilityHudSnapshot {
  mainhandKey: string;
  mainhandDurability: number;
  offhandKey: string;
  offhandDurability: number;
}

export interface StatsHUDData {
  delveFloor: number;
  /** 0..1 progress while B-started recall spawn channel runs; 0 when idle. */
  recallChannelProgress?: number;
  /** Toolbelt slots (potions); length TOOLBELT_SLOT_COUNT. */
  toolbeltSlots?: (PotionConsumable | null)[];
  /** When set, draws blade gauge(s) in the bottom HUD row, left of the stun card. */
  weaponDurabilityHud?: WeaponDurabilityHudSnapshot;
}

/**
 * Render the stats HUD on the game canvas. Call before inventory/chest/shop/reroll panels so those panels draw on top.
 * Uses same visual style as the original DOM HUD (orbs, bottom bar, stun, heal charges).
 */
export function renderStatsHUD(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  player: EntityShape | undefined,
  currentLevel: number,
  data: StatsHUDData
): void {
  if (!player) return;
  const health = player.getComponent(Health);
  const stamina = player.getComponent(Stamina);
  const rally = player.getComponent(Rally);
  const combat = player.getComponent(Combat);
  const statusEffects = player.getComponent(StatusEffects);

  const W = canvas.width;
  const H = canvas.height;

  const leftOrbX = PAD + ORB_SIDE / 2 + ORB_RADIUS;
  const rightOrbX = W - PAD - ORB_SIDE / 2 - ORB_RADIUS;
  const orbCenterY = H - PAD - 6 - ORB_RADIUS - 20 - ORB_TEXT_SPACE + ORB_Y_OFFSET;

  ctx.save();

  // Effect stacks (e.g. Rising Gale) – above orbs, center
  const weapon = combat?.attackHandler?.weapon ?? (combat?.playerAttack as { weapon?: { name?: string } } | undefined)?.weapon;
  const weaponName = weapon && typeof weapon === 'object' && (weapon as { name?: string }).name;
  if (weaponName === 'Blessed Winds' && statusEffects != null) {
    const stacks = statusEffects.risingGaleStacks ?? 0;
    ctx.fillStyle = stacks >= 2 ? '#c9a227' : '#b89870';
    ctx.font = '600 14px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Rising Gale ${stacks}/2`, canvas.width / 2, orbCenterY - ORB_RADIUS - 50);
  }

  // Health orb
  if (health) {
    const healthPct = Math.max(0, Math.min(1, health.percent));
    drawOrb(ctx, leftOrbX, orbCenterY, ORB_RADIUS, healthPct, [
      [0, '#e04040'],
      [0.3, '#b02828'],
      [0.6, '#8b2020'],
      [1, '#5c1010']
    ]);
    ctx.fillStyle = COLOR_LABEL;
    ctx.font = FONT_LABEL;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rallyAmount = rally && rally.rallyPool > 0 ? Math.floor(rally.rallyPool) : 0;
    const healthStr =
      rallyAmount > 0
        ? `${Math.floor(health.currentHealth)}/${health.maxHealth} (+${rallyAmount} rally)`
        : `${Math.floor(health.currentHealth)}/${health.maxHealth}`;
    ctx.fillText(healthStr, leftOrbX, orbCenterY + ORB_RADIUS + 20);
    ctx.fillStyle = COLOR_LABEL;
    ctx.font = '700 12px Cinzel, Georgia, serif';
    ctx.fillText('HEALTH', leftOrbX, orbCenterY + ORB_RADIUS + 8);
  }

  // Stamina orb
  if (stamina) {
    const staminaPct = Math.max(0, Math.min(1, stamina.percent));
    const pulse =
      combat && combat.dashAttackFlashUntil && performance.now() < combat.dashAttackFlashUntil;
    drawOrb(ctx, rightOrbX, orbCenterY, ORB_RADIUS, staminaPct, [
      [0, '#4a9070'],
      [0.3, '#2a7050'],
      [0.6, '#1e5038'],
      [1, '#0f2520']
    ], pulse);
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = FONT_TEXT;
    ctx.textAlign = 'center';
    ctx.fillText(
      `${Math.floor(stamina.currentStamina)}/${stamina.maxStamina}`,
      rightOrbX,
      orbCenterY + ORB_RADIUS + 20
    );
    ctx.fillStyle = COLOR_LABEL;
    ctx.font = '700 12px Cinzel, Georgia, serif';
    ctx.fillText('STAMINA', rightOrbX, orbCenterY + ORB_RADIUS + 8);
  }

  // Bottom row: [ weapon durability | stun card | 4 toolbelt slots | recall portal slot ]
  const barLayout = getBottomHudBarLayout(canvas, data.weaponDurabilityHud);
  const { barLeftX, bottomRowY, barHeight, stunCardX, toolbeltRowX } = barLayout;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  if (data.weaponDurabilityHud) {
    drawWeaponSharpnessHud(ctx, barLeftX, bottomRowY, barHeight, data.weaponDurabilityHud);
  }

  // Stun card
  roundRect(ctx, stunCardX, bottomRowY, STUN_CARD_W, STUN_CARD_H, CARD_RADIUS);
  ctx.fillStyle = 'rgba(28, 22, 18, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(61, 40, 23, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const cardInnerX = stunCardX + CARD_PAD;
  const cardMidY = bottomRowY + STUN_CARD_H / 2;

  if (statusEffects) {
    const barY = cardMidY - STUN_BAR_H / 2;
    ctx.fillStyle = COLOR_STUN_LABEL;
    ctx.font = '600 10px Cinzel, Georgia, serif';
    ctx.fillText('Stun', cardInnerX, barY + STUN_BAR_H / 2);
    const trackX = cardInnerX + 28;
    ctx.fillStyle = '#0f0a06';
    roundRect(ctx, trackX, barY, STUN_BAR_W, STUN_BAR_H, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(50, 40, 35, 0.6)';
    ctx.lineWidth = 1;
    roundRect(ctx, trackX, barY, STUN_BAR_W, STUN_BAR_H, 3);
    ctx.stroke();
    const stunPct = Math.min(1, statusEffects.stunMeterPercent ?? 0);
    ctx.fillStyle = '#5a5a5a';
    if (stunPct > 0.01) {
      roundRect(ctx, trackX, barY, STUN_BAR_W * stunPct, STUN_BAR_H, 0);
      ctx.fill();
    }
    if (statusEffects.isStunned) {
      const remainPct = Math.max(0, statusEffects.stunDurationPercentRemaining ?? 0);
      ctx.fillStyle = '#cc8800';
      if (remainPct > 0.01) {
        roundRect(ctx, trackX, barY, STUN_BAR_W * remainPct, STUN_BAR_H, 0);
        ctx.fill();
      }
      ctx.fillStyle = COLOR_STUN_LABEL;
      ctx.font = '600 9px Cinzel, Georgia, serif';
      ctx.fillText('Stunned', trackX + STUN_BAR_W + 4, barY + STUN_BAR_H / 2);
    }
  }

  // Toolbelt: 4 slots (potions or empty) + 1 recall portal slot
  const toolbeltRowY = bottomRowY + (barHeight - TOOLBELT_SLOT_SIZE) / 2;
  const toolbeltSlots = data.toolbeltSlots ?? [];
  for (let i = 0; i < TOOLBELT_SLOT_COUNT; i++) {
    const slotX = toolbeltRowX + i * (TOOLBELT_SLOT_SIZE + TOOLBELT_SLOT_GAP);
    roundRect(ctx, slotX, toolbeltRowY, TOOLBELT_SLOT_SIZE, TOOLBELT_SLOT_SIZE, 6);
    ctx.fillStyle = 'rgba(20, 16, 12, 0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(61, 40, 23, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const slot = toolbeltSlots[i];
    if (slot && slot.type === 'potion' && slot.count >= 1) {
      const cx = slotX + TOOLBELT_SLOT_SIZE / 2;
      const cy = toolbeltRowY + TOOLBELT_SLOT_SIZE / 2 - 6;
      drawPotionIcon(ctx, cx, cy, 24);
      if (slot.count > 1) {
        ctx.fillStyle = COLOR_TEXT;
        ctx.font = '700 11px Cinzel, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`×${slot.count}`, cx, toolbeltRowY + TOOLBELT_SLOT_SIZE - 4);
        ctx.textAlign = 'left';
      }
    }
    ctx.fillStyle = COLOR_LABEL;
    ctx.font = '700 10px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(i + 1), slotX + TOOLBELT_SLOT_SIZE - 6, toolbeltRowY + TOOLBELT_SLOT_SIZE - 2);
    ctx.textAlign = 'left';
  }

  // Recall portal slot (tap B to start 2.5s spawn channel): icon + "B" key at bottom right
  const portalSlotX = toolbeltRowX + TOOLBELT_SLOT_COUNT * (TOOLBELT_SLOT_SIZE + TOOLBELT_SLOT_GAP);
  roundRect(ctx, portalSlotX, toolbeltRowY, TOOLBELT_SLOT_SIZE, TOOLBELT_SLOT_SIZE, 6);
  ctx.fillStyle = 'rgba(20, 16, 12, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(61, 40, 23, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const recallProgress = Math.min(1, data.recallChannelProgress ?? 0);
  const portalCx = portalSlotX + TOOLBELT_SLOT_SIZE / 2;
  const portalCy = toolbeltRowY + TOOLBELT_SLOT_SIZE / 2 - 6;
  const portalR = 14;
  const gradient = ctx.createRadialGradient(portalCx, portalCy, 0, portalCx, portalCy, portalR);
  gradient.addColorStop(0, 'rgba(80, 140, 255, 0.9)');
  gradient.addColorStop(0.5, 'rgba(40, 100, 220, 0.6)');
  gradient.addColorStop(1, 'rgba(20, 60, 160, 0.3)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(portalCx, portalCy, portalR * 0.9, portalR * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 170, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (recallProgress > 0.001) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    roundRect(ctx, portalSlotX + 4, toolbeltRowY + TOOLBELT_SLOT_SIZE - 12, TOOLBELT_SLOT_SIZE - 8, 6, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(100, 160, 255, 0.95)';
    roundRect(ctx, portalSlotX + 4, toolbeltRowY + TOOLBELT_SLOT_SIZE - 12, (TOOLBELT_SLOT_SIZE - 8) * recallProgress, 6, 2);
    ctx.fill();
  }
  ctx.fillStyle = COLOR_LABEL;
  ctx.font = '700 11px Cinzel, Georgia, serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('B', portalSlotX + TOOLBELT_SLOT_SIZE - 4, toolbeltRowY + TOOLBELT_SLOT_SIZE - 4);
  ctx.textAlign = 'left';

  // Delve floor (top-center)
  if (currentLevel === DELVE_LEVEL && data.delveFloor > 0) {
    ctx.fillStyle = '#c9a227';
    ctx.font = '600 15px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Floor ' + data.delveFloor, W / 2, 12);
  }

  ctx.restore();
}

/** Layout of the 4 toolbelt slots (for hit-test and drag/drop). */
export interface ToolbeltLayout {
  slotRects: { x: number; y: number; w: number; h: number }[];
}

export interface BottomHudBarLayout {
  barLeftX: number;
  bottomRowY: number;
  barHeight: number;
  stunCardX: number;
  toolbeltRowX: number;
  /** Panel + gap reserved left of the stun card (0 when no weapon HUD). */
  weaponStripW: number;
}

/** Width of weapon durability panel + gap before stun (0 if nothing to show). */
export function getWeaponDurabilityHudStripWidth(hud?: WeaponDurabilityHudSnapshot | null): number {
  if (!hud) return 0;
  const showMain = hud.mainhandKey && hud.mainhandKey !== 'none';
  const showOff = hud.offhandKey && hud.offhandKey !== 'none';
  if (!showMain && !showOff) return 0;
  return SHARP_BLADE_MAIN_W + SHARP_PANEL_PAD_X * 2 + WEAPON_TO_STUN_GAP;
}

/** Bottom HUD row geometry (centered), matching `renderStatsHUD`. */
export function getBottomHudBarLayout(
  canvas: HTMLCanvasElement,
  weaponHud?: WeaponDurabilityHudSnapshot | null
): BottomHudBarLayout {
  const W = canvas.width;
  const H = canvas.height;
  const barHeight = Math.max(STUN_CARD_H, TOOLBELT_SLOT_SIZE);
  const bottomRowY = H - PAD - BOTTOM_BAR_PAD_BOTTOM - barHeight - 8;
  const weaponStripW = getWeaponDurabilityHudStripWidth(weaponHud);
  const totalW = weaponStripW + BOTTOM_BAR_CORE_W;
  const barLeftX = W / 2 - totalW / 2;
  return {
    barLeftX,
    bottomRowY,
    barHeight,
    stunCardX: barLeftX + weaponStripW,
    toolbeltRowX: barLeftX + weaponStripW + STUN_CARD_W + BAR_GAP,
    weaponStripW
  };
}

export function getToolbeltLayout(
  canvas: HTMLCanvasElement,
  weaponHud?: WeaponDurabilityHudSnapshot | null
): ToolbeltLayout {
  const { bottomRowY, barHeight, toolbeltRowX } = getBottomHudBarLayout(canvas, weaponHud);
  const toolbeltRowY = bottomRowY + (barHeight - TOOLBELT_SLOT_SIZE) / 2;
  const slotRects: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < TOOLBELT_SLOT_COUNT; i++) {
    slotRects.push({
      x: toolbeltRowX + i * (TOOLBELT_SLOT_SIZE + TOOLBELT_SLOT_GAP),
      y: toolbeltRowY,
      w: TOOLBELT_SLOT_SIZE,
      h: TOOLBELT_SLOT_SIZE
    });
  }
  return { slotRects };
}

/** Hit-test toolbelt slots. Returns 0..3 for a slot index, or -1 if not over a toolbelt slot. */
export function hitTestToolbelt(
  x: number,
  y: number,
  canvas: HTMLCanvasElement,
  weaponHud?: WeaponDurabilityHudSnapshot | null
): number {
  const layout = getToolbeltLayout(canvas, weaponHud);
  for (let i = 0; i < layout.slotRects.length; i++) {
    const r = layout.slotRects[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

/** Sword silhouette durability: pommel, grip, curved guard, blade + tip; solid blade fill from guard toward tip. */

/** Shared pommel / grip / guard / blade proportions (must match in silhouette + meter paths). */
function getSwordProportions(h: number): {
  rP: number;
  cxOff: number;
  gHH: number;
  gripLen: number;
  guardAlong: number;
  bHalf: number;
  guardArm: number;
} {
  return {
    rP: Math.max(2.5, h * 0.23),
    cxOff: 1.5,
    gHH: h * 0.072,
    gripLen: h * 0.48,
    guardAlong: h * 0.6,
    bHalf: h * 0.175,
    guardArm: h * 0.54
  };
}

/** Full sword outline (horizontal, tip right). */
function addSwordSilhouettePath(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  w: number,
  h: number
): void {
  const mid = top + h * 0.5;
  const { rP, cxOff, gHH, gripLen, guardAlong, bHalf, guardArm } = getSwordProportions(h);
  const cxP = left + rP + cxOff;
  const gl = cxP + rP;
  const gr = gl + gripLen;
  const bladeL = gr + guardAlong;
  const tipX = left + w;
  const tLen = Math.min(h * 0.88, (tipX - bladeL) * 0.38);
  const flatR = tipX - tLen;

  const gTipX = gr + guardAlong * 0.1;
  const gMidX = gr + guardAlong * 0.4;
  const gArmX = gr + guardAlong * 0.92;
  const gTopY = mid - guardArm;
  const gBotY = mid + guardArm;

  ctx.beginPath();
  ctx.moveTo(cxP - rP, mid);
  ctx.arc(cxP, mid, rP, Math.PI, 0, false);
  ctx.lineTo(cxP + rP, mid + gHH);
  ctx.lineTo(gl, mid + gHH);
  ctx.lineTo(gr, mid + gHH);
  ctx.lineTo(gTipX, gBotY - h * 0.08);
  ctx.quadraticCurveTo(gMidX, gBotY, gArmX, mid + bHalf - h * 0.02);
  ctx.lineTo(bladeL, mid + bHalf);
  ctx.lineTo(flatR, mid + bHalf);
  ctx.lineTo(tipX, mid);
  ctx.lineTo(flatR, mid - bHalf);
  ctx.lineTo(bladeL, mid - bHalf);
  ctx.lineTo(gArmX, mid - bHalf + h * 0.02);
  ctx.quadraticCurveTo(gMidX, gTopY, gTipX, gTopY + h * 0.08);
  ctx.lineTo(gr, mid - gHH);
  ctx.lineTo(gl, mid - gHH);
  ctx.lineTo(cxP + rP, mid - gHH);
  ctx.arc(cxP, mid, rP, 0, Math.PI, false);
  ctx.closePath();
}

/** Blade-only region (for meter fill), same tip/flat as silhouette. */
function addBladeMeterPath(
  ctx: CanvasRenderingContext2D,
  bladeL: number,
  mid: number,
  bHalf: number,
  flatR: number,
  tipX: number
): void {
  ctx.beginPath();
  ctx.moveTo(bladeL, mid - bHalf);
  ctx.lineTo(flatR, mid - bHalf);
  ctx.lineTo(tipX, mid);
  ctx.lineTo(flatR, mid + bHalf);
  ctx.lineTo(bladeL, mid + bHalf);
  ctx.closePath();
}

function swordLayout(left: number, top: number, w: number, h: number): {
  bladeL: number;
  mid: number;
  bHalf: number;
  flatR: number;
  tipX: number;
  bladeLen: number;
} {
  const mid = top + h * 0.5;
  const { rP, cxOff, gripLen, guardAlong, bHalf } = getSwordProportions(h);
  const cxP = left + rP + cxOff;
  const gr = cxP + rP + gripLen;
  const bladeL = gr + guardAlong;
  const tipX = left + w;
  const tLen = Math.min(h * 0.88, (tipX - bladeL) * 0.38);
  const flatR = tipX - tLen;
  return { bladeL, mid, bHalf, flatR, tipX, bladeLen: tipX - bladeL };
}

function durabilitySolidFillColor(pct: number): string {
  if (pct <= 0) return '#4a2828';
  if (pct < 0.2) return '#b03838';
  if (pct < 0.4) return '#c07020';
  if (pct < 0.6) return '#b89828';
  if (pct < 0.8) return '#3a9858';
  return '#42b870';
}

function drawSwordDurabilityRow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  top: number,
  w: number,
  h: number,
  durability: number,
  maxDur: number
): void {
  const left = centerX - w / 2;
  const pct = maxDur > 0 ? Math.max(0, Math.min(1, durability / maxDur)) : 0;
  const { bladeL, mid, bHalf, flatR, tipX, bladeLen } = swordLayout(left, top, w, h);
  const fillExtent = bladeLen * pct;

  addSwordSilhouettePath(ctx, left, top, w, h);
  ctx.fillStyle = '#0c0a09';
  ctx.fill();

  if (fillExtent > 0.4) {
    ctx.save();
    addBladeMeterPath(ctx, bladeL, mid, bHalf, flatR, tipX);
    ctx.clip();
    ctx.fillStyle = durabilitySolidFillColor(pct);
    ctx.fillRect(bladeL - 0.5, top - 1, fillExtent + 1, h + 2);
    ctx.restore();
  }

  ctx.save();
  addSwordSilhouettePath(ctx, left, top, w, h);
  ctx.strokeStyle = 'rgba(242, 238, 230, 0.92)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawWeaponSharpnessHud(
  ctx: CanvasRenderingContext2D,
  panelLeft: number,
  bottomRowY: number,
  barHeight: number,
  hud: WeaponDurabilityHudSnapshot
): void {
  const max = MAX_WEAPON_DURABILITY;
  const showMain = hud.mainhandKey && hud.mainhandKey !== 'none';
  const showOff = hud.offhandKey && hud.offhandKey !== 'none';
  if (!showMain && !showOff) return;

  const mainW = SHARP_BLADE_MAIN_W;
  const mainH = SHARP_BLADE_H;
  const offW = Math.round(mainW * SHARP_OFFHAND_W_MULT);
  const offH = Math.round(mainH * SHARP_OFFHAND_H_MULT);
  const bodyH =
    (showMain ? mainH : 0) + (showMain && showOff ? SHARP_ROW_GAP : 0) + (showOff ? offH : 0);
  const panelW = mainW + SHARP_PANEL_PAD_X * 2;
  const panelH = bodyH + SHARP_PANEL_PAD_Y * 2;
  const panelTop = bottomRowY + (barHeight - panelH) / 2;

  ctx.save();
  roundRect(ctx, panelLeft, panelTop, panelW, panelH, 8);
  ctx.fillStyle = 'rgba(20, 16, 13, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(95, 72, 48, 0.42)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const cx = panelLeft + panelW / 2;
  let y = panelTop + SHARP_PANEL_PAD_Y;
  if (showMain) {
    drawSwordDurabilityRow(ctx, cx, y, mainW, mainH, hud.mainhandDurability, max);
    y += mainH + (showOff ? SHARP_ROW_GAP : 0);
  }
  if (showOff) {
    drawSwordDurabilityRow(ctx, cx, y, offW, offH, hud.offhandDurability, max);
  }
  ctx.restore();
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fillPercent: number,
  gradientStops: [number, string][],
  pulse?: boolean
): void {
  ctx.save();
  if (fillPercent > 0.001) {
    const fillHeight = 2 * r * Math.max(0, Math.min(1, fillPercent));
    ctx.beginPath();
    ctx.rect(cx - r, cy + r - fillHeight, r * 2, fillHeight);
    ctx.clip();
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    gradientStops.forEach(([t, c]) => g.addColorStop(t, c));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(61, 40, 23, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
