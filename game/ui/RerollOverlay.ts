/**
 * Reroll enchantments overlay: one drop slot, reroll buttons when slot has item.
 * Drag weapon into slot, modify, then drag out to re-equip or stash.
 */
import type { PlayingStateShape, WeaponInstance } from '../state/PlayingState.js';
import { getWeaponDisplayName } from './InventoryChestCanvas.js';
import { drawWeaponIcon } from './InventoryChestCanvas.js';
import { REROLL_PREFIX_COST, REROLL_SUFFIX_COST, REROLL_BOTH_COST } from '../state/InventoryActions.js';

export interface RerollOverlayLayout {
  panel: { x: number; y: number; w: number; h: number };
  back: { x: number; y: number; w: number; h: number };
  /** Single drop slot: drag weapon in here to modify, then drag out. */
  slot: { x: number; y: number; w: number; h: number };
  titleY: number;
  buttons: { x: number; y: number; w: number; h: number; action: 'prefix' | 'suffix' | 'both'; cost: number }[];
  buttonsY: number;
}

const PAD = 20;
const SLOT_SIZE = 72;
const BUTTON_W = 120;
const BUTTON_H = 32;
const GAP = 10;

export function getRerollOverlayLayout(canvas: HTMLCanvasElement, ps: PlayingStateShape): RerollOverlayLayout {
  const cw = canvas.width;
  const ch = canvas.height;
  const panelW = Math.min(380, cw - 80);
  const panelH = Math.min(320, ch - 80);
  const panel = { x: (cw - panelW) / 2, y: (ch - panelH) / 2, w: panelW, h: panelH };
  const back = { x: panel.x + panel.w - 52, y: panel.y + 12, w: 40, h: 28 };
  const titleY = panel.y + 38;
  const slot = {
    x: panel.x + (panel.w - SLOT_SIZE) / 2,
    y: panel.y + 58,
    w: SLOT_SIZE,
    h: SLOT_SIZE
  };
  const buttonsY = panel.y + panel.h - 52;
  const totalButtonW = BUTTON_W * 3 + GAP * 2;
  const startX = panel.x + (panel.w - totalButtonW) / 2;
  const buttons: RerollOverlayLayout['buttons'] = [
    { x: startX, y: buttonsY, w: BUTTON_W, h: BUTTON_H, action: 'prefix', cost: REROLL_PREFIX_COST },
    { x: startX + BUTTON_W + GAP, y: buttonsY, w: BUTTON_W, h: BUTTON_H, action: 'suffix', cost: REROLL_SUFFIX_COST },
    { x: startX + (BUTTON_W + GAP) * 2, y: buttonsY, w: BUTTON_W, h: BUTTON_H, action: 'both', cost: REROLL_BOTH_COST }
  ];

  return { panel, back, slot, titleY, buttons, buttonsY };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

export function renderRerollOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, ps: PlayingStateShape): void {
  const layout = getRerollOverlayLayout(canvas, ps);
  const { panel, back, slot, titleY, buttons } = layout;
  const hasItem = !!ps.rerollSlotItem?.key;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // No full-screen darkening so inventory/chest stay easy to see while dragging items

  ctx.fillStyle = 'rgba(28, 22, 18, 0.98)';
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 12);
  ctx.stroke();

  ctx.fillStyle = '#c9a227';
  ctx.font = '700 20px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Reroll Enchantments', panel.x + panel.w / 2, titleY);

  ctx.fillStyle = '#a08060';
  ctx.font = '600 14px Cinzel, Georgia, serif';
  roundRect(ctx, back.x, back.y, back.w, back.h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 128, 96, 0.8)';
  ctx.lineWidth = 1;
  roundRect(ctx, back.x, back.y, back.w, back.h, 6);
  ctx.stroke();
  ctx.fillText('Back', back.x + back.w / 2, back.y + back.h / 2);

  // Drop slot
  ctx.fillStyle = 'rgba(40, 32, 24, 0.9)';
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 8);
  ctx.fill();
  ctx.strokeStyle = hasItem ? 'rgba(201, 162, 39, 0.7)' : 'rgba(100, 80, 60, 0.6)';
  ctx.lineWidth = 2;
  roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 8);
  ctx.stroke();
  if (hasItem && ps.rerollSlotItem) {
    const inst = ps.rerollSlotItem;
    drawWeaponIcon(ctx, slot.x + slot.w / 2, slot.y + slot.h / 2 - 6, slot.w / 2 - 8, inst.key);
    ctx.fillStyle = '#e8dcc8';
    ctx.font = '600 11px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    const name = getWeaponDisplayName(inst.key, inst);
    const short = name.length > 14 ? name.slice(0, 12) + '…' : name;
    ctx.fillText(short, slot.x + slot.w / 2, slot.y + slot.h - 10);
  } else {
    ctx.fillStyle = '#887866';
    ctx.font = '500 12px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drop weapon here', slot.x + slot.w / 2, slot.y + slot.h / 2);
  }

  if (hasItem) {
    const gold = ps.gold ?? 0;
    for (const btn of buttons) {
      const canAfford = gold >= btn.cost;
      ctx.fillStyle = canAfford ? 'rgba(80, 60, 40, 0.9)' : 'rgba(50, 38, 28, 0.9)';
      roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
      ctx.fill();
      ctx.strokeStyle = canAfford ? 'rgba(201, 162, 39, 0.6)' : 'rgba(100, 80, 60, 0.6)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 6);
      ctx.stroke();
      ctx.fillStyle = canAfford ? '#e8dcc8' : '#888';
      ctx.font = '600 11px Cinzel, Georgia, serif';
      ctx.textAlign = 'center';
      const label = btn.action === 'prefix' ? `Prefix (${btn.cost}g)` : btn.action === 'suffix' ? `Suffix (${btn.cost}g)` : `Both (${btn.cost}g)`;
      ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }
  } else {
    ctx.fillStyle = '#887866';
    ctx.font = '500 12px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Drag a weapon into the slot, then reroll', panel.x + panel.w / 2, slot.y + slot.h + 20);
  }

  ctx.restore();
}

export type RerollOverlayHit =
  | { type: 'back' }
  | { type: 'slot' }
  | { type: 'reroll'; action: 'prefix' | 'suffix' | 'both' }
  | null;

export function hitTestRerollOverlay(x: number, y: number, ps: PlayingStateShape, layout: RerollOverlayLayout): RerollOverlayHit {
  const { back, slot, buttons } = layout;
  if (x >= back.x && x <= back.x + back.w && y >= back.y && y <= back.y + back.h) return { type: 'back' };
  if (x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h) return { type: 'slot' };
  if (ps.rerollSlotItem?.key) {
    for (const btn of buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) return { type: 'reroll', action: btn.action };
    }
  }
  return null;
}
