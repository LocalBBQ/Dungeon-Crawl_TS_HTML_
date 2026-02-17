/**
 * Canvas-based inventory and weapon chest UI: layout, render, and hit-test.
 * Used when inventoryOpen or chestOpen; pointer events handled by Game.
 */
import type { InventorySlot, PlayingStateShape, WeaponInstance } from '../state/PlayingState.js';
import { getSlotKey, INVENTORY_SLOT_COUNT, MAX_WEAPON_DURABILITY } from '../state/PlayingState.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { canEquipWeaponInSlot } from '../weapons/weaponSlot.js';
import type { Weapon } from '../weapons/Weapon.js';
import {
    getShopByWeaponType,
    SHOP_WEAPON_TYPE_ORDER,
    SHOP_WEAPON_TYPE_LABELS
} from '../config/shopConfig.js';

function isWeaponInstance(w: unknown): w is Weapon {
    return !!w && typeof (w as Weapon).baseDamage === 'number';
}

const WEAPON_SYMBOLS: Record<string, string> = {
    sword: '∿',
    shield: '▣',
    defender: '‡',
    dagger: '†',
    greatsword: '⋔',
    crossbow: '⊗',
    mace: '◆',
    none: '—'
};

export const CHEST_WEAPON_ORDER: string[] = [
    'sword_rusty', 'shield', 'defender_rusty', 'dagger_rusty', 'greatsword_rusty', 'crossbow_rusty', 'mace_rusty'
];

const INVENTORY_COLS = 6;
const INVENTORY_ROWS = 4;
const INVENTORY_GRID_SLOTS = INVENTORY_COLS * INVENTORY_ROWS;

/** Base weapon key from variant key (e.g. sword_rusty -> sword). */
function getBaseWeaponKey(key: string): string {
    if (!key || key === 'none') return key;
    const i = key.indexOf('_');
    return i > 0 ? key.slice(0, i) : key;
}

export function getWeaponSymbol(key: string): string {
    if (!key) return '—';
    const base = getBaseWeaponKey(key);
    return WEAPON_SYMBOLS[base] ?? '?';
}

const BASE_DISPLAY_NAMES: Record<string, string> = {
    sword: 'Sword', shield: 'Shield', defender: 'Defender',
    greatsword: 'Greatsword', mace: 'Mace', dagger: 'Dagger', crossbow: 'Crossbow', none: '—'
};

/** Material display name from variant key suffix (e.g. sword_rusty -> Rusty). */
function getMaterialDisplayNameFromKey(key: string): string | null {
    const i = key.indexOf('_');
    if (i <= 0) return null;
    const suffix = key.slice(i + 1);
    return suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
}

export function getWeaponDisplayName(key: string): string {
    if (!key) return '—';
    if (BASE_DISPLAY_NAMES[key] !== undefined) return BASE_DISPLAY_NAMES[key];
    const base = getBaseWeaponKey(key);
    const baseName = BASE_DISPLAY_NAMES[base];
    const materialName = getMaterialDisplayNameFromKey(key);
    if (baseName && materialName) return `${materialName} ${baseName}`;
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

/** Metal fill and stroke for weapon icon from registry (material tier color). */
function getWeaponIconColors(key: string): { fill: string; stroke: string } {
    const w = Weapons[key];
    const hex = isWeaponInstance(w) && (w as Weapon).color ? (w as Weapon).color : null;
    if (!hex || typeof hex !== 'string') return { fill: '#a8a8b0', stroke: '#3d3d42' };
    const m = hex.match(/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    if (!m) return { fill: hex, stroke: '#3d3d42' };
    const r = Math.max(0, Math.floor(parseInt(m[1], 16) * 0.55));
    const g = Math.max(0, Math.floor(parseInt(m[2], 16) * 0.55));
    const b = Math.max(0, Math.floor(parseInt(m[3], 16) * 0.55));
    return { fill: hex, stroke: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}` };
}

/**
 * Draw a miniature weapon icon centered at (cx, cy). size = half-width of icon (e.g. slot width / 2 - 4).
 * Weapon is drawn at a fixed display angle (blade/shaft toward top-right) so it fits in grid slots.
 */
export function drawWeaponIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, weaponKey: string): void {
    if (!weaponKey || weaponKey === 'none') return;
    const base = getBaseWeaponKey(weaponKey);
    const colors = getWeaponIconColors(weaponKey);
    const angle = Math.PI / 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const s = size;
    const lw = Math.max(1, size / 12);

    if (base === 'sword' || base === 'dagger') {
        const bladeLen = base === 'dagger' ? s * 0.85 : s * 1.0;
        const guardW = base === 'dagger' ? s * 0.25 : s * 0.3;
        const tipW = guardW * 0.4;
        ctx.lineWidth = lw;
        ctx.strokeStyle = colors.stroke;
        ctx.fillStyle = colors.fill;
        ctx.beginPath();
        ctx.moveTo(0, -guardW);
        ctx.lineTo(0, guardW);
        ctx.lineTo(bladeLen, tipW);
        ctx.lineTo(bladeLen + tipW * 1.2, 0);
        ctx.lineTo(bladeLen, -tipW);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#6b6b75';
        ctx.strokeStyle = '#4a4a52';
        ctx.fillRect(-s * 0.35, -guardW * 0.4, s * 0.25, guardW * 0.8);
        ctx.strokeRect(-s * 0.35, -guardW * 0.4, s * 0.25, guardW * 0.8);
        ctx.fillStyle = '#4a4a52';
        ctx.beginPath();
        ctx.arc(-s * 0.45, 0, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (base === 'greatsword') {
        const bladeLen = s * 1.15;
        const guardW = s * 0.35;
        const tipW = guardW * 0.5;
        ctx.lineWidth = lw;
        ctx.strokeStyle = colors.stroke;
        ctx.fillStyle = colors.fill;
        ctx.beginPath();
        ctx.moveTo(0, -guardW);
        ctx.lineTo(0, guardW);
        ctx.lineTo(bladeLen, tipW);
        ctx.lineTo(bladeLen + tipW * 1.5, 0);
        ctx.lineTo(bladeLen, -tipW);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#6b6b75';
        ctx.strokeStyle = '#4a4a52';
        ctx.fillRect(-s * 0.4, -guardW * 0.5, s * 0.35, guardW);
        ctx.strokeRect(-s * 0.4, -guardW * 0.5, s * 0.35, guardW);
        ctx.fillStyle = '#4a4a52';
        ctx.beginPath();
        ctx.arc(-s * 0.55, 0, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (base === 'mace') {
        const shaftLen = s * 0.5;
        const headR = s * 0.45;
        ctx.lineWidth = lw;
        ctx.fillStyle = '#5a5a62';
        ctx.strokeStyle = '#3a3a42';
        ctx.fillRect(-s * 0.4, -s * 0.08, shaftLen, s * 0.16);
        ctx.strokeRect(-s * 0.4, -s * 0.08, shaftLen, s * 0.16);
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        const flangeCount = 6;
        ctx.beginPath();
        for (let i = 0; i <= flangeCount; i++) {
            const a = (i / flangeCount) * Math.PI * 2;
            const x = shaftLen - s * 0.4 + Math.cos(a) * (headR + s * 0.08);
            const y = Math.sin(a) * (headR + s * 0.08);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(shaftLen - s * 0.4, 0, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (base === 'crossbow') {
        const stockLen = s * 0.9;
        const limbH = s * 0.5;
        ctx.fillStyle = '#3d2817';
        ctx.strokeStyle = '#2a1a0c';
        ctx.fillRect(-stockLen / 2, -s * 0.08, stockLen, s * 0.16);
        ctx.strokeRect(-stockLen / 2, -s * 0.08, stockLen, s * 0.16);
        ctx.strokeStyle = '#4a3520';
        ctx.lineWidth = lw * 1.5;
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.2, 0);
        ctx.quadraticCurveTo(stockLen * 0.45, -limbH, stockLen * 0.4, -limbH * 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.2, 0);
        ctx.quadraticCurveTo(stockLen * 0.45, limbH, stockLen * 0.4, limbH * 0.6);
        ctx.stroke();
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.beginPath();
        ctx.arc(stockLen * 0.4, 0, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = '#c0b090';
        ctx.lineWidth = lw * 0.8;
        ctx.beginPath();
        ctx.moveTo(stockLen * 0.4, -limbH * 0.4);
        ctx.lineTo(stockLen * 0.4, limbH * 0.4);
        ctx.stroke();
    } else if (base === 'defender') {
        const bladeLen = s * 0.7;
        const guardW = s * 0.2;
        const tipW = guardW * 0.5;
        ctx.lineWidth = lw;
        ctx.strokeStyle = colors.stroke;
        ctx.fillStyle = colors.fill;
        ctx.beginPath();
        ctx.moveTo(0, -guardW);
        ctx.lineTo(0, guardW);
        ctx.lineTo(bladeLen, tipW);
        ctx.lineTo(bladeLen + tipW, 0);
        ctx.lineTo(bladeLen, -tipW);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = colors.stroke;
        ctx.strokeStyle = colors.fill;
        ctx.fillRect(-s * 0.12, -guardW * 0.6, s * 0.14, guardW * 1.2);
        ctx.strokeRect(-s * 0.12, -guardW * 0.6, s * 0.14, guardW * 1.2);
    } else if (base === 'shield') {
        const shieldW = s * 0.9;
        const shieldH = s * 0.5;
        ctx.fillStyle = '#8b6914';
        ctx.strokeStyle = '#5d4a0c';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.roundRect(-shieldW / 2, -shieldH / 2, shieldW, shieldH, 4);
        ctx.fill();
        ctx.stroke();
    } else {
        ctx.fillStyle = '#e0c8a0';
        ctx.font = `600 ${Math.round(size)}px Cinzel, Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getWeaponSymbol(weaponKey), 0, 0);
    }
    ctx.restore();
}

export interface DragState {
    isDragging: boolean;
    weaponKey: string;
    /** When dragging from equipment, current durability of that item. */
    durability?: number;
    sourceSlotIndex: number;
    sourceContext: 'inventory' | 'chest' | 'equipment';
    pointerX: number;
    pointerY: number;
}

export function createDragState(): DragState {
    return {
        isDragging: false,
        weaponKey: '',
        sourceSlotIndex: -1,
        sourceContext: 'inventory',
        pointerX: 0,
        pointerY: 0
    };
}

export function ensureInventoryInitialized(ps: PlayingStateShape): void {
    if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) {
        ps.inventorySlots = Array(INVENTORY_SLOT_COUNT).fill(null) as InventorySlot[];
    }
}

// --- Inventory panel layout (right side, responsive auto layout) ---
const PANEL_WIDTH_RATIO = 0.40;
const PANEL_MIN_WIDTH = 260;
const PANEL_MAX_WIDTH = 420;
const SLOT_SIZE = 44;
const SLOT_GAP = 8;
const EQUIP_SLOT_SIZE = 58; // Slightly larger for main/off hand

export interface InventoryLayout {
    panel: { x: number; y: number; w: number; h: number };
    slots: { x: number; y: number; w: number; h: number; index: number }[];
    equipmentMainhand: { x: number; y: number; w: number; h: number };
    equipmentOffhand: { x: number; y: number; w: number; h: number };
    closeButton: { x: number; y: number; w: number; h: number };
}

export function getInventoryLayout(canvas: HTMLCanvasElement): InventoryLayout {
    const W = canvas.width;
    const H = canvas.height;
    const panelW = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, W * PANEL_WIDTH_RATIO));
    const panelX = W - panelW;
    const panelY = 0;
    const panelH = H;
    const padding = Math.max(12, Math.min(20, W * 0.02));
    const contentX = panelX + padding;
    const contentW = panelW - padding * 2;

    // Header: title + close
    const headerH = 56;
    const closeW = 64;
    const closeH = 32;
    const closeButton = { x: panelX + panelW - padding - closeW, y: panelY + 12, w: closeW, h: closeH };

    // Equipment section: two grid slots (main hand, off hand) side by side with card padding
    const equipSectionTop = panelY + headerH + 18;
    const equipLabelH = 20;
    const twoSlotsW = EQUIP_SLOT_SIZE * 2 + SLOT_GAP;
    const equipStartX = contentX + (contentW - twoSlotsW) / 2;
    const equipmentMainhand = { x: equipStartX, y: equipSectionTop + equipLabelH, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE };
    const equipmentOffhand = { x: equipStartX + EQUIP_SLOT_SIZE + SLOT_GAP, y: equipSectionTop + equipLabelH, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE };

    // Inventory grid below equipment (extra spacing for hierarchy); square tiles, smaller grid
    const gridTop = equipSectionTop + equipLabelH + EQUIP_SLOT_SIZE + 24;
    const slots: { x: number; y: number; w: number; h: number; index: number }[] = [];
    const totalGapW = (INVENTORY_COLS - 1) * SLOT_GAP;
    const totalGapH = (INVENTORY_ROWS - 1) * SLOT_GAP;
    const availableH = panelH - gridTop - padding;
    const maxSlotByW = (contentW - totalGapW) / INVENTORY_COLS;
    const maxSlotByH = (availableH - totalGapH) / INVENTORY_ROWS;
    const slotSize = Math.min(SLOT_SIZE, maxSlotByW, maxSlotByH);
    for (let row = 0; row < INVENTORY_ROWS; row++) {
        for (let col = 0; col < INVENTORY_COLS; col++) {
            const index = row * INVENTORY_COLS + col;
            const x = contentX + col * (slotSize + SLOT_GAP);
            const y = gridTop + row * (slotSize + SLOT_GAP);
            slots.push({ x, y, w: slotSize, h: slotSize, index });
        }
    }

    return {
        panel: { x: panelX, y: panelY, w: panelW, h: panelH },
        slots,
        equipmentMainhand,
        equipmentOffhand,
        closeButton
    };
}

export type InventoryHit =
    | { type: 'inventory-slot'; index: number; weaponKey: string | null; durability?: number }
    | { type: 'equipment'; slot: 'mainhand' | 'offhand' }
    | { type: 'close' }
    | null;

export function hitTestInventory(x: number, y: number, ps: PlayingStateShape, layout: InventoryLayout): InventoryHit {
    const { panel, slots, equipmentMainhand, equipmentOffhand, closeButton } = layout;
    if (x < panel.x || x > panel.x + panel.w || y < panel.y || y > panel.y + panel.h) return null;
    if (inRect(x, y, closeButton)) return { type: 'close' };
    if (inRect(x, y, equipmentMainhand)) return { type: 'equipment', slot: 'mainhand' };
    if (inRect(x, y, equipmentOffhand)) return { type: 'equipment', slot: 'offhand' };
    for (const s of slots) {
        if (inRect(x, y, s)) {
            const slot = ps.inventorySlots?.[s.index] ?? null;
            const key = getSlotKey(slot);
            return { type: 'inventory-slot', index: s.index, weaponKey: key, durability: slot?.durability };
        }
    }
    return null;
}

// --- Chest overlay layout (center only; character sheet is shared inventory panel) ---
const CHEST_SLOT_SIZE = 56;
const CHEST_COLS = 4;
const CHEST_MAX_SLOTS = 12;
const CHEST_GAP = 10;

export interface ChestSlotRect {
    x: number;
    y: number;
    w: number;
    h: number;
    index: number;
}

export interface ChestLayout {
    overlay: { x: number; y: number; w: number; h: number };
    weaponSlots: ChestSlotRect[];
    back: { x: number; y: number; w: number; h: number };
}

const CHEST_ROWS = Math.ceil(CHEST_MAX_SLOTS / CHEST_COLS);

export function getChestLayout(canvas: HTMLCanvasElement): ChestLayout {
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const overlay = { x: 0, y: 0, w: W, h: H };
    const titleY = H / 2 - 100;
    const gridTop = titleY + 40;
    const totalGapW = (CHEST_COLS - 1) * CHEST_GAP;
    const gridW = CHEST_COLS * CHEST_SLOT_SIZE + totalGapW;
    const startX = cx - gridW / 2;
    const weaponSlots: ChestSlotRect[] = [];
    for (let i = 0; i < CHEST_MAX_SLOTS; i++) {
        const col = i % CHEST_COLS;
        const row = Math.floor(i / CHEST_COLS);
        const x = startX + col * (CHEST_SLOT_SIZE + CHEST_GAP);
        const y = gridTop + row * (CHEST_SLOT_SIZE + CHEST_GAP);
        weaponSlots.push({ x, y, w: CHEST_SLOT_SIZE, h: CHEST_SLOT_SIZE, index: i });
    }
    const gridBottom = gridTop + CHEST_ROWS * (CHEST_SLOT_SIZE + CHEST_GAP) - CHEST_GAP;
    const backMargin = Math.max(CHEST_GAP * 1.5, CHEST_SLOT_SIZE * 0.25);
    const backW = CHEST_SLOT_SIZE * 2.2;
    const backH = CHEST_SLOT_SIZE * 0.7;
    const backTop = gridBottom + backMargin;
    const backY = backTop + backH / 2;

    return {
        overlay,
        weaponSlots,
        back: { x: cx - backW / 2, y: backY - backH / 2, w: backW, h: backH }
    };
}

export type ChestHit =
    | { type: 'weapon-slot'; index: number; key: string }
    | { type: 'back' }
    | null;

export function hitTestChest(x: number, y: number, layout: ChestLayout, chestSlots: WeaponInstance[]): ChestHit {
    if (inRect(x, y, layout.back)) return { type: 'back' };
    for (const s of layout.weaponSlots) {
        if (inRect(x, y, s)) {
            const instance = s.index < chestSlots.length ? chestSlots[s.index] : undefined;
            const key = instance?.key ?? '';
            return { type: 'weapon-slot', index: s.index, key };
        }
    }
    return null;
}

// --- Shop UI (buy weapons) ---
const SHOP_ROW_HEIGHT = 32;
const SHOP_DROPDOWN_HEADER_HEIGHT = 36;
const SHOP_PANEL_WIDTH = 560;
const SHOP_HEADER_HEIGHT = 72;
const SHOP_BACK_AREA_HEIGHT = 56;

export interface ShopItemRow {
    x: number;
    y: number;
    w: number;
    h: number;
    index: number;
    weaponKey: string;
    price: number;
}

export interface ShopDropdownHeader {
    x: number;
    y: number;
    w: number;
    h: number;
    weaponKey: string;
    title: string;
    expanded: boolean;
}

export interface ShopDropdownSection {
    header: ShopDropdownHeader;
    itemRows: ShopItemRow[];
}

/** One repairable item row in the shop (equipped or inventory). */
export interface ShopRepairRow {
    x: number;
    y: number;
    w: number;
    h: number;
    source: 'mainhand' | 'offhand' | { bagIndex: number };
    weaponKey: string;
    currentDurability: number;
    cost: number;
}

export interface ShopLayout {
    overlay: { x: number; y: number; w: number; h: number };
    panel: { x: number; y: number; w: number; h: number };
    dropdowns: ShopDropdownSection[];
    /** Flat list of all item rows for hit-testing. */
    allItemRows: ShopItemRow[];
    /** Dropdown header rects for hit-testing. */
    dropdownHeaders: ShopDropdownHeader[];
    /** Repair section rows (when playingState provided). */
    repairRows: ShopRepairRow[];
    back: { x: number; y: number; w: number; h: number };
    contentHeight: number;
    maxScrollOffset: number;
}

/** Gold per point of durability restored at the shop. */
export const REPAIR_GOLD_PER_DURABILITY = 1;

const SHOP_VISIBLE_PANEL_HEIGHT = 540;

const SHOP_REPAIR_HEADER_HEIGHT = 36;

export function getShopLayout(
    canvas: HTMLCanvasElement,
    scrollOffset = 0,
    expandedWeapons?: Record<string, boolean>,
    playingState?: PlayingStateShape
): ShopLayout {
    const W = canvas.width;
    const H = canvas.height;
    const overlay = { x: 0, y: 0, w: W, h: H };
    const panelW = SHOP_PANEL_WIDTH;
    const panelX = (W - panelW) / 2;
    const panelH = Math.min(SHOP_VISIBLE_PANEL_HEIGHT, H - 80);
    const panelY = (H - panelH) / 2;
    const panel = { x: panelX, y: panelY, w: panelW, h: panelH };

    const byType = getShopByWeaponType();
    let contentY = SHOP_HEADER_HEIGHT;
    const repairRowsContent: ShopRepairRow[] = [];

    if (playingState) {
        const rowW = panelW - 32;
        const rowH = SHOP_ROW_HEIGHT - 2;
        const toRepair: Omit<ShopRepairRow, 'x' | 'y' | 'w' | 'h'>[] = [];
        const mainKey = playingState.equippedMainhandKey;
        const mainDur = playingState.equippedMainhandDurability ?? MAX_WEAPON_DURABILITY;
        if (mainKey && mainKey !== 'none' && mainDur < MAX_WEAPON_DURABILITY) {
            toRepair.push({ source: 'mainhand', weaponKey: mainKey, currentDurability: mainDur, cost: (MAX_WEAPON_DURABILITY - mainDur) * REPAIR_GOLD_PER_DURABILITY });
        }
        const offKey = playingState.equippedOffhandKey;
        const offDur = playingState.equippedOffhandDurability ?? MAX_WEAPON_DURABILITY;
        if (offKey && offKey !== 'none' && offDur < MAX_WEAPON_DURABILITY) {
            toRepair.push({ source: 'offhand', weaponKey: offKey, currentDurability: offDur, cost: (MAX_WEAPON_DURABILITY - offDur) * REPAIR_GOLD_PER_DURABILITY });
        }
        const slots = playingState.inventorySlots ?? [];
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (!slot || slot.durability >= MAX_WEAPON_DURABILITY) continue;
            toRepair.push({ source: { bagIndex: i }, weaponKey: slot.key, currentDurability: slot.durability, cost: (MAX_WEAPON_DURABILITY - slot.durability) * REPAIR_GOLD_PER_DURABILITY });
        }
        if (toRepair.length > 0) {
            contentY += SHOP_REPAIR_HEADER_HEIGHT;
            for (const r of toRepair) {
                repairRowsContent.push({ x: 16, y: contentY, w: rowW, h: rowH, ...r });
                contentY += SHOP_ROW_HEIGHT;
            }
            contentY += 8;
        }
    }

    const dropdowns: ShopDropdownSection[] = [];
    const allItemRows: ShopItemRow[] = [];
    const dropdownHeaders: ShopDropdownHeader[] = [];
    let globalIndex = 0;

    for (const weaponKey of SHOP_WEAPON_TYPE_ORDER) {
        const items = byType[weaponKey] ?? [];
        const expanded = expandedWeapons?.[weaponKey] !== false;
        const title = SHOP_WEAPON_TYPE_LABELS[weaponKey] ?? weaponKey;

        const headerRect = {
            x: 16,
            y: contentY,
            w: panelW - 32,
            h: SHOP_DROPDOWN_HEADER_HEIGHT - 2,
            weaponKey,
            title,
            expanded
        };
        contentY += SHOP_DROPDOWN_HEADER_HEIGHT;

        const itemRows: ShopItemRow[] = [];
        if (expanded) {
            for (const item of items) {
                itemRows.push({
                    x: 16,
                    y: contentY,
                    w: panelW - 32,
                    h: SHOP_ROW_HEIGHT - 2,
                    index: globalIndex,
                    weaponKey: item.weaponKey,
                    price: item.price
                });
                allItemRows.push(itemRows[itemRows.length - 1]);
                contentY += SHOP_ROW_HEIGHT;
                globalIndex++;
            }
        }

        dropdownHeaders.push(headerRect);
        dropdowns.push({ header: headerRect, itemRows });
    }

    const contentHeight = contentY - SHOP_HEADER_HEIGHT;
    const visibleContentH = panelH - SHOP_HEADER_HEIGHT - SHOP_BACK_AREA_HEIGHT;
    const maxScrollOffset = Math.max(0, contentHeight - visibleContentH);
    const clampedScroll = Math.max(0, Math.min(scrollOffset, maxScrollOffset));

    const backW = 100;
    const backH = 36;
    const back = {
        x: panelX + (panelW - backW) / 2,
        y: panelY + panelH - backH - 16,
        w: backW,
        h: backH
    };

    const headerOffset = panelY - clampedScroll;
    const dropdownsAdjusted: ShopDropdownSection[] = dropdowns.map((dd) => ({
        header: {
            ...dd.header,
            x: panelX + dd.header.x,
            y: headerOffset + dd.header.y
        },
        itemRows: dd.itemRows.map((r) => ({
            ...r,
            x: panelX + r.x,
            y: headerOffset + r.y
        }))
    }));
    const allItemRowsAdjusted = dropdownsAdjusted.flatMap((d) => d.itemRows);
    const dropdownHeadersAdjusted = dropdownsAdjusted.map((d) => d.header);
    const repairRowsAdjusted: ShopRepairRow[] = repairRowsContent.map((r) => ({
        ...r,
        x: panelX + r.x,
        y: headerOffset + r.y
    }));

    return {
        overlay,
        panel: { ...panel, x: panelX, y: panelY },
        dropdowns: dropdownsAdjusted,
        allItemRows: allItemRowsAdjusted,
        dropdownHeaders: dropdownHeadersAdjusted,
        repairRows: repairRowsAdjusted,
        back,
        contentHeight,
        maxScrollOffset
    };
}

export type ShopHit =
    | { type: 'item'; index: number; weaponKey: string; price: number }
    | { type: 'dropdown'; weaponKey: string }
    | { type: 'repair'; source: 'mainhand' | 'offhand'; weaponKey: string; cost: number }
    | { type: 'repair'; source: 'inventory'; bagIndex: number; weaponKey: string; cost: number }
    | { type: 'back' }
    | null;

export function hitTestShop(x: number, y: number, layout: ShopLayout): ShopHit {
    if (inRect(x, y, layout.back)) return { type: 'back' };
    for (const row of layout.repairRows) {
        if (inRect(x, y, row)) {
            if (row.source === 'mainhand' || row.source === 'offhand') {
                return { type: 'repair', source: row.source, weaponKey: row.weaponKey, cost: row.cost };
            }
            return { type: 'repair', source: 'inventory', bagIndex: row.source.bagIndex, weaponKey: row.weaponKey, cost: row.cost };
        }
    }
    for (const header of layout.dropdownHeaders) {
        if (inRect(x, y, header)) return { type: 'dropdown', weaponKey: header.weaponKey };
    }
    for (const row of layout.allItemRows) {
        if (inRect(x, y, row)) return { type: 'item', index: row.index, weaponKey: row.weaponKey, price: row.price };
    }
    return null;
}

function inRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }): boolean {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function getWeaponTooltipLines(key: string): { name: string; rows: { label: string; value: string }[] } {
    const name = getWeaponDisplayName(key);
    const w = Weapons[key];
    const rows: { label: string; value: string }[] = [];
    if (!isWeaponInstance(w)) return { name, rows };
    if (w.baseDamage > 0) rows.push({ label: 'Damage', value: String(w.baseDamage) });
    if (w.baseRange > 0) rows.push({ label: 'Range', value: String(w.baseRange) });
    const hasAttack = (w.comboConfig?.length ?? 0) > 0 || !!w.dashAttack || !!w.chargeAttack || !!w.chargeRelease;
    if (hasAttack) {
        rows.push({ label: 'Speed', value: String(Number(w.speed).toFixed(1)) });
        rows.push({ label: 'Cooldown', value: `${(w.cooldown * 1000).toFixed(0)} ms` });
    }
    if (w.block?.enabled) {
        const pct = Math.round((w.block.damageReduction ?? 0) * 100);
        rows.push({ label: 'Block', value: `${pct}% reduction` });
    }
    const comboCount = w.maxComboStage;
    if (comboCount > 0) rows.push({ label: 'Combo', value: `${comboCount} hit${comboCount !== 1 ? 's' : ''}` });
    if (w.dashAttack) rows.push({ label: 'Dash attack', value: 'Yes' });
    if (w.chargeAttack) rows.push({ label: 'Charge attack', value: 'Yes' });
    if (w.twoHanded) rows.push({ label: 'Two-handed', value: 'Yes' });
    if (w.isRanged) rows.push({ label: 'Ranged', value: 'Yes' });
    return { name, rows };
}

const TOOLTIP_PADDING = 10;
const TOOLTIP_GAP = 8;
const TOOLTIP_LINE_HEIGHT = 16;
const TOOLTIP_MIN_WIDTH = 160;
const TOOLTIP_MAX_WIDTH = 240;
const TOOLTIP_DURABILITY_BAR_HEIGHT = 6;
const TOOLTIP_DURABILITY_BAR_PAD = 8;
const TOOLTIP_DURABILITY_LABEL_HEIGHT = 12;

export function renderWeaponTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { weaponKey: string; x: number; y: number; durability?: number } | null,
    playingState?: PlayingStateShape
): void {
    if (!hover || !Weapons[hover.weaponKey]) return;
    const { name, rows } = getWeaponTooltipLines(hover.weaponKey);
    const W = canvas.width;
    const H = canvas.height;
    const gap = 14;
    let boxW = TOOLTIP_MIN_WIDTH;
    ctx.font = '600 12px Cinzel, Georgia, serif';
    for (const r of rows) {
        const lineW = ctx.measureText(r.label).width + ctx.measureText(r.value).width + 20;
        if (lineW > boxW) boxW = Math.min(TOOLTIP_MAX_WIDTH, lineW + 8);
    }
    const titleW = ctx.measureText(name).width + TOOLTIP_PADDING * 2;
    if (titleW > boxW) boxW = Math.min(TOOLTIP_MAX_WIDTH, titleW);

    let durabilityPercent: number | null = null;
    if (hover.durability != null) {
        durabilityPercent = (100 * hover.durability) / MAX_WEAPON_DURABILITY;
    } else if (playingState && playingState.equippedMainhandDurability != null && hover.weaponKey === playingState.equippedMainhandKey) {
        durabilityPercent = (100 * playingState.equippedMainhandDurability) / MAX_WEAPON_DURABILITY;
    } else if (playingState && playingState.equippedOffhandDurability != null && hover.weaponKey === playingState.equippedOffhandKey) {
        durabilityPercent = (100 * playingState.equippedOffhandDurability) / MAX_WEAPON_DURABILITY;
    }
    const showDurabilityBar = true;
    if (durabilityPercent === null) durabilityPercent = 100;
    const durabilitySectionH = showDurabilityBar
        ? TOOLTIP_DURABILITY_BAR_PAD + TOOLTIP_DURABILITY_LABEL_HEIGHT + 4 + TOOLTIP_DURABILITY_BAR_HEIGHT + TOOLTIP_DURABILITY_BAR_PAD
        : 0;
    const contentH = 28 + rows.length * TOOLTIP_LINE_HEIGHT;
    const boxH = contentH + durabilitySectionH;

    let x = hover.x + gap;
    let y = hover.y - boxH / 2;
    if (x + boxW > W - 8) x = hover.x - boxW - gap;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    if (y + boxH > H - 8) y = H - boxH - 8;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(22, 16, 10, 0.98)';
    ctx.strokeStyle = 'rgba(61, 40, 23, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = '#c9a227';
    ctx.font = '700 13px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + TOOLTIP_PADDING, y + 14);
    ctx.fillStyle = 'rgba(61, 40, 23, 0.6)';
    ctx.fillRect(x + TOOLTIP_PADDING, y + 20, boxW - TOOLTIP_PADDING * 2, 1);
    let rowY = y + 20 + TOOLTIP_GAP + TOOLTIP_LINE_HEIGHT / 2;
    for (const r of rows) {
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 11px Cinzel, Georgia, serif';
        ctx.fillText(r.label, x + TOOLTIP_PADDING, rowY);
        ctx.fillStyle = '#e8dcc8';
        ctx.font = '600 11px Cinzel, Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(r.value, x + boxW - TOOLTIP_PADDING, rowY);
        ctx.textAlign = 'left';
        rowY += TOOLTIP_LINE_HEIGHT;
    }
    if (showDurabilityBar && durabilityPercent !== null) {
        const sectionTop = y + contentH + TOOLTIP_DURABILITY_BAR_PAD;
        const barW = boxW - TOOLTIP_PADDING * 2;
        const barX = x + TOOLTIP_PADDING;
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 10px Cinzel, Georgia, serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('Durability', barX, sectionTop + TOOLTIP_DURABILITY_LABEL_HEIGHT / 2);
        const barY = sectionTop + TOOLTIP_DURABILITY_LABEL_HEIGHT + 4;
        ctx.fillStyle = 'rgba(40, 28, 18, 0.9)';
        ctx.fillRect(barX, barY, barW, TOOLTIP_DURABILITY_BAR_HEIGHT);
        const fillW = Math.max(0, (barW * Math.min(100, Math.max(0, durabilityPercent))) / 100);
        if (fillW > 0) {
            ctx.fillStyle = durabilityPercent > 50 ? '#6a8a4a' : durabilityPercent > 25 ? '#a08040' : '#a05030';
            ctx.fillRect(barX, barY, fillW, TOOLTIP_DURABILITY_BAR_HEIGHT);
        }
        ctx.strokeStyle = 'rgba(61, 40, 23, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, TOOLTIP_DURABILITY_BAR_HEIGHT);
    }
    ctx.restore();
}

const SLOT_RADIUS = 6;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function drawSlot(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, options: { filled?: boolean; symbol?: string; weaponKey?: string; label?: string; highlight?: boolean; emptyLabel?: string; broken?: boolean }) {
    ctx.fillStyle = options.filled ? 'rgba(18, 12, 8, 0.88)' : 'rgba(20, 16, 8, 0.6)';
    if (options.highlight) ctx.fillStyle = 'rgba(201, 162, 39, 0.2)';
    roundRect(ctx, r.x, r.y, r.w, r.h, SLOT_RADIUS);
    ctx.fill();
    ctx.strokeStyle = options.highlight ? 'rgba(201, 162, 39, 0.9)' : 'rgba(61, 40, 23, 0.6)';
    ctx.lineWidth = options.highlight ? 2 : 1;
    roundRect(ctx, r.x, r.y, r.w, r.h, SLOT_RADIUS);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const iconSize = Math.min(r.w, r.h) / 2 - 4;
    if (options.weaponKey) {
        drawWeaponIcon(ctx, cx, cy, iconSize, options.weaponKey);
    } else {
        const fontSize = r.w >= 56 ? 24 : 20;
        if (options.symbol) {
            ctx.fillStyle = '#e0c8a0';
            ctx.font = `600 ${fontSize}px Cinzel, Georgia, serif`;
            ctx.fillText(options.symbol, cx, cy);
        } else if (options.emptyLabel) {
            ctx.fillStyle = '#5a4a38';
            ctx.font = `500 ${fontSize - 4}px Cinzel, Georgia, serif`;
            ctx.fillText(options.emptyLabel, cx, cy);
        }
    }
    if (options.broken && options.weaponKey) {
        ctx.fillStyle = 'rgba(80, 20, 20, 0.45)';
        roundRect(ctx, r.x, r.y, r.w, r.h, SLOT_RADIUS);
        ctx.fill();
        const pad = 4;
        const size = Math.min(r.w, r.h) - pad * 2;
        const x1 = cx - size / 2;
        const y1 = cy - size / 2;
        ctx.strokeStyle = '#c04040';
        ctx.lineWidth = Math.max(2, size / 10);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + size, y1 + size);
        ctx.moveTo(x1 + size, y1);
        ctx.lineTo(x1, y1 + size);
        ctx.stroke();
    }
    let labelY = r.y + r.h + 10;
    if (options.label) {
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 10px Cinzel, Georgia, serif';
        ctx.fillText(options.label, r.x + r.w / 2, labelY);
    }
}

export function renderInventory(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ps: PlayingStateShape,
    dragState: DragState,
    weaponTooltipHover: { weaponKey: string; x: number; y: number } | null
): void {
    ensureInventoryInitialized(ps);
    const layout = getInventoryLayout(canvas);
    const { panel, slots, equipmentMainhand, equipmentOffhand, closeButton } = layout;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const PANEL_RADIUS = 10;

    // Panel background (rounded)
    ctx.fillStyle = 'rgba(24, 18, 14, 0.97)';
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 50, 32, 0.85)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, PANEL_RADIUS);
    ctx.stroke();

    // Header bar
    ctx.fillStyle = 'rgba(28, 20, 14, 0.96)';
    ctx.fillRect(panel.x, panel.y, panel.w, 52);
    ctx.fillStyle = 'rgba(55, 38, 25, 0.5)';
    ctx.fillRect(panel.x, panel.y + 51, panel.w, 1);

    // Title
    ctx.fillStyle = '#c9a227';
    ctx.font = '700 20px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Character', panel.x + 20, panel.y + 26);

    // Close button (rounded)
    ctx.fillStyle = 'rgba(26, 18, 12, 0.92)';
    roundRect(ctx, closeButton.x, closeButton.y, closeButton.w, closeButton.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 42, 28, 0.8)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, closeButton.x, closeButton.y, closeButton.w, closeButton.h, 6);
    ctx.stroke();
    ctx.fillStyle = '#a08060';
    ctx.font = '600 13px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Close', closeButton.x + closeButton.w / 2, closeButton.y + closeButton.h / 2);

    // Equipment block: subtle card background
    const cardPad = 8;
    const cardX = equipmentMainhand.x - cardPad;
    const cardY = equipmentMainhand.y - cardPad - 18;
    const cardW = equipmentOffhand.x + equipmentOffhand.w - equipmentMainhand.x + cardPad * 2;
    const cardH = EQUIP_SLOT_SIZE + 10 + cardPad * 2 + 18; // label below slot + padding
    ctx.fillStyle = 'rgba(201, 162, 39, 0.04)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();

    // Equipment section label
    ctx.fillStyle = '#a08050';
    ctx.font = '600 11px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('EQUIPMENT', panel.x + 20, equipmentMainhand.y - 20);

    // Gold amount
    const goldText = 'Gold: ' + (ps.gold ?? 0);
    ctx.fillStyle = '#c9a227';
    ctx.font = '600 12px Cinzel, Georgia, serif';
    ctx.fillText(goldText, panel.x + 20, equipmentMainhand.y - 6);

    // Main hand & Off hand as grid slots (symbol, label)
    const mainKey = ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none' ? ps.equippedMainhandKey : null;
    const offKey = ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none' ? ps.equippedOffhandKey : null;
    const dragValidMain = dragState.isDragging && dragState.weaponKey && canEquipWeaponInSlot(dragState.weaponKey, 'mainhand');
    const dragValidOff = dragState.isDragging && dragState.weaponKey && canEquipWeaponInSlot(dragState.weaponKey, 'offhand');
    drawSlot(ctx, equipmentMainhand, {
        filled: true,
        weaponKey: mainKey ?? undefined,
        emptyLabel: mainKey ? undefined : '—',
        label: 'Main hand',
        highlight: !!mainKey || !!dragValidMain,
        broken: !!(mainKey && mainKey !== 'none' && ps.equippedMainhandDurability === 0)
    });
    drawSlot(ctx, equipmentOffhand, {
        filled: true,
        weaponKey: offKey ?? undefined,
        emptyLabel: offKey ? undefined : '—',
        label: 'Off hand',
        highlight: !!offKey || !!dragValidOff,
        broken: !!(offKey && offKey !== 'none' && ps.equippedOffhandDurability === 0)
    });

    // Inventory section label (slightly muted)
    const firstSlotY = slots[0]?.y ?? 0;
    ctx.fillStyle = '#7a6340';
    ctx.font = '600 11px Cinzel, Georgia, serif';
    ctx.fillText('INVENTORY', panel.x + 20, firstSlotY - 16);

    // Inventory grid
    const list = ps.inventorySlots ?? [];
    for (const s of slots) {
        const slot = list[s.index] ?? null;
        const key = getSlotKey(slot);
        drawSlot(ctx, s, {
            filled: !!key,
            weaponKey: key || undefined,
            broken: !!(key && slot && slot.durability === 0)
        });
    }

    // Drag ghost (rounded) — miniature weapon icon
    if (dragState.isDragging && dragState.weaponKey) {
        const ghostSize = 44;
        const gx = dragState.pointerX - ghostSize / 2;
        const gy = dragState.pointerY - ghostSize / 2;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = 'rgba(22, 16, 10, 0.95)';
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.9)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.stroke();
        drawWeaponIcon(ctx, dragState.pointerX, dragState.pointerY, ghostSize / 2 - 4, dragState.weaponKey);
        ctx.globalAlpha = 1;
    }

    renderWeaponTooltip(ctx, canvas, weaponTooltipHover, ps);
    ctx.restore();
}

export function renderChest(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ps: PlayingStateShape,
    dragState: DragState,
    weaponTooltipHover: { weaponKey: string; x: number; y: number } | null
): void {
    const layout = getChestLayout(canvas);
    const chestSlots = ps.chestSlots ?? [];

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Dimmed full-screen background (character sheet is drawn by renderInventory when chest open)
    ctx.fillStyle = 'rgba(10, 8, 6, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    ctx.fillStyle = '#c9a227';
    ctx.font = '700 24px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Choose weapon', cx, layout.weaponSlots[0]?.y ? layout.weaponSlots[0].y - 50 : canvas.height / 2 - 80);

    for (const s of layout.weaponSlots) {
        const instance = s.index < chestSlots.length ? chestSlots[s.index] : undefined;
        const key = instance?.key;
        const isEquipped = key && (ps.equippedMainhandKey === key || ps.equippedOffhandKey === key);
        drawSlot(ctx, s, {
            filled: !!key,
            weaponKey: key ?? undefined,
            emptyLabel: key ? undefined : '—',
            highlight: !!isEquipped,
            broken: !!(key && instance && instance.durability === 0)
        });
    }

    const back = layout.back;
    ctx.fillStyle = 'rgba(26, 18, 12, 0.92)';
    roundRect(ctx, back.x, back.y, back.w, back.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 42, 28, 0.8)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, back.x, back.y, back.w, back.h, 6);
    ctx.stroke();
    ctx.fillStyle = '#a08060';
    const backFontSize = Math.max(12, Math.round(back.h * 0.4));
    ctx.font = `600 ${backFontSize}px Cinzel, Georgia, serif`;
    ctx.fillText('Back', back.x + back.w / 2, back.y + back.h / 2);

    if (dragState.isDragging && dragState.weaponKey) {
        const ghostSize = 44;
        const gx = dragState.pointerX - ghostSize / 2;
        const gy = dragState.pointerY - ghostSize / 2;
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = 'rgba(22, 16, 10, 0.92)';
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.9)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.stroke();
        drawWeaponIcon(ctx, dragState.pointerX, dragState.pointerY, ghostSize / 2 - 4, dragState.weaponKey);
        ctx.globalAlpha = 1;
    }

    renderWeaponTooltip(ctx, canvas, weaponTooltipHover, ps);
    ctx.restore();
}

export function renderShop(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ps: PlayingStateShape
): void {
    const scrollOffset = ps.shopScrollOffset ?? 0;
    const expandedWeapons = ps.shopExpandedWeapons;
    const layout = getShopLayout(canvas, scrollOffset, expandedWeapons, ps);
    const { panel, dropdowns, back } = layout;
    const gold = ps.gold ?? 0;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const overlay = layout.overlay;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(overlay.x, overlay.y, overlay.w, overlay.h);

    ctx.fillStyle = 'rgba(24, 18, 14, 0.98)';
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 50, 32, 0.9)';
    ctx.lineWidth = 2;
    roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 12);
    ctx.stroke();

    ctx.fillStyle = '#c9a227';
    ctx.font = '700 22px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Weapon Shop', panel.x + panel.w / 2, panel.y + 28);

    ctx.font = '600 13px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('Gold: ' + gold, panel.x + 20, panel.y + 54);

    ctx.font = '500 11px Cinzel, Georgia, serif';
    ctx.fillStyle = '#8a7048';
    ctx.textAlign = 'right';
    ctx.fillText('Click category to expand · Click item to buy', panel.x + panel.w - 16, panel.y + 54);
    ctx.textAlign = 'left';

    const contentTop = panel.y + SHOP_HEADER_HEIGHT;
    const contentBottom = panel.y + panel.h - SHOP_BACK_AREA_HEIGHT;
    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, contentTop, panel.w, contentBottom - contentTop);
    ctx.clip();

    if (layout.repairRows.length > 0) {
        const firstY = layout.repairRows[0].y;
        ctx.fillStyle = '#a08050';
        ctx.font = '600 11px Cinzel, Georgia, serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('REPAIR', panel.x + 20, firstY - SHOP_REPAIR_HEADER_HEIGHT + SHOP_REPAIR_HEADER_HEIGHT / 2);
        for (const row of layout.repairRows) {
            const canAfford = gold >= row.cost;
            ctx.fillStyle = canAfford ? 'rgba(40, 32, 24, 0.7)' : 'rgba(30, 22, 16, 0.85)';
            roundRect(ctx, row.x, row.y, row.w, row.h, 4);
            ctx.fill();
            ctx.strokeStyle = canAfford ? 'rgba(100, 80, 50, 0.6)' : 'rgba(50, 40, 30, 0.6)';
            ctx.lineWidth = 1;
            roundRect(ctx, row.x, row.y, row.w, row.h, 4);
            ctx.stroke();
            const iconCx = row.x + 20;
            const iconCy = row.y + row.h / 2;
            drawWeaponIcon(ctx, iconCx, iconCy, 12, row.weaponKey);
            const name = getWeaponDisplayName(row.weaponKey);
            ctx.fillStyle = canAfford ? '#e0c8a0' : '#6a5a4a';
            ctx.font = '500 13px Cinzel, Georgia, serif';
            ctx.textAlign = 'left';
            ctx.fillText(name, row.x + 44, row.y + row.h / 2);
            const durText = `${row.currentDurability}/${MAX_WEAPON_DURABILITY}`;
            ctx.fillStyle = '#8a7048';
            ctx.font = '500 11px Cinzel, Georgia, serif';
            ctx.fillText(durText, row.x + row.w - 100, row.y + row.h / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = canAfford ? '#c9a227' : '#5a4a38';
            ctx.fillText(row.cost + ' g — Repair', row.x + row.w - 10, row.y + row.h / 2);
            ctx.textAlign = 'left';
        }
    }

    for (const dd of dropdowns) {
        const header = dd.header;
        ctx.fillStyle = 'rgba(50, 40, 28, 0.85)';
        roundRect(ctx, header.x, header.y, header.w, header.h, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 80, 50, 0.7)';
        ctx.lineWidth = 1.5;
        roundRect(ctx, header.x, header.y, header.w, header.h, 6);
        ctx.stroke();

        const arrow = header.expanded ? '▼' : '▶';
        ctx.fillStyle = '#c9a227';
        ctx.font = '600 14px Cinzel, Georgia, serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(arrow, header.x + 12, header.y + header.h / 2);
        ctx.fillStyle = '#e0c8a0';
        ctx.fillText(header.title, header.x + 32, header.y + header.h / 2);

        for (const row of dd.itemRows) {
            const canAfford = gold >= row.price;
            ctx.fillStyle = canAfford ? 'rgba(40, 32, 24, 0.7)' : 'rgba(30, 22, 16, 0.85)';
            roundRect(ctx, row.x, row.y, row.w, row.h, 4);
            ctx.fill();
            ctx.strokeStyle = canAfford ? 'rgba(100, 80, 50, 0.6)' : 'rgba(50, 40, 30, 0.6)';
            ctx.lineWidth = 1;
            roundRect(ctx, row.x, row.y, row.w, row.h, 4);
            ctx.stroke();

            const iconCx = row.x + 20;
            const iconCy = row.y + row.h / 2;
            drawWeaponIcon(ctx, iconCx, iconCy, 12, row.weaponKey);
            const name = getWeaponDisplayName(row.weaponKey);
            ctx.fillStyle = canAfford ? '#e0c8a0' : '#6a5a4a';
            ctx.font = '500 13px Cinzel, Georgia, serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, row.x + 44, row.y + row.h / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = canAfford ? '#c9a227' : '#5a4a38';
            ctx.fillText(row.price + ' g', row.x + row.w - 10, row.y + row.h / 2);
            ctx.textAlign = 'left';
        }
    }

    ctx.restore();

    ctx.fillStyle = 'rgba(26, 18, 12, 0.92)';
    roundRect(ctx, back.x, back.y, back.w, back.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 42, 28, 0.8)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, back.x, back.y, back.w, back.h, 6);
    ctx.stroke();
    ctx.fillStyle = '#a08060';
    ctx.font = '600 14px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('Close', back.x + back.w / 2, back.y + back.h / 2);

    ctx.restore();
}
