/**
 * Canvas-based inventory and equipment chest UI: layout, render, and hit-test.
 * Used when inventoryOpen or chestOpen; pointer events handled by Game.
 */
import type { TooltipHover } from '../types/tooltip.js';
import type { ArmorSlotId, InventorySlot, PlayingStateShape, WeaponInstance, PotionConsumable } from '../state/PlayingState.js';
import { getSlotKey, getActiveWeaponSet, getInactiveWeaponSet, INVENTORY_SLOT_COUNT, MAX_WEAPON_DURABILITY, MAX_ARMOR_DURABILITY, CHEST_SLOT_COUNT, TOOLBELT_SLOT_COUNT, isWeaponInstance as isWeaponSlotItem, isWhetstoneSlot, isHerbSlot, isMushroomSlot, isHoneySlot, isPotionSlot, isGoldSlot, isPageSlot, isEnchantScrollSlot } from '../state/PlayingState.js';
import { getTotalGoldFromInventory } from '../state/InventoryActions.js';
import { getArmor, getPlayerArmorReduction, getShopArmorBySlot, SHOP_ARMOR_SLOT_ORDER, SHOP_ARMOR_SLOT_LABELS } from '../armor/armorConfigs.js';
import { canEquipArmorInSlot } from '../state/ArmorActions.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import { canEquipWeaponInSlot } from '../weapons/weaponSlot.js';
import type { Weapon } from '../weapons/Weapon.js';
import {
    getShopByWeaponType,
    SHOP_WEAPON_TYPE_ORDER,
    SHOP_WEAPON_TYPE_LABELS
} from '../config/shopConfig.js';
import { getEnchantmentById, applyEffectsToWeapon } from '../config/enchantmentConfig.js';
import { getRarityStyle } from '../config/rarityConfig.js';
import type { ItemRarity } from '../config/rarityConfig.js';
import { WHETSTONE_REPAIR_PERCENT } from '../config/lootConfig.js';
import { STRATEGY_LOADOUT_SLOT_COUNT, STRATEGY_RECIPES, migrateUnlockedStrategyRecipeIds } from '../config/strategyCraftingConfig.js';
import type { StrategyDirection, StrategyRecipeDef } from '../config/strategyCraftingConfig.js';
import { getStrategyRecipe } from '../config/strategyCraftingConfig.js';
import { getHealChargeTotalHp } from '../config/GameConfig.js';
import { drawHerbIcon, drawMushroomIcon, drawHoneyIcon, drawPotionIcon, drawGoldIcon, drawPageIcon, drawEnchantScrollIcon } from '../graphics/herbMushroomIcons.js';

const STRATEGY_DIRECTION_SYMBOLS: Record<StrategyDirection, string> = { up: '↑', down: '↓', left: '←', right: '→' };
function strategyDirectionToSymbol(d: StrategyDirection): string {
    return STRATEGY_DIRECTION_SYMBOLS[d] ?? d;
}

function isWeaponInstance(w: unknown): w is Weapon {
    return !!w && typeof (w as Weapon).baseDamage === 'number';
}

/** Display damage from active weapon set: mainhand + Defender offhand, including effect modifiers. */
function getDisplayDamage(ps: PlayingStateShape): number | null {
    const active = getActiveWeaponSet(ps);
    let total = 0;
    const mhKey = active.mainhandKey && active.mainhandKey !== 'none' ? active.mainhandKey : null;
    if (mhKey) {
        const w = Weapons[mhKey];
        if (w && isWeaponInstance(w)) {
            const base = {
                baseDamage: (w as Weapon).baseDamage ?? 0,
                baseRange: (w as Weapon).baseRange ?? 0,
                cooldown: typeof (w as Weapon & { cooldown?: number }).cooldown === 'number' ? (w as Weapon & { cooldown?: number }).cooldown : 0.1,
                baseStunBuildup: (w as Weapon & { baseStunBuildup?: number }).baseStunBuildup ?? 25
            };
            const effective = applyEffectsToWeapon(base, active.mainhandEffectIds ?? []) as { baseDamage?: number };
            total += typeof effective.baseDamage === 'number' ? effective.baseDamage : 0;
        }
    }
    const ohKey = active.offhandKey && active.offhandKey !== 'none' ? active.offhandKey : null;
    if (ohKey) {
        const w = Weapons[ohKey];
        if (w && isWeaponInstance(w) && (w as Weapon).name?.includes('Defender')) {
            const base = {
                baseDamage: (w as Weapon).baseDamage ?? 0,
                baseRange: (w as Weapon).baseRange ?? 0,
                cooldown: typeof (w as Weapon & { cooldown?: number }).cooldown === 'number' ? (w as Weapon & { cooldown?: number }).cooldown : 0.1,
                baseStunBuildup: (w as Weapon & { baseStunBuildup?: number }).baseStunBuildup ?? 25
            };
            const effective = applyEffectsToWeapon(base, active.offhandEffectIds ?? []) as { baseDamage?: number };
            total += typeof effective.baseDamage === 'number' ? effective.baseDamage : 0;
        }
    }
    return total > 0 ? total : null;
}

const WEAPON_SYMBOLS: Record<string, string> = {
    sword: '∿',
    shield: '▣',
    defender: '‡',
    dagger: '†',
    greatsword: '⋔',
    crossbow: '⊗',
    bow: '⌓',
    staff: '⎈',
    mace: '◆',
    none: ''
};

export const CHEST_WEAPON_ORDER: string[] = [
    'sword_bronze', 'shield_wooden', 'defender_bronze', 'dagger_bronze', 'greatsword_bronze', 'crossbow', 'bow_oak', 'staff_oak', 'mace_bronze'
];

const INVENTORY_COLS = 6;
const INVENTORY_ROWS = 3;
const INVENTORY_GRID_SLOTS = INVENTORY_COLS * INVENTORY_ROWS;

/** Base weapon key from variant key (e.g. sword_bronze -> sword). */
function getBaseWeaponKey(key: string): string {
    if (!key || key === 'none') return key;
    const i = key.indexOf('_');
    return i > 0 ? key.slice(0, i) : key;
}

export function getWeaponSymbol(key: string): string {
    if (!key) return '';
    const base = getBaseWeaponKey(key);
    return WEAPON_SYMBOLS[base] ?? '?';
}

const BASE_DISPLAY_NAMES: Record<string, string> = {
    sword: 'Sword', shield: 'Shield', defender: 'Defender',
    greatsword: 'Greatsword', mace: 'Mace', dagger: 'Dagger', crossbow: 'Crossbow', bow: 'Bow', staff: 'Staff', none: ''
};

/** Material display name from variant key suffix (e.g. sword_bronze -> Bronze). */
function getMaterialDisplayNameFromKey(key: string): string | null {
    const i = key.indexOf('_');
    if (i <= 0) return null;
    const suffix = key.slice(i + 1);
    return suffix.charAt(0).toUpperCase() + suffix.slice(1).toLowerCase();
}

/** Get display name for a weapon key; optionally prepend rarity word from instance. */
export function getWeaponDisplayName(
    key: string,
    instance?: { rarity?: ItemRarity; effectIds?: (string | null)[] } | null
): string {
    if (!key) return '';
    const baseName = BASE_DISPLAY_NAMES[key] !== undefined
        ? BASE_DISPLAY_NAMES[key]
        : (() => {
            const base = getBaseWeaponKey(key);
            const bn = BASE_DISPLAY_NAMES[base];
            const materialName = getMaterialDisplayNameFromKey(key);
            if (bn && materialName) return `${materialName} ${bn}`;
            return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
        })();
    const rarity = instance?.rarity;
    if (rarity && rarity !== 'common') {
        const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);
        return `${label} ${baseName}`;
    }
    return baseName;
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
    } else if (base === 'bow') {
        const halfLen = s * 0.5;
        const nockY = s * 0.42;
        const limbCurve = 0.52;
        const staveW = Math.max(2, s * 0.08);
        ctx.strokeStyle = colors.stroke;
        ctx.fillStyle = colors.fill;
        ctx.lineWidth = staveW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(halfLen, nockY);
        ctx.quadraticCurveTo(halfLen * 0.5, nockY * limbCurve, 0, 0);
        ctx.quadraticCurveTo(halfLen * 0.5, -nockY * limbCurve, halfLen, -nockY);
        ctx.stroke();
        ctx.strokeStyle = '#5a4030';
        ctx.lineWidth = Math.max(1, staveW * 0.4);
        const bellyCurve = limbCurve + 0.02;
        ctx.beginPath();
        ctx.moveTo(halfLen, nockY * 0.98);
        ctx.quadraticCurveTo(halfLen * 0.5, nockY * bellyCurve, 0, 0);
        ctx.quadraticCurveTo(halfLen * 0.5, -nockY * bellyCurve, halfLen, -nockY * 0.98);
        ctx.stroke();
        ctx.strokeStyle = '#b8a888';
        ctx.lineWidth = lw * 0.8;
        ctx.beginPath();
        ctx.moveTo(halfLen, -nockY);
        ctx.lineTo(halfLen, nockY);
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
    } else if (base === 'staff') {
        const shaftLen = s * 0.72;
        const shaftW = Math.max(2, s * 0.08);
        ctx.strokeStyle = '#3d301a';
        ctx.fillStyle = '#5d4a2e';
        ctx.lineWidth = shaftW;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, shaftLen / 2);
        ctx.lineTo(0, -shaftLen / 2);
        ctx.stroke();
        const orbR = s * 0.18;
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(0, -shaftLen / 2, orbR, 0, Math.PI * 2);
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
    sourceContext: 'inventory' | 'chest' | 'equipment' | 'rerollSlot' | 'armor' | 'toolbelt';
    pointerX: number;
    pointerY: number;
    /** When dragging armor: key and source (inventory index or equipment slot). */
    armorKey?: string;
    sourceArmorSlot?: ArmorSlotId;
    /** True when dragging a whetstone from inventory (use-on-weapon drop). */
    isWhetstone?: boolean;
    /** When dragging herb, mushroom, honey, potion, or gold from inventory (reorder only). */
    dragConsumableType?: 'herb' | 'mushroom' | 'honey' | 'potion' | 'gold' | 'page' | 'enchantScroll';
    /** When dragging a strategy from Strategy Book or from a loadout slot. */
    dragStrategyId?: string;
    /** When dragging from a strategy loadout slot, the source slot index (so we can clear it on drop). */
    sourceStrategyLoadoutIndex?: number;
    /** When sourceContext is 'toolbelt': which toolbelt slot (0..3). */
    sourceToolbeltIndex?: number;
}

export function createDragState(): DragState {
    return {
        isDragging: false,
        weaponKey: '',
        sourceSlotIndex: -1,
        sourceContext: 'inventory',
        pointerX: 0,
        pointerY: 0,
        isWhetstone: false
    };
}

export function ensureInventoryInitialized(ps: PlayingStateShape): void {
    if (!ps.inventorySlots) {
        ps.inventorySlots = Array(INVENTORY_SLOT_COUNT).fill(null) as InventorySlot[];
    } else if (ps.inventorySlots.length < INVENTORY_SLOT_COUNT) {
        ps.inventorySlots = [...ps.inventorySlots, ...Array(INVENTORY_SLOT_COUNT - ps.inventorySlots.length).fill(null)] as InventorySlot[];
    } else if (ps.inventorySlots.length > INVENTORY_SLOT_COUNT) {
        ps.inventorySlots = ps.inventorySlots.slice(0, INVENTORY_SLOT_COUNT);
    }
    if (!ps.toolbeltSlots || ps.toolbeltSlots.length !== TOOLBELT_SLOT_COUNT) {
        ps.toolbeltSlots = Array(TOOLBELT_SLOT_COUNT).fill(null) as (PotionConsumable | null)[];
    }
}

// --- Tab overlay: two panels (left = Strategy Book + loadout, right = inventory) ---
const TAB_LEFT_PANEL_WIDTH_RATIO = 0.34;
const TAB_RIGHT_PANEL_WIDTH_RATIO = 0.36;
const TAB_LEFT_PANEL_MIN_WIDTH = 260;
const TAB_LEFT_PANEL_MAX_WIDTH = 380;
const TAB_RIGHT_PANEL_MIN_WIDTH = 280;
const TAB_RIGHT_PANEL_MAX_WIDTH = 400;
const STRATEGY_LOADOUT_SLOT_SIZE = 44;
const STRATEGY_LOADOUT_GAP = 6;
const STRATEGY_BOOK_ENTRY_HEIGHT = 36;
const STRATEGY_BOOK_HEADER_H = 56;
const STRATEGY_LOADOUT_ROW_H = 52;

export interface TabOverlayLayout {
    leftPanel: { x: number; y: number; w: number; h: number };
    strategyLoadoutSlots: { x: number; y: number; w: number; h: number; index: number }[];
    strategyBookEntries: { x: number; y: number; w: number; h: number; recipeId: string; index: number }[];
    rightPanelRect: { x: number; y: number; w: number; h: number };
}

export function getTabOverlayLayout(canvas: HTMLCanvasElement, panelOffset?: { dx: number; dy: number }): TabOverlayLayout {
    const W = canvas.width;
    const H = canvas.height;
    const leftW = Math.min(TAB_LEFT_PANEL_MAX_WIDTH, Math.max(TAB_LEFT_PANEL_MIN_WIDTH, W * TAB_LEFT_PANEL_WIDTH_RATIO));
    const rightW = Math.min(TAB_RIGHT_PANEL_MAX_WIDTH, Math.max(TAB_RIGHT_PANEL_MIN_WIDTH, W * TAB_RIGHT_PANEL_WIDTH_RATIO));
    const po = panelOffset ?? { dx: 0, dy: 0 };
    const leftPanel = { x: 0 + po.dx, y: 0 + po.dy, w: leftW, h: H };
    const rightPanelRect = { x: W - rightW + po.dx, y: 0 + po.dy, w: rightW, h: H };

    const pad = Math.max(10, Math.min(16, leftW * 0.04));
    const contentLeft = leftPanel.x + pad;
    const contentW = leftPanel.w - pad * 2;

    // Loadout slots: one row at top
    const loadoutY = leftPanel.y + STRATEGY_BOOK_HEADER_H + 8;
    const totalLoadoutW = STRATEGY_LOADOUT_SLOT_COUNT * STRATEGY_LOADOUT_SLOT_SIZE + (STRATEGY_LOADOUT_SLOT_COUNT - 1) * STRATEGY_LOADOUT_GAP;
    const loadoutStartX = contentLeft + (contentW - totalLoadoutW) / 2;
    const strategyLoadoutSlots: { x: number; y: number; w: number; h: number; index: number }[] = [];
    for (let i = 0; i < STRATEGY_LOADOUT_SLOT_COUNT; i++) {
        strategyLoadoutSlots.push({
            x: loadoutStartX + i * (STRATEGY_LOADOUT_SLOT_SIZE + STRATEGY_LOADOUT_GAP),
            y: loadoutY,
            w: STRATEGY_LOADOUT_SLOT_SIZE,
            h: STRATEGY_LOADOUT_SLOT_SIZE,
            index: i
        });
    }

    // Strategy Book entries: list below loadout row
    const bookListTop = loadoutY + STRATEGY_LOADOUT_SLOT_SIZE + 16;
    const strategyBookEntries: { x: number; y: number; w: number; h: number; recipeId: string; index: number }[] = [];
    for (let i = 0; i < STRATEGY_RECIPES.length; i++) {
        const recipe = STRATEGY_RECIPES[i];
        if (!recipe) continue;
        strategyBookEntries.push({
            x: contentLeft,
            y: bookListTop + i * (STRATEGY_BOOK_ENTRY_HEIGHT + 2),
            w: contentW,
            h: STRATEGY_BOOK_ENTRY_HEIGHT,
            recipeId: recipe.id,
            index: i
        });
    }

    return { leftPanel, strategyLoadoutSlots, strategyBookEntries, rightPanelRect };
}

export type TabOverlayHit =
    | { type: 'strategy-loadout-slot'; index: number }
    | { type: 'strategy-book-entry'; recipeId: string }
    | null;

export function hitTestTabOverlay(x: number, y: number, _ps: PlayingStateShape, tabLayout: TabOverlayLayout): TabOverlayHit {
    const { leftPanel, strategyLoadoutSlots, strategyBookEntries } = tabLayout;
    if (x < leftPanel.x || x > leftPanel.x + leftPanel.w || y < leftPanel.y || y > leftPanel.y + leftPanel.h) return null;
    for (const slot of strategyLoadoutSlots) {
        if (inRect(x, y, slot)) return { type: 'strategy-loadout-slot', index: slot.index };
    }
    for (const entry of strategyBookEntries) {
        if (inRect(x, y, entry)) return { type: 'strategy-book-entry', recipeId: entry.recipeId };
    }
    return null;
}

// --- Inventory panel layout (right side, responsive auto layout) ---
const PANEL_WIDTH_RATIO = 0.40;
const PANEL_MIN_WIDTH = 280;
const PANEL_MAX_WIDTH = 440;
/** Header height for inventory panel (title bar); used for drag handle. */
export const HEADER_H = 80;
const SLOT_SIZE = 48;
const SLOT_GAP = 6;
const EQUIP_SLOT_SIZE = 64; // Weapons and armor equipment slots (same size)
const LOADOUT_SLOT_SIZE = 44; // Smaller "other set" slots that sit behind main/off hand
const LOADOUT_OFFSET = 14; // How much loadout slots peek from behind the main slots
const EQUIP_LABEL_SPACE = 36; // Space below each equipment slot for label (and durability) to avoid overlap
/** Horizontal gap between main hand, armor column (head/chest/hands/feet), and off hand */
const EQUIP_SECTION_GAP = 18;
const SECTION_GAP = 20; // Vertical gap between stats block, equipment, and inventory

export interface InventoryLayout {
    panel: { x: number; y: number; w: number; h: number };
    slots: { x: number; y: number; w: number; h: number; index: number }[];
    equipmentMainhand: { x: number; y: number; w: number; h: number };
    equipmentOffhand: { x: number; y: number; w: number; h: number };
    /** Loadout slots (inactive set) drawn behind main/off hand; cycle when swapping with R */
    loadoutMainhand: { x: number; y: number; w: number; h: number };
    loadoutOffhand: { x: number; y: number; w: number; h: number };
    equipmentArmor: { head: { x: number; y: number; w: number; h: number }; chest: { x: number; y: number; w: number; h: number }; hands: { x: number; y: number; w: number; h: number }; feet: { x: number; y: number; w: number; h: number } };
    closeButton: { x: number; y: number; w: number; h: number };
    /** When includeChestGrid is true, chest slots are placed inside the panel below the inventory grid. */
    chestSlots?: { x: number; y: number; w: number; h: number; index: number }[];
}

const CHEST_COLS_IN_PANEL = 4;
const CHEST_ROWS_IN_PANEL = 3;
const CHEST_SLOTS_IN_PANEL = CHEST_COLS_IN_PANEL * CHEST_ROWS_IN_PANEL;

export function getInventoryLayout(canvas: HTMLCanvasElement, options?: { includeChestGrid?: boolean; panelOffset?: { dx: number; dy: number }; overridePanel?: { x: number; y: number; w: number; h: number } }): InventoryLayout {
    const W = canvas.width;
    const H = canvas.height;
    const override = options?.overridePanel;
    const panelW = override ? override.w : Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, W * PANEL_WIDTH_RATIO));
    let panelX = override ? override.x : W - panelW;
    let panelY = override ? override.y : 0;
    const panelH = override ? override.h : H;
    const po = options?.panelOffset;
    if (po && !override) {
        panelX += po.dx;
        panelY += po.dy;
    }
    const padding = Math.max(12, Math.min(20, W * 0.02));
    const contentX = panelX + padding;
    const contentW = panelW - padding * 2;

    // Header: title + close + stats
    const headerH = HEADER_H;
    const closeW = 64;
    const closeH = 32;
    const closeButton = { x: panelX + panelW - padding - closeW, y: panelY + (headerH - closeH) / 2, w: closeW, h: closeH };

    // Equipment section: armor stacked vertically (head, chest, hands, feet) with main hand left, off hand right
    const equipSectionTop = panelY + headerH + SECTION_GAP;
    const equipLabelH = 26;
    const equipY = equipSectionTop + equipLabelH;
    const armorSlotStep = EQUIP_SLOT_SIZE + EQUIP_LABEL_SPACE + SLOT_GAP;
    const armorColumnHeight = 3 * armorSlotStep + EQUIP_SLOT_SIZE + EQUIP_LABEL_SPACE;
    const armorStartX = contentX + contentW / 2 - EQUIP_SLOT_SIZE / 2;
    const equipmentArmor = {
        head: { x: armorStartX, y: equipY, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE },
        chest: { x: armorStartX, y: equipY + armorSlotStep, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE },
        hands: { x: armorStartX, y: equipY + 2 * armorSlotStep, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE },
        feet: { x: armorStartX, y: equipY + 3 * armorSlotStep, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE },
    };
    const weaponSlotY = equipY + armorColumnHeight / 2 - EQUIP_SLOT_SIZE / 2;
    const equipmentMainhand = { x: armorStartX - EQUIP_SECTION_GAP - EQUIP_SLOT_SIZE, y: weaponSlotY, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE };
    const equipmentOffhand = { x: armorStartX + EQUIP_SLOT_SIZE + EQUIP_SECTION_GAP, y: weaponSlotY, w: EQUIP_SLOT_SIZE, h: EQUIP_SLOT_SIZE };
    const loadoutMainhand = { x: equipmentMainhand.x - LOADOUT_SLOT_SIZE + LOADOUT_OFFSET, y: weaponSlotY + LOADOUT_OFFSET, w: LOADOUT_SLOT_SIZE, h: LOADOUT_SLOT_SIZE };
    const loadoutOffhand = { x: equipmentOffhand.x + EQUIP_SLOT_SIZE - LOADOUT_OFFSET - LOADOUT_SLOT_SIZE, y: weaponSlotY + LOADOUT_OFFSET, w: LOADOUT_SLOT_SIZE, h: LOADOUT_SLOT_SIZE };

    // Inventory grid below armor equipment (3×6 slots), centered in pane (spacing from equipment)
    const gridTop = equipY + armorColumnHeight + SECTION_GAP;
    const slots: { x: number; y: number; w: number; h: number; index: number }[] = [];
    const totalGapW = (INVENTORY_COLS - 1) * SLOT_GAP;
    const totalGapH = (INVENTORY_ROWS - 1) * SLOT_GAP;
    const availableH = panelH - gridTop - padding;
    const maxSlotByW = (contentW - totalGapW) / INVENTORY_COLS;
    const maxSlotByH = (availableH - totalGapH) / INVENTORY_ROWS;
    const slotSize = Math.min(SLOT_SIZE, maxSlotByW, maxSlotByH);
    const gridWidth = INVENTORY_COLS * slotSize + totalGapW;
    const gridStartX = panelX + (panelW - gridWidth) / 2;
    for (let row = 0; row < INVENTORY_ROWS; row++) {
        for (let col = 0; col < INVENTORY_COLS; col++) {
            const index = row * INVENTORY_COLS + col;
            const x = gridStartX + col * (slotSize + SLOT_GAP);
            const y = gridTop + row * (slotSize + SLOT_GAP);
            slots.push({ x, y, w: slotSize, h: slotSize, index });
        }
    }

    const result: InventoryLayout = {
        panel: { x: panelX, y: panelY, w: panelW, h: panelH },
        slots,
        equipmentMainhand,
        equipmentOffhand,
        loadoutMainhand,
        loadoutOffhand,
        equipmentArmor,
        closeButton
    };

    if (options?.includeChestGrid) {
        const invGridBottom = gridTop + INVENTORY_ROWS * (slotSize + SLOT_GAP) - SLOT_GAP;
        const chestSectionMargin = 18;
        const chestLabelH = 14;
        const chestGridTop = invGridBottom + chestSectionMargin + chestLabelH;
        const chestTotalGapW = (CHEST_COLS_IN_PANEL - 1) * SLOT_GAP;
        const chestTotalGapH = (CHEST_ROWS_IN_PANEL - 1) * SLOT_GAP;
        const chestSlotW = (contentW - chestTotalGapW) / CHEST_COLS_IN_PANEL;
        const chestSlotH = Math.min(slotSize, chestSlotW);
        const chestStartX = contentX + (contentW - (CHEST_COLS_IN_PANEL * chestSlotW + chestTotalGapW)) / 2;
        const chestSlots: { x: number; y: number; w: number; h: number; index: number }[] = [];
        for (let i = 0; i < CHEST_SLOTS_IN_PANEL; i++) {
            const col = i % CHEST_COLS_IN_PANEL;
            const row = Math.floor(i / CHEST_COLS_IN_PANEL);
            chestSlots.push({
                x: chestStartX + col * (chestSlotW + SLOT_GAP),
                y: chestGridTop + row * (chestSlotH + SLOT_GAP),
                w: chestSlotW,
                h: chestSlotH,
                index: i
            });
        }
        result.chestSlots = chestSlots;
    }

    return result;
}

export type InventoryHit =
    | { type: 'inventory-slot'; index: number; weaponKey: string | null; durability?: number; rarity?: ItemRarity; effectIds?: (string | null)[]; itemType?: 'weapon' | 'armor' | 'whetstone' | 'herb' | 'mushroom' | 'honey' | 'potion' | 'gold' | 'page' | 'enchantScroll' }
    | { type: 'equipment'; slot: 'mainhand' | 'offhand' }
    | { type: 'chest-slot'; index: number; key: string }
    | { type: 'armor-equipment'; slot: ArmorSlotId }
    | { type: 'close' }
    | null;

export function hitTestInventory(
    x: number,
    y: number,
    ps: PlayingStateShape,
    layout: InventoryLayout,
    chestSlots?: WeaponInstance[] | null
): InventoryHit {
    const { panel, slots, equipmentMainhand, equipmentOffhand, equipmentArmor, closeButton } = layout;
    if (x < panel.x || x > panel.x + panel.w || y < panel.y || y > panel.y + panel.h) return null;
    if (inRect(x, y, closeButton)) return { type: 'close' };
    if (inRect(x, y, equipmentMainhand)) return { type: 'equipment', slot: 'mainhand' };
    if (inRect(x, y, equipmentOffhand)) return { type: 'equipment', slot: 'offhand' };
    const armorSlots: Array<{ slot: ArmorSlotId; r: { x: number; y: number; w: number; h: number } }> = [
        { slot: 'head', r: equipmentArmor.head },
        { slot: 'chest', r: equipmentArmor.chest },
        { slot: 'hands', r: equipmentArmor.hands },
        { slot: 'feet', r: equipmentArmor.feet },
    ];
    for (const { slot, r } of armorSlots) {
        if (inRect(x, y, r)) return { type: 'armor-equipment', slot };
    }
    for (const s of slots) {
        if (inRect(x, y, s)) {
            const slot = ps.inventorySlots?.[s.index] ?? null;
            const key = getSlotKey(slot);
            const itemType = isWhetstoneSlot(slot) ? 'whetstone' : isHerbSlot(slot) ? 'herb' : isMushroomSlot(slot) ? 'mushroom' : isHoneySlot(slot) ? 'honey' : isPotionSlot(slot) ? 'potion' : isPageSlot(slot) ? 'page' : isEnchantScrollSlot(slot) ? 'enchantScroll' : isGoldSlot(slot) ? 'gold' : key ? (getArmor(key) ? 'armor' : 'weapon') : undefined;
            return { type: 'inventory-slot', index: s.index, weaponKey: key, durability: slot && 'durability' in slot ? slot.durability : undefined, rarity: slot && 'rarity' in slot ? slot.rarity : undefined, effectIds: slot && 'effectIds' in slot ? slot.effectIds : undefined, itemType };
        }
    }
    if (layout.chestSlots && chestSlots) {
        for (const s of layout.chestSlots) {
            if (inRect(x, y, s)) {
                const instance = s.index < chestSlots.length ? chestSlots[s.index] : undefined;
                const key = instance?.key ?? '';
                return { type: 'chest-slot', index: s.index, key };
            }
        }
    }
    return null;
}

// --- Chest overlay layout (center only; character sheet is shared inventory panel) ---
const CHEST_SLOT_SIZE = 56;
const CHEST_COLS = 4;
const CHEST_MAX_SLOTS = CHEST_SLOT_COUNT;
const CHEST_GAP = 0;

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

export function hitTestChest(x: number, y: number, layout: ChestLayout, chestSlots: (WeaponInstance | null)[]): ChestHit {
    if (inRect(x, y, layout.back)) return { type: 'back' };
    for (const s of layout.weaponSlots) {
        if (inRect(x, y, s)) {
            const instance = s.index < chestSlots.length ? chestSlots[s.index] : null;
            const key = instance?.key ?? '';
            return { type: 'weapon-slot', index: s.index, key };
        }
    }
    return null;
}

// --- Shop UI (buy weapons) ---
const SHOP_ROW_HEIGHT = 32;
const SHOP_DROPDOWN_HEADER_HEIGHT = 36;
const SHOP_PANEL_WIDTH = 1120;
/** Shop panel header height (drag handle area). */
export const SHOP_HEADER_HEIGHT = 72;
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

/** One repairable item row in the shop (weapon or armor). */
export interface ShopRepairRow {
    x: number;
    y: number;
    w: number;
    h: number;
    source: 'mainhand' | 'offhand' | { bagIndex: number } | { armorSlot: ArmorSlotId } | { armorBagIndex: number };
    weaponKey?: string;
    armorKey?: string;
    currentDurability: number;
    cost: number;
}

/** One armor item row in the shop. */
export interface ShopArmorRow {
    x: number;
    y: number;
    w: number;
    h: number;
    armorKey: string;
    price: number;
}

export interface ShopArmorDropdownHeader {
    x: number;
    y: number;
    w: number;
    h: number;
    slot: ArmorSlotId;
    title: string;
    expanded: boolean;
}

export interface ShopArmorDropdownSection {
    header: ShopArmorDropdownHeader;
    itemRows: ShopArmorRow[];
}

/** Parent category id for the shop (Weapons vs Armor). */
export type ShopParentCategoryId = 'weapons' | 'armor';

export interface ShopParentHeader {
    x: number;
    y: number;
    w: number;
    h: number;
    id: ShopParentCategoryId;
    title: string;
    expanded: boolean;
}

export interface ShopLayout {
    overlay: { x: number; y: number; w: number; h: number };
    panel: { x: number; y: number; w: number; h: number };
    /** Parent category headers (Weapons, Armor) - collapsible, auto-collapsed. */
    parentHeaders: ShopParentHeader[];
    dropdowns: ShopDropdownSection[];
    /** Armor categories (collapsible like weapon dropdowns). */
    armorDropdowns: ShopArmorDropdownSection[];
    /** Flat list of all item rows for hit-testing. */
    allItemRows: ShopItemRow[];
    /** Dropdown header rects for hit-testing. */
    dropdownHeaders: ShopDropdownHeader[];
    /** Repair section rows (when playingState provided). */
    repairRows: ShopRepairRow[];
    /** Armor for sale rows (from expanded armor dropdowns only, for hit-testing). */
    armorRows: ShopArmorRow[];
    back: { x: number; y: number; w: number; h: number };
    contentHeight: number;
    maxScrollOffset: number;
}

/** Gold per point of durability restored at the shop. */
export const REPAIR_GOLD_PER_DURABILITY = 5;

const SHOP_VISIBLE_PANEL_HEIGHT = 1080;

const SHOP_REPAIR_HEADER_HEIGHT = 36;
const SHOP_PARENT_HEADER_HEIGHT = 40;

export function getShopLayout(
    canvas: HTMLCanvasElement,
    scrollOffset = 0,
    expandedWeapons?: Record<string, boolean>,
    expandedArmor?: Record<string, boolean>,
    expandedCategories?: Record<string, boolean>,
    playingState?: PlayingStateShape
): ShopLayout {
    const W = canvas.width;
    const H = canvas.height;
    const overlay = { x: 0, y: 0, w: W, h: H };
    const panelW = SHOP_PANEL_WIDTH;
    let panelX = (W - panelW) / 2;
    const panelH = Math.min(SHOP_VISIBLE_PANEL_HEIGHT, H - 80);
    let panelY = (H - panelH) / 2;
    const po = playingState?.uiPanelOffsets?.shop;
    if (po) {
        panelX += po.dx;
        panelY += po.dy;
    }
    const panel = { x: panelX, y: panelY, w: panelW, h: panelH };

    const byType = getShopByWeaponType();
    let contentY = SHOP_HEADER_HEIGHT;
    const repairRowsContent: ShopRepairRow[] = [];

    if (playingState) {
        const rowW = panelW - 32;
        const rowH = SHOP_ROW_HEIGHT - 2;
        const toRepair: Omit<ShopRepairRow, 'x' | 'y' | 'w' | 'h'>[] = [];
        const activeSet = getActiveWeaponSet(playingState);
        const mainKey = activeSet.mainhandKey;
        const mainDur = activeSet.mainhandDurability ?? MAX_WEAPON_DURABILITY;
        if (mainKey && mainKey !== 'none' && mainDur < MAX_WEAPON_DURABILITY) {
            toRepair.push({ source: 'mainhand', weaponKey: mainKey, currentDurability: mainDur, cost: (MAX_WEAPON_DURABILITY - mainDur) * REPAIR_GOLD_PER_DURABILITY });
        }
        const offKey = activeSet.offhandKey;
        const offDur = activeSet.offhandDurability ?? MAX_WEAPON_DURABILITY;
        if (offKey && offKey !== 'none' && offDur < MAX_WEAPON_DURABILITY) {
            toRepair.push({ source: 'offhand', weaponKey: offKey, currentDurability: offDur, cost: (MAX_WEAPON_DURABILITY - offDur) * REPAIR_GOLD_PER_DURABILITY });
        }
        const slots = playingState.inventorySlots ?? [];
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (!slot || !isWeaponSlotItem(slot) || slot.durability >= MAX_WEAPON_DURABILITY) continue;
            toRepair.push({ source: { bagIndex: i }, weaponKey: slot.key, currentDurability: slot.durability, cost: (MAX_WEAPON_DURABILITY - slot.durability) * REPAIR_GOLD_PER_DURABILITY });
        }
        const armorSlots: Array<{ key: string; dur: number; slot: ArmorSlotId }> = [
            { key: playingState.equippedArmorHeadKey, dur: playingState.equippedArmorHeadDurability, slot: 'head' },
            { key: playingState.equippedArmorChestKey, dur: playingState.equippedArmorChestDurability, slot: 'chest' },
            { key: playingState.equippedArmorHandsKey, dur: playingState.equippedArmorHandsDurability, slot: 'hands' },
            { key: playingState.equippedArmorFeetKey, dur: playingState.equippedArmorFeetDurability, slot: 'feet' },
        ];
        for (const { key, dur, slot } of armorSlots) {
            if (key && key !== 'none' && dur < MAX_ARMOR_DURABILITY) {
                toRepair.push({ source: { armorSlot: slot }, armorKey: key, currentDurability: dur, cost: (MAX_ARMOR_DURABILITY - dur) * REPAIR_GOLD_PER_DURABILITY });
            }
        }
        const inv = playingState.inventorySlots ?? [];
        for (let i = 0; i < inv.length; i++) {
            const item = inv[i];
            if (!item || !('key' in item) || !getArmor(item.key) || item.durability >= MAX_ARMOR_DURABILITY) continue;
            toRepair.push({ source: { armorBagIndex: i }, armorKey: item.key, currentDurability: item.durability, cost: (MAX_ARMOR_DURABILITY - item.durability) * REPAIR_GOLD_PER_DURABILITY });
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

    const parentHeadersContent: ShopParentHeader[] = [];
    const dropdowns: ShopDropdownSection[] = [];
    const allItemRows: ShopItemRow[] = [];
    const dropdownHeaders: ShopDropdownHeader[] = [];
    let globalIndex = 0;

    // Parent: Weapons
    const weaponsExpanded = expandedCategories?.['weapons'] === true;
    parentHeadersContent.push({
        x: 16,
        y: contentY,
        w: panelW - 32,
        h: SHOP_PARENT_HEADER_HEIGHT - 2,
        id: 'weapons',
        title: 'Weapons',
        expanded: weaponsExpanded
    });
    contentY += SHOP_PARENT_HEADER_HEIGHT;

    if (weaponsExpanded) {
        for (const weaponKey of SHOP_WEAPON_TYPE_ORDER) {
            const items = byType[weaponKey] ?? [];
            const expanded = expandedWeapons?.[weaponKey] === true;
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
    }

    // Parent: Armor
    const armorExpanded = expandedCategories?.['armor'] === true;
    parentHeadersContent.push({
        x: 16,
        y: contentY,
        w: panelW - 32,
        h: SHOP_PARENT_HEADER_HEIGHT - 2,
        id: 'armor',
        title: 'Armor',
        expanded: armorExpanded
    });
    contentY += SHOP_PARENT_HEADER_HEIGHT;

    const armorBySlot = getShopArmorBySlot();
    const armorDropdownsContent: ShopArmorDropdownSection[] = [];
    const armorRowsContent: ShopArmorRow[] = [];
    if (armorExpanded) {
        for (const slot of SHOP_ARMOR_SLOT_ORDER) {
            const items = armorBySlot[slot] ?? [];
            const expanded = expandedArmor?.[slot] === true;
            const title = SHOP_ARMOR_SLOT_LABELS[slot] ?? slot;

            const headerRect: ShopArmorDropdownHeader = {
                x: 16,
                y: contentY,
                w: panelW - 32,
                h: SHOP_DROPDOWN_HEADER_HEIGHT - 2,
                slot,
                title,
                expanded
            };
            contentY += SHOP_DROPDOWN_HEADER_HEIGHT;

            const itemRows: ShopArmorRow[] = [];
            if (expanded) {
                for (const entry of items) {
                    const row: ShopArmorRow = {
                        x: 16,
                        y: contentY,
                        w: panelW - 32,
                        h: SHOP_ROW_HEIGHT - 2,
                        armorKey: entry.key,
                        price: entry.price
                    };
                    itemRows.push(row);
                    armorRowsContent.push(row);
                    contentY += SHOP_ROW_HEIGHT;
                }
            }
            armorDropdownsContent.push({ header: headerRect, itemRows });
        }
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
    const parentHeadersAdjusted: ShopParentHeader[] = parentHeadersContent.map((ph) => ({
        ...ph,
        x: panelX + ph.x,
        y: headerOffset + ph.y
    }));
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
    const armorDropdownsAdjusted: ShopArmorDropdownSection[] = armorDropdownsContent.map((ad) => ({
        header: {
            ...ad.header,
            x: panelX + ad.header.x,
            y: headerOffset + ad.header.y
        },
        itemRows: ad.itemRows.map((r) => ({
            ...r,
            x: panelX + r.x,
            y: headerOffset + r.y
        }))
    }));
    const armorRowsAdjusted: ShopArmorRow[] = armorRowsContent.map((r) => ({
        ...r,
        x: panelX + r.x,
        y: headerOffset + r.y
    }));

    return {
        overlay,
        panel: { ...panel, x: panelX, y: panelY },
        parentHeaders: parentHeadersAdjusted,
        dropdowns: dropdownsAdjusted,
        armorDropdowns: armorDropdownsAdjusted,
        allItemRows: allItemRowsAdjusted,
        dropdownHeaders: dropdownHeadersAdjusted,
        repairRows: repairRowsAdjusted,
        armorRows: armorRowsAdjusted,
        back,
        contentHeight,
        maxScrollOffset
    };
}

export type ShopHit =
    | { type: 'item'; index: number; weaponKey: string; price: number }
    | { type: 'dropdown'; weaponKey: string }
    | { type: 'armor-dropdown'; slot: ArmorSlotId }
    | { type: 'parent-category'; category: ShopParentCategoryId }
    | { type: 'repair'; source: 'mainhand' | 'offhand'; weaponKey: string; cost: number }
    | { type: 'repair'; source: 'inventory'; bagIndex: number; weaponKey: string; cost: number }
    | { type: 'repair'; source: 'armor'; armorSlot: ArmorSlotId; armorKey: string; cost: number }
    | { type: 'repair'; source: 'armor-bag'; armorBagIndex: number; armorKey: string; cost: number }
    | { type: 'armor-item'; armorKey: string; price: number }
    | { type: 'back' }
    | null;

export function hitTestShop(x: number, y: number, layout: ShopLayout): ShopHit {
    if (inRect(x, y, layout.back)) return { type: 'back' };
    for (const row of layout.repairRows) {
        if (inRect(x, y, row)) {
            if (row.source === 'mainhand' || row.source === 'offhand') {
                return { type: 'repair', source: row.source, weaponKey: row.weaponKey!, cost: row.cost };
            }
            if ('bagIndex' in row.source) {
                return { type: 'repair', source: 'inventory', bagIndex: row.source.bagIndex, weaponKey: row.weaponKey!, cost: row.cost };
            }
            if ('armorSlot' in row.source) {
                return { type: 'repair', source: 'armor', armorSlot: row.source.armorSlot, armorKey: row.armorKey!, cost: row.cost };
            }
            return { type: 'repair', source: 'armor-bag', armorBagIndex: row.source.armorBagIndex, armorKey: row.armorKey!, cost: row.cost };
        }
    }
    for (const ph of layout.parentHeaders) {
        if (inRect(x, y, ph)) return { type: 'parent-category', category: ph.id };
    }
    for (const ad of layout.armorDropdowns) {
        if (inRect(x, y, ad.header)) return { type: 'armor-dropdown', slot: ad.header.slot };
    }
    for (const row of layout.armorRows) {
        if (inRect(x, y, row)) return { type: 'armor-item', armorKey: row.armorKey, price: row.price };
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

function getWeaponTooltipLines(key: string, instance?: { rarity?: ItemRarity; effectIds?: (string | null)[] } | null): { name: string; rows: { label: string; value: string }[] } {
    const name = getWeaponDisplayName(key, instance);
    const w = Weapons[key];
    const rows: { label: string; value: string }[] = [];
    const effectIds = instance?.effectIds ?? [];
    for (let i = 0; i < effectIds.length; i++) {
        const id = effectIds[i];
        if (id) {
            const enc = getEnchantmentById(id);
            if (enc?.description) rows.push({ label: `Effect ${i + 1}: ${enc.displayName}`, value: enc.description });
        } else {
            rows.push({ label: `Slot ${i + 1}`, value: 'Empty' });
        }
    }
    if (!isWeaponInstance(w)) return { name, rows };
    const baseForEnchant = {
        baseDamage: w.baseDamage ?? 0,
        baseRange: w.baseRange ?? 0,
        cooldown: typeof (w as Weapon & { cooldown?: number }).cooldown === 'number' ? (w as Weapon & { cooldown?: number }).cooldown : 0.1,
        baseStunBuildup: (w as Weapon & { baseStunBuildup?: number }).baseStunBuildup ?? 25
    };
    const effective = applyEffectsToWeapon(baseForEnchant, effectIds) as { baseDamage?: number; baseRange?: number };
    const damage = typeof effective.baseDamage === 'number' ? effective.baseDamage : w.baseDamage ?? 0;
    const range = typeof effective.baseRange === 'number' ? effective.baseRange : w.baseRange ?? 0;
    if (damage > 0) rows.push({ label: 'Damage', value: String(damage) });
    if (range > 0) rows.push({ label: 'Range', value: String(range) });
    const hasAttack = (w.comboConfig?.length ?? 0) > 0 || !!w.dashAttack || !!w.chargeAttack || !!w.chargeRelease;
    if (hasAttack) {
        rows.push({ label: 'Speed', value: String(Number(w.speed).toFixed(1)) });
    }
    if (w.block?.enabled) {
        const pct = Math.round((w.block.damageReduction ?? 0) * 100);
        rows.push({ label: 'Block', value: `${pct}% reduction` });
    }
    const comboCount = w.maxComboStage;
    if (comboCount > 0) rows.push({ label: 'Combo', value: `${comboCount} hit${comboCount !== 1 ? 's' : ''}` });
    if (w.twoHanded) rows.push({ label: 'Two-handed', value: 'Yes' });
    if (w.isRanged) rows.push({ label: 'Ranged', value: 'Yes' });
    return { name, rows };
}

export interface ArmorTooltipHover {
    armorKey: string;
    x: number;
    y: number;
    durability?: number;
}

function getArmorTooltipLines(armorKey: string): { name: string; rows: { label: string; value: string }[] } {
    const config = getArmor(armorKey);
    const name = config?.name ?? armorKey;
    const rows: { label: string; value: string }[] = [];
    if (!config) return { name, rows };
    const pct = Math.round(config.damageReduction * 100);
    rows.push({ label: 'Damage reduction', value: `${pct}%` });
    const slotLabels: Record<ArmorSlotId, string> = { head: 'Head', chest: 'Chest', hands: 'Hands', feet: 'Feet' };
    rows.push({ label: 'Slot', value: slotLabels[config.slot] ?? config.slot });
    return { name, rows };
}

export function renderArmorTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: ArmorTooltipHover | null,
    playingState?: PlayingStateShape
): void {
    if (!hover || !getArmor(hover.armorKey)) return;
    const { name, rows } = getArmorTooltipLines(hover.armorKey);
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
        durabilityPercent = (100 * hover.durability) / MAX_ARMOR_DURABILITY;
    } else if (playingState) {
        const slotKeys: ArmorSlotId[] = ['head', 'chest', 'hands', 'feet'];
        const slotDurs = [playingState.equippedArmorHeadDurability, playingState.equippedArmorChestDurability, playingState.equippedArmorHandsDurability, playingState.equippedArmorFeetDurability];
        const slotKeysState = [playingState.equippedArmorHeadKey, playingState.equippedArmorChestKey, playingState.equippedArmorHandsKey, playingState.equippedArmorFeetKey];
        for (let i = 0; i < 4; i++) {
            if (slotKeysState[i] === hover.armorKey && slotDurs[i] != null) {
                durabilityPercent = (100 * slotDurs[i]) / MAX_ARMOR_DURABILITY;
                break;
            }
        }
    }
    const showDurabilityBar = true;
    if (durabilityPercent === null) durabilityPercent = 100;
    const durabilitySectionH = showDurabilityBar
        ? TOOLTIP_DURABILITY_BAR_PAD + TOOLTIP_DURABILITY_LABEL_HEIGHT + 4 + TOOLTIP_DURABILITY_BAR_HEIGHT + TOOLTIP_DURABILITY_BAR_PAD
        : 0;
    const tooltipHeaderH = 24 + TOOLTIP_GAP + TOOLTIP_LINE_HEIGHT / 2;
    const contentH = tooltipHeaderH + rows.length * TOOLTIP_LINE_HEIGHT;
    const boxH = contentH + durabilitySectionH;

    let x = hover.x + gap;
    let y = hover.y - boxH / 2;
    if (x + boxW > W - 8) x = hover.x - boxW - gap;
    if (x < 8) x = 8;
    if (y + boxH > H - 8) y = H - boxH - 8;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(22, 16, 10, 0.98)';
    ctx.strokeStyle = 'rgba(61, 40, 23, 0.9)';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, boxW, boxH);
    ctx.strokeRect(x, y, boxW, boxH);
    ctx.fillStyle = 'rgba(201, 162, 39, 0.85)';
    ctx.fillRect(x, y, TOOLTIP_ACCENT_LEFT, boxH);
    ctx.fillStyle = hover.rarity ? getRarityStyle(hover.rarity).text : '#c9a227';
    ctx.font = '700 14px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT, y + 16);
    ctx.fillStyle = 'rgba(61, 40, 23, 0.6)';
    ctx.fillRect(x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT, y + 24, boxW - TOOLTIP_PADDING * 2 - TOOLTIP_ACCENT_LEFT, 1);
    let rowY = y + tooltipHeaderH + TOOLTIP_LINE_HEIGHT / 2;
    for (const r of rows) {
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 12px Cinzel, Georgia, serif';
        ctx.fillText(r.label, x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT, rowY);
        ctx.fillStyle = '#e8dcc8';
        ctx.font = '600 12px Cinzel, Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(r.value, x + boxW - TOOLTIP_PADDING, rowY);
        ctx.textAlign = 'left';
        rowY += TOOLTIP_LINE_HEIGHT;
    }
    if (showDurabilityBar && durabilityPercent !== null) {
        const sectionTop = y + contentH + TOOLTIP_DURABILITY_BAR_PAD;
        const barW = boxW - TOOLTIP_PADDING * 2 - TOOLTIP_ACCENT_LEFT;
        const barX = x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT;
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 11px Cinzel, Georgia, serif';
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

export function renderWhetstoneTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null
): void {
    if (!hover) return;
    const repairAmount = Math.round(MAX_WEAPON_DURABILITY * WHETSTONE_REPAIR_PERCENT);
    const title = hover.count > 1 ? `Whetstone ×${hover.count}` : 'Whetstone';
    const line1 = 'Drag onto a weapon to restore sharpness.';
    const line2 = `Restores ${repairAmount} durability.`;
    const W = canvas.width;
    const H = canvas.height;
    const gap = 14;
    ctx.font = '600 12px Cinzel, Georgia, serif';
    const boxW = Math.min(TOOLTIP_MAX_WIDTH, Math.max(TOOLTIP_MIN_WIDTH, Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + TOOLTIP_PADDING * 2));
    const contentH = 28 + TOOLTIP_LINE_HEIGHT * 2;
    const boxH = contentH;

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
    ctx.fillText(title, x + TOOLTIP_PADDING, y + 14);
    ctx.fillStyle = 'rgba(61, 40, 23, 0.6)';
    ctx.fillRect(x + TOOLTIP_PADDING, y + 20, boxW - TOOLTIP_PADDING * 2, 1);
    ctx.fillStyle = '#e8dcc8';
    ctx.font = '500 11px Cinzel, Georgia, serif';
    ctx.fillText(line1, x + TOOLTIP_PADDING, y + 20 + TOOLTIP_GAP + TOOLTIP_LINE_HEIGHT / 2);
    ctx.fillText(line2, x + TOOLTIP_PADDING, y + 20 + TOOLTIP_GAP + TOOLTIP_LINE_HEIGHT + TOOLTIP_LINE_HEIGHT / 2);
    ctx.restore();
}

export function renderHerbTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null
): void {
    if (!hover) return;
    const title = hover.count > 1 ? `Herb ×${hover.count}` : 'Herb';
    const line1 = 'Gathered from the wild. Used in alchemy or quests.';
    renderGatherTooltip(ctx, canvas, title, line1, hover);
}

export function renderMushroomTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null
): void {
    if (!hover) return;
    const title = hover.count > 1 ? `Mushroom ×${hover.count}` : 'Mushroom';
    const line1 = 'Gathered from the wild. Used in alchemy or quests.';
    renderGatherTooltip(ctx, canvas, title, line1, hover);
}

export function renderHoneyTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null
): void {
    if (!hover) return;
    const title = hover.count > 1 ? `Honey ×${hover.count}` : 'Honey';
    const line1 = 'Collected from beehives on trees. Used in alchemy or consumed for a small heal.';
    renderGatherTooltip(ctx, canvas, title, line1, hover);
}

export function renderPotionTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null,
    healHp: number
): void {
    if (!hover) return;
    const title = hover.count > 1 ? `Potion ×${hover.count}` : 'Potion';
    const line1 = `Heal ${healHp} HP`;
    renderGatherTooltip(ctx, canvas, title, line1, hover);
}

export function renderGoldTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null
): void {
    if (!hover) return;
    const title = hover.count > 1 ? `Gold ×${hover.count}` : 'Gold';
    const line1 = 'Currency. Used at the shop and reroll station.';
    renderGatherTooltip(ctx, canvas, title, line1, hover);
}

export function renderPageTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null
): void {
    if (!hover) return;
    const title = hover.count > 1 ? `Enchantment Page ×${hover.count}` : 'Enchantment Page';
    const line1 = 'Collect 4 to add a random enchantment';
    renderGatherTooltip(ctx, canvas, title, line1, hover);
}

export function renderEnchantScrollTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { x: number; y: number; count: number } | null
): void {
    if (!hover) return;
    const title = hover.count > 1 ? `Enchant Scroll ×${hover.count}` : 'Enchant Scroll';
    const line1 = 'Use at the reroll station to add or reroll an enchantment on a weapon (1 scroll per use).';
    renderGatherTooltip(ctx, canvas, title, line1, hover);
}

function renderGatherTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    title: string,
    line1: string,
    hover: { x: number; y: number }
): void {
    const W = canvas.width;
    const H = canvas.height;
    const gap = 14;
    ctx.font = '600 12px Cinzel, Georgia, serif';
    const boxW = Math.min(TOOLTIP_MAX_WIDTH, Math.max(TOOLTIP_MIN_WIDTH, ctx.measureText(line1).width + TOOLTIP_PADDING * 2));
    const contentH = 28 + TOOLTIP_LINE_HEIGHT;
    const boxH = contentH;
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
    ctx.fillText(title, x + TOOLTIP_PADDING, y + 14);
    ctx.fillStyle = 'rgba(61, 40, 23, 0.6)';
    ctx.fillRect(x + TOOLTIP_PADDING, y + 20, boxW - TOOLTIP_PADDING * 2, 1);
    ctx.fillStyle = '#e8dcc8';
    ctx.font = '500 11px Cinzel, Georgia, serif';
    ctx.fillText(line1, x + TOOLTIP_PADDING, y + 20 + TOOLTIP_GAP + TOOLTIP_LINE_HEIGHT / 2);
    ctx.restore();
}

const TOOLTIP_PADDING = 14;
const TOOLTIP_GAP = 10;
const TOOLTIP_LINE_HEIGHT = 18;
const TOOLTIP_MIN_WIDTH = 172;
const TOOLTIP_MAX_WIDTH = 260;
const TOOLTIP_DURABILITY_BAR_HEIGHT = 6;
const TOOLTIP_DURABILITY_BAR_PAD = 10;
const TOOLTIP_DURABILITY_LABEL_HEIGHT = 12;
const TOOLTIP_ACCENT_LEFT = 3; // Gold accent stripe on left edge

export function renderWeaponTooltip(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    hover: { weaponKey: string; x: number; y: number; durability?: number; rarity?: ItemRarity; effectIds?: (string | null)[] } | null,
    playingState?: PlayingStateShape
): void {
    if (!hover || !Weapons[hover.weaponKey]) return;
    const instance = (hover.rarity != null || (hover.effectIds != null && hover.effectIds.length > 0)) ? { rarity: hover.rarity, effectIds: hover.effectIds ?? [] } : null;
    const { name, rows } = getWeaponTooltipLines(hover.weaponKey, instance);
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
    } else if (playingState) {
        const active = getActiveWeaponSet(playingState);
        if (hover.weaponKey === active.mainhandKey && active.mainhandDurability != null) {
            durabilityPercent = (100 * active.mainhandDurability) / MAX_WEAPON_DURABILITY;
        } else if (hover.weaponKey === active.offhandKey && active.offhandDurability != null) {
            durabilityPercent = (100 * active.offhandDurability) / MAX_WEAPON_DURABILITY;
        }
    }
    const showDurabilityBar = true;
    if (durabilityPercent === null) durabilityPercent = 100;
    const durabilitySectionH = showDurabilityBar
        ? TOOLTIP_DURABILITY_BAR_PAD + TOOLTIP_DURABILITY_LABEL_HEIGHT + 4 + TOOLTIP_DURABILITY_BAR_HEIGHT + TOOLTIP_DURABILITY_BAR_PAD
        : 0;
    const tooltipHeaderH = 24 + TOOLTIP_GAP + TOOLTIP_LINE_HEIGHT / 2;
    const contentH = tooltipHeaderH + rows.length * TOOLTIP_LINE_HEIGHT;
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
    ctx.fillStyle = 'rgba(201, 162, 39, 0.85)';
    ctx.fillRect(x, y, TOOLTIP_ACCENT_LEFT, boxH);
    ctx.fillStyle = hover.rarity ? getRarityStyle(hover.rarity).text : '#c9a227';
    ctx.font = '700 14px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT, y + 16);
    ctx.fillStyle = 'rgba(61, 40, 23, 0.6)';
    ctx.fillRect(x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT, y + 24, boxW - TOOLTIP_PADDING * 2 - TOOLTIP_ACCENT_LEFT, 1);
    let rowY = y + tooltipHeaderH + TOOLTIP_LINE_HEIGHT / 2;
    for (const r of rows) {
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 12px Cinzel, Georgia, serif';
        ctx.fillText(r.label, x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT, rowY);
        ctx.fillStyle = '#e8dcc8';
        ctx.font = '600 12px Cinzel, Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(r.value, x + boxW - TOOLTIP_PADDING, rowY);
        ctx.textAlign = 'left';
        rowY += TOOLTIP_LINE_HEIGHT;
    }
    if (showDurabilityBar && durabilityPercent !== null) {
        const sectionTop = y + contentH + TOOLTIP_DURABILITY_BAR_PAD;
        const barW = boxW - TOOLTIP_PADDING * 2 - TOOLTIP_ACCENT_LEFT;
        const barX = x + TOOLTIP_PADDING + TOOLTIP_ACCENT_LEFT;
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 11px Cinzel, Georgia, serif';
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

const SLOT_RADIUS = 0;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function drawShopParentHeader(ctx: CanvasRenderingContext2D, header: ShopParentHeader): void {
    ctx.fillStyle = 'rgba(45, 35, 22, 0.9)';
    roundRect(ctx, header.x, header.y, header.w, header.h, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 90, 55, 0.85)';
    ctx.lineWidth = 2;
    roundRect(ctx, header.x, header.y, header.w, header.h, 6);
    ctx.stroke();
    const arrow = header.expanded ? '▼' : '▶';
    ctx.fillStyle = '#c9a227';
    ctx.font = '700 15px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(arrow, header.x + 12, header.y + header.h / 2);
    ctx.fillStyle = '#e8d4b0';
    ctx.fillText(header.title, header.x + 32, header.y + header.h / 2);
}

function drawSlot(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, options: { filled?: boolean; symbol?: string; weaponKey?: string; label?: string; highlight?: boolean; emptyLabel?: string; broken?: boolean; itemIcon?: 'herb' | 'mushroom' | 'honey' | 'potion' | 'gold' | 'page' | 'enchantScroll'; stackCount?: number; dimmed?: boolean; rarity?: ItemRarity }) {
    const dimmed = options.dimmed === true;
    ctx.fillStyle = dimmed
        ? (options.filled ? 'rgba(12, 10, 6, 0.75)' : 'rgba(14, 12, 8, 0.5)')
        : (options.filled ? 'rgba(18, 12, 8, 0.88)' : 'rgba(20, 16, 8, 0.6)');
    if (options.highlight && !dimmed) ctx.fillStyle = 'rgba(201, 162, 39, 0.2)';
    roundRect(ctx, r.x, r.y, r.w, r.h, SLOT_RADIUS);
    ctx.fill();
    const borderColor = options.rarity && !dimmed ? getRarityStyle(options.rarity).border : (dimmed ? 'rgba(45, 32, 18, 0.5)' : (options.highlight ? 'rgba(201, 162, 39, 0.9)' : 'rgba(61, 40, 23, 0.6)'));
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = options.highlight && !dimmed ? 2 : 1;
    roundRect(ctx, r.x, r.y, r.w, r.h, SLOT_RADIUS);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const iconSize = Math.min(r.w, r.h) / 2 - 4;
    if (dimmed) ctx.globalAlpha = 0.75;
    if (options.weaponKey) {
        drawWeaponIcon(ctx, cx, cy, iconSize, options.weaponKey);
    } else if (options.itemIcon === 'herb') {
        drawHerbIcon(ctx, cx, cy, iconSize);
    } else if (options.itemIcon === 'mushroom') {
        drawMushroomIcon(ctx, cx, cy, iconSize);
    } else if (options.itemIcon === 'honey') {
        drawHoneyIcon(ctx, cx, cy, iconSize);
    } else if (options.itemIcon === 'potion') {
        drawPotionIcon(ctx, cx, cy, iconSize);
    } else if (options.itemIcon === 'gold') {
        drawGoldIcon(ctx, cx, cy, iconSize);
    } else if (options.itemIcon === 'page') {
        drawPageIcon(ctx, cx, cy, iconSize);
    } else if (options.itemIcon === 'enchantScroll') {
        drawEnchantScrollIcon(ctx, cx, cy, iconSize);
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
    if (options.broken) {
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
    if (options.stackCount != null && options.stackCount > 1) {
        const pad = 2;
        const fontSize = Math.max(9, Math.min(11, Math.floor(r.w * 0.28)));
        ctx.font = `600 ${fontSize}px Cinzel, Georgia, serif`;
        ctx.fillStyle = '#e8dcc8';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`×${options.stackCount}`, r.x + r.w - pad, r.y + r.h - pad);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
    }
    const labelY = r.y + r.h + 18;
    if (dimmed) ctx.globalAlpha = 1;
    if (options.label && !dimmed) {
        ctx.fillStyle = '#8a7048';
        ctx.font = '500 12px Cinzel, Georgia, serif';
        ctx.fillText(options.label, r.x + r.w / 2, labelY);
    }
}

function renderStrategyBookAndLoadoutPanel(
    ctx: CanvasRenderingContext2D,
    ps: PlayingStateShape,
    tabLayout: TabOverlayLayout
): void {
    const { leftPanel, strategyLoadoutSlots, strategyBookEntries } = tabLayout;
    const PANEL_RADIUS = 10;
    const unlocked = migrateUnlockedStrategyRecipeIds(ps.unlockedStrategyRecipeIds ?? []);
    const loadoutIds = ps.strategyLoadoutSlotIds ?? [];

    ctx.fillStyle = 'rgba(24, 18, 14, 0.97)';
    roundRect(ctx, leftPanel.x, leftPanel.y, leftPanel.w, leftPanel.h, PANEL_RADIUS);
    ctx.fill();
    ctx.strokeStyle = 'rgba(70, 50, 32, 0.85)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, leftPanel.x, leftPanel.y, leftPanel.w, leftPanel.h, PANEL_RADIUS);
    ctx.stroke();

    ctx.fillStyle = 'rgba(28, 20, 14, 0.96)';
    ctx.fillRect(leftPanel.x, leftPanel.y, leftPanel.w, STRATEGY_BOOK_HEADER_H);
    ctx.fillStyle = '#c9a227';
    ctx.font = '700 20px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Strategy Book', leftPanel.x + 16, leftPanel.y + 28);

    // Strategy loadout slots
    ctx.fillStyle = '#a08050';
    ctx.font = '600 12px Cinzel, Georgia, serif';
    ctx.fillText('Strategy loadout', leftPanel.x + 16, leftPanel.y + STRATEGY_BOOK_HEADER_H - 2);
    for (let i = 0; i < strategyLoadoutSlots.length; i++) {
        const slot = strategyLoadoutSlots[i];
        if (!slot) continue;
        const strategyId = loadoutIds[slot.index] ?? null;
        const recipe = strategyId ? getStrategyRecipe(strategyId) : null;
        ctx.fillStyle = 'rgba(30, 22, 16, 0.9)';
        roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 6);
        ctx.fill();
        ctx.strokeStyle = recipe ? 'rgba(120, 90, 60, 0.7)' : 'rgba(61, 40, 23, 0.5)';
        ctx.lineWidth = 1;
        roundRect(ctx, slot.x, slot.y, slot.w, slot.h, 6);
        ctx.stroke();
        if (recipe) {
            ctx.fillStyle = '#e8dcc8';
            ctx.font = '500 10px Cinzel, Georgia, serif';
            ctx.textAlign = 'center';
            const shortLabel = recipe.label.length > 10 ? recipe.label.slice(0, 9) + '…' : recipe.label;
            ctx.fillText(shortLabel, slot.x + slot.w / 2, slot.y + slot.h / 2);
            ctx.textAlign = 'left';
        }
    }

    // Strategy Book list
    const bookListTop = strategyBookEntries[0]?.y ?? leftPanel.y + STRATEGY_BOOK_HEADER_H + 60;
    ctx.fillStyle = 'rgba(61, 40, 23, 0.4)';
    ctx.fillRect(leftPanel.x + 16, bookListTop - 10, leftPanel.w - 32, 1);
    ctx.fillStyle = '#a08050';
    ctx.font = '600 12px Cinzel, Georgia, serif';
    ctx.fillText('All strategies', leftPanel.x + 16, bookListTop - 2);

    for (const entry of strategyBookEntries) {
        const recipe = getStrategyRecipe(entry.recipeId);
        if (!recipe) continue;
        const isUnlocked = unlocked.includes(entry.recipeId);
        ctx.fillStyle = isUnlocked ? 'rgba(26, 20, 14, 0.6)' : 'rgba(18, 14, 10, 0.85)';
        roundRect(ctx, entry.x, entry.y, entry.w, entry.h, 4);
        ctx.fill();
        ctx.strokeStyle = isUnlocked ? 'rgba(61, 40, 23, 0.4)' : 'rgba(40, 28, 18, 0.6)';
        ctx.lineWidth = 1;
        roundRect(ctx, entry.x, entry.y, entry.w, entry.h, 4);
        ctx.stroke();
        ctx.fillStyle = isUnlocked ? '#e8dcc8' : '#6a5a4a';
        ctx.font = '500 13px Cinzel, Georgia, serif';
        ctx.textAlign = 'left';
        ctx.fillText(recipe.label, entry.x + 8, entry.y + entry.h / 2 - 6);
        const seqStr = recipe.sequence.map(strategyDirectionToSymbol).join(' ');
        ctx.font = '500 11px Cinzel, Georgia, serif';
        ctx.fillStyle = isUnlocked ? '#8a7048' : '#5a4a38';
        ctx.fillText(seqStr, entry.x + 8, entry.y + entry.h / 2 + 8);
        if (!isUnlocked) {
            ctx.fillStyle = 'rgba(80, 60, 40, 0.5)';
            ctx.font = '500 10px Cinzel, Georgia, serif';
            ctx.fillText('Locked', entry.x + entry.w - 36, entry.y + entry.h / 2);
        }
    }
    ctx.textAlign = 'left';
}

export function renderInventory(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ps: PlayingStateShape,
    dragState: DragState,
    tooltipHover: TooltipHover,
    options?: { includeChestInPanel?: boolean; includeStrategyPanel?: boolean }
): void {
    ensureInventoryInitialized(ps);
    let layout: InventoryLayout;
    if (options?.includeStrategyPanel) {
        const tabLayout = getTabOverlayLayout(canvas, ps.uiPanelOffsets?.strategyBook);
        renderStrategyBookAndLoadoutPanel(ctx, ps, tabLayout);
        const invOffset = ps.uiPanelOffsets?.inventory ?? { dx: 0, dy: 0 };
        const rightPanel = {
            ...tabLayout.rightPanelRect,
            x: tabLayout.rightPanelRect.x + invOffset.dx,
            y: tabLayout.rightPanelRect.y + invOffset.dy
        };
        layout = getInventoryLayout(canvas, {
            includeChestGrid: options?.includeChestInPanel,
            overridePanel: rightPanel
        });
    } else {
        layout = getInventoryLayout(canvas, {
            includeChestGrid: options?.includeChestInPanel,
            panelOffset: ps.uiPanelOffsets?.inventory
        });
    }
    const { panel, slots, equipmentMainhand, equipmentOffhand, loadoutMainhand, loadoutOffhand, equipmentArmor, closeButton, chestSlots } = layout;

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
    ctx.fillRect(panel.x, panel.y, panel.w, HEADER_H);
    ctx.fillStyle = 'rgba(55, 38, 25, 0.5)';
    ctx.fillRect(panel.x, panel.y + HEADER_H - 1, panel.w, 1);

    const headerPad = 24;
    const statsBlockTop = panel.y + 44;
    const statsBlockH = 52;
    const statsBlockPad = 12;

    // Title
    ctx.fillStyle = '#c9a227';
    ctx.font = '700 24px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Character', panel.x + headerPad, panel.y + 28);

    // Stats block (Damage, Armor) – rounded rect for clear hierarchy
    const statsBlockX = panel.x + headerPad;
    const statsBlockW = panel.w - headerPad * 2;
    roundRect(ctx, statsBlockX, statsBlockTop, statsBlockW, statsBlockH, 8);
    ctx.fillStyle = 'rgba(20, 14, 10, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(61, 40, 23, 0.5)';
    ctx.lineWidth = 1;
    roundRect(ctx, statsBlockX, statsBlockTop, statsBlockW, statsBlockH, 8);
    ctx.stroke();

    const damageVal = getDisplayDamage(ps);
    const armorPct = Math.round(getPlayerArmorReduction(ps) * 100);
    const statY = statsBlockTop + statsBlockH / 2;
    ctx.font = '600 15px Cinzel, Georgia, serif';
    ctx.fillStyle = '#8a7048';
    ctx.fillText('Damage:', statsBlockX + statsBlockPad, statY);
    const damageLabelW = ctx.measureText('Damage: ').width;
    ctx.fillStyle = '#e8dcc8';
    ctx.fillText(damageVal != null ? String(damageVal) : '—', statsBlockX + statsBlockPad + damageLabelW, statY);
    const armorX = statsBlockX + statsBlockPad + 95;
    ctx.fillStyle = '#8a7048';
    ctx.fillText('Armor:', armorX, statY);
    const armorLabelW2 = ctx.measureText('Armor: ').width;
    ctx.fillStyle = '#e8dcc8';
    ctx.fillText(armorPct + '%', armorX + armorLabelW2, statY);
    ctx.textAlign = 'left';

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

    // Section divider and equipment label
    ctx.fillStyle = 'rgba(61, 40, 23, 0.4)';
    ctx.fillRect(panel.x + headerPad, equipmentArmor.head.y - 28, panel.w - headerPad * 2, 1);
    ctx.fillStyle = '#a08050';
    ctx.font = '600 14px Cinzel, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('EQUIPMENT', panel.x + headerPad, equipmentArmor.head.y - 10);

    // Loadout slots (inactive set) drawn behind main/off hand — cycle when swapping with R
    const inactive = getInactiveWeaponSet(ps);
    const loadoutMainKey = inactive.mainhandKey && inactive.mainhandKey !== 'none' ? inactive.mainhandKey : null;
    const loadoutOffKey = inactive.offhandKey && inactive.offhandKey !== 'none' ? inactive.offhandKey : null;
    drawSlot(ctx, loadoutMainhand, {
        filled: !!loadoutMainKey,
        weaponKey: loadoutMainKey ?? undefined,
        dimmed: true,
        broken: !!(loadoutMainKey && inactive.mainhandDurability === 0)
    });
    drawSlot(ctx, loadoutOffhand, {
        filled: !!loadoutOffKey,
        weaponKey: loadoutOffKey ?? undefined,
        dimmed: true,
        broken: !!(loadoutOffKey && inactive.offhandDurability === 0)
    });

    // Main hand & Off hand as grid slots (symbol, label) — active set on top
    const active = getActiveWeaponSet(ps);
    const mainKey = active.mainhandKey && active.mainhandKey !== 'none' ? active.mainhandKey : null;
    const offKey = active.offhandKey && active.offhandKey !== 'none' ? active.offhandKey : null;
    const dragValidMain = dragState.isDragging && dragState.weaponKey && canEquipWeaponInSlot(dragState.weaponKey, 'mainhand');
    const dragValidOff = dragState.isDragging && dragState.weaponKey && canEquipWeaponInSlot(dragState.weaponKey, 'offhand');
    drawSlot(ctx, equipmentMainhand, {
        filled: true,
        weaponKey: mainKey ?? undefined,
        rarity: active.mainhandRarity,
        emptyLabel: mainKey ? undefined : undefined,
        label: 'Main hand',
        highlight: !!mainKey || !!dragValidMain,
        broken: !!(mainKey && mainKey !== 'none' && active.mainhandDurability === 0)
    });
    drawSlot(ctx, equipmentOffhand, {
        filled: true,
        weaponKey: offKey ?? undefined,
        rarity: active.offhandRarity,
        emptyLabel: offKey ? undefined : undefined,
        label: 'Off hand',
        highlight: !!offKey || !!dragValidOff,
        broken: !!(offKey && offKey !== 'none' && active.offhandDurability === 0)
    });

    // Armor equipment slots (head, chest, hands, feet)
    const armorSlotData: Array<{ slot: ArmorSlotId; key: string; durability: number }> = [
        { slot: 'head', key: ps.equippedArmorHeadKey, durability: ps.equippedArmorHeadDurability },
        { slot: 'chest', key: ps.equippedArmorChestKey, durability: ps.equippedArmorChestDurability },
        { slot: 'hands', key: ps.equippedArmorHandsKey, durability: ps.equippedArmorHandsDurability },
        { slot: 'feet', key: ps.equippedArmorFeetKey, durability: ps.equippedArmorFeetDurability },
    ];
    const armorLabels: Record<ArmorSlotId, string> = { head: 'Head', chest: 'Chest', hands: 'Hands', feet: 'Feet' };
    for (const { slot, key, durability } of armorSlotData) {
        const r = equipmentArmor[slot];
        const hasArmor = key && key !== 'none';
        const dragValid = dragState.isDragging && dragState.armorKey && canEquipArmorInSlot(dragState.armorKey, slot);
        drawSlot(ctx, r, {
            filled: !!hasArmor,
            symbol: hasArmor ? '◆' : undefined,
            emptyLabel: hasArmor ? undefined : undefined,
            label: armorLabels[slot],
            highlight: !!hasArmor || !!dragValid,
            broken: !!(hasArmor && durability === 0)
        });
        if (hasArmor) {
            ctx.fillStyle = '#8a7048';
            ctx.font = '500 10px Cinzel, Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${durability}/${MAX_ARMOR_DURABILITY}`, r.x + r.w / 2, r.y + r.h + 8);
        }
    }
    // Inventory section label (slightly muted, centered in pane, with clear gap above grid)
    const firstSlotY = slots[0]?.y ?? 0;
    ctx.fillStyle = '#7a6340';
    ctx.font = '600 13px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('INVENTORY', panel.x + panel.w / 2, firstSlotY - 24);
    ctx.textAlign = 'left';

    // Inventory grid (weapons, armor, consumables)
    const list = ps.inventorySlots ?? [];
    for (const s of slots) {
        const slot = list[s.index] ?? null;
        const key = getSlotKey(slot);
        const isWeapon = key ? !!Weapons[key] : false;
        const isArmor = key ? !!getArmor(key) : false;
        const isWhetstone = isWhetstoneSlot(slot);
        const isHerb = isHerbSlot(slot);
        const isMushroom = isMushroomSlot(slot);
        const isHoney = isHoneySlot(slot);
        const isPotion = isPotionSlot(slot);
        const isGold = isGoldSlot(slot);
        const isPage = isPageSlot(slot);
        const isEnchantScroll = isEnchantScrollSlot(slot);
        const isConsumable = isWhetstone || isHerb || isMushroom || isHoney || isPotion || isGold || isPage || isEnchantScroll;
        const stackCount = isConsumable && slot && 'count' in slot ? slot.count : undefined;
        drawSlot(ctx, s, {
            filled: !!key || isConsumable,
            weaponKey: isWeapon ? key ?? undefined : undefined,
            rarity: isWeapon && slot && 'rarity' in slot ? slot.rarity : undefined,
            symbol: isArmor ? '◆' : isWhetstone ? '◉' : undefined,
            itemIcon: isHerb ? 'herb' : isMushroom ? 'mushroom' : isHoney ? 'honey' : isPotion ? 'potion' : isGold ? 'gold' : isPage ? 'page' : isEnchantScroll ? 'enchantScroll' : undefined,
            emptyLabel: !key && !isConsumable ? undefined : undefined,
            stackCount: stackCount != null && (stackCount > 1 || isGold) ? stackCount : undefined,
            label: isWhetstone ? (slot.count > 1 ? `Whetstone ×${slot.count}` : 'Whetstone') : isHerb ? (slot.count > 1 ? `Herb ×${slot.count}` : 'Herb') : isMushroom ? (slot.count > 1 ? `Mushroom ×${slot.count}` : 'Mushroom') : isHoney ? (slot.count > 1 ? `Honey ×${slot.count}` : 'Honey') : isPotion ? (slot.count > 1 ? `Potion ×${slot.count}` : 'Potion') : isGold ? (slot.count > 1 ? `Gold ×${slot.count}` : 'Gold') : isPage ? (slot.count > 1 ? `Enchantment Page ×${slot.count}` : 'Enchantment Page') : isEnchantScroll ? (slot.count > 1 ? `Enchant Scroll ×${slot.count}` : 'Enchant Scroll') : undefined,
            broken: !!(key && isWeaponSlotItem(slot) && slot.durability === 0)
        });
        if (isArmor && key && slot && 'durability' in slot) {
            ctx.fillStyle = '#8a7048';
            ctx.font = '500 10px Cinzel, Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${slot.durability}/${MAX_ARMOR_DURABILITY}`, s.x + s.w / 2, s.y + s.h + 5);
        }
    }

    // Chest grid inside panel (when includeChestInPanel e.g. reroll screen)
    if (chestSlots && chestSlots.length > 0) {
        const chestList = ps.chestSlots ?? [];
        const firstChestY = chestSlots[0].y;
        ctx.fillStyle = '#7a6340';
        ctx.font = '600 11px Cinzel, Georgia, serif';
        ctx.textAlign = 'left';
        ctx.fillText('CHEST', panel.x + 20, firstChestY - 16);
        for (const s of chestSlots) {
            const instance = s.index < chestList.length ? chestList[s.index] : undefined;
            const key = instance?.key;
            const isEquipped = key && (ps.equippedMainhandKey === key || ps.equippedOffhandKey === key || ps.equippedMainhandKey2 === key || ps.equippedOffhandKey2 === key);
            drawSlot(ctx, s, {
                filled: !!key,
                weaponKey: key ?? undefined,
                rarity: instance?.rarity,
                emptyLabel: key ? undefined : undefined,
                highlight: !!isEquipped,
                broken: !!(key && instance && instance.durability === 0)
            });
        }
    }

    renderWeaponTooltip(ctx, canvas, tooltipHover?.type === 'weapon' ? tooltipHover : null, ps);
    renderArmorTooltip(ctx, canvas, tooltipHover?.type === 'armor' ? tooltipHover : null, ps);
    renderWhetstoneTooltip(ctx, canvas, tooltipHover?.type === 'whetstone' ? tooltipHover : null);
    renderHerbTooltip(ctx, canvas, tooltipHover?.type === 'herb' ? tooltipHover : null);
    renderMushroomTooltip(ctx, canvas, tooltipHover?.type === 'mushroom' ? tooltipHover : null);
    renderHoneyTooltip(ctx, canvas, tooltipHover?.type === 'honey' ? tooltipHover : null);
    renderPotionTooltip(ctx, canvas, tooltipHover?.type === 'potion' ? tooltipHover : null, getHealChargeTotalHp());
    renderGoldTooltip(ctx, canvas, tooltipHover?.type === 'gold' ? tooltipHover : null);
    renderPageTooltip(ctx, canvas, tooltipHover?.type === 'page' ? tooltipHover : null);
    renderEnchantScrollTooltip(ctx, canvas, tooltipHover?.type === 'enchantScroll' ? tooltipHover : null);
    ctx.restore();
}

export function renderChest(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ps: PlayingStateShape,
    dragState: DragState,
    tooltipHover: TooltipHover
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
    ctx.fillText('Equipment', cx, layout.weaponSlots[0]?.y ? layout.weaponSlots[0].y - 50 : canvas.height / 2 - 80);

    for (const s of layout.weaponSlots) {
        const instance = s.index < chestSlots.length ? chestSlots[s.index] : undefined;
        const key = instance?.key;
        const isEquipped = key && (ps.equippedMainhandKey === key || ps.equippedOffhandKey === key || ps.equippedMainhandKey2 === key || ps.equippedOffhandKey2 === key);
        drawSlot(ctx, s, {
            filled: !!key,
            weaponKey: key ?? undefined,
            emptyLabel: key ? undefined : undefined,
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

    renderWeaponTooltip(ctx, canvas, tooltipHover?.type === 'weapon' ? tooltipHover : null, ps);
    ctx.restore();
}

/**
 * Draw the drag ghost (weapon icon following cursor) on top of all UI.
 * Call this last so the icon is visible over inventory, chest, reroll, and shop screens.
 */
/** Draw a small whetstone icon at (cx, cy) with given size. */
function drawWhetstoneIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(160, 150, 140, 0.9)';
    ctx.strokeStyle = 'rgba(100, 95, 90, 0.9)';
    ctx.lineWidth = Math.max(1, size / 12);
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

export function renderDragGhost(
    ctx: CanvasRenderingContext2D,
    dragState: DragState
): void {
    if (!dragState.isDragging) return;
    if (dragState.dragStrategyId) {
        const recipe = getStrategyRecipe(dragState.dragStrategyId);
        const ghostSize = 44;
        const gx = dragState.pointerX - ghostSize / 2;
        const gy = dragState.pointerY - ghostSize / 2;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = 'rgba(22, 16, 10, 0.97)';
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.stroke();
        ctx.fillStyle = '#e8dcc8';
        ctx.font = '500 10px Cinzel, Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(recipe?.label ?? dragState.dragStrategyId, dragState.pointerX, dragState.pointerY);
        ctx.restore();
        return;
    }
    if (dragState.isWhetstone) {
        const ghostSize = 44;
        const gx = dragState.pointerX - ghostSize / 2;
        const gy = dragState.pointerY - ghostSize / 2;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = 'rgba(22, 16, 10, 0.97)';
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.stroke();
        drawWhetstoneIcon(ctx, dragState.pointerX, dragState.pointerY, ghostSize / 2 - 4);
        ctx.restore();
        return;
    }
    if (dragState.dragConsumableType === 'herb' || dragState.dragConsumableType === 'mushroom' || dragState.dragConsumableType === 'honey' || dragState.dragConsumableType === 'potion' || dragState.dragConsumableType === 'gold' || dragState.dragConsumableType === 'page' || dragState.dragConsumableType === 'enchantScroll') {
        const ghostSize = 44;
        const gx = dragState.pointerX - ghostSize / 2;
        const gy = dragState.pointerY - ghostSize / 2;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = 'rgba(22, 16, 10, 0.97)';
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
        ctx.lineWidth = 2;
        roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
        ctx.stroke();
        const iconSize = ghostSize / 2 - 4;
        if (dragState.dragConsumableType === 'herb') drawHerbIcon(ctx, dragState.pointerX, dragState.pointerY, iconSize);
        else if (dragState.dragConsumableType === 'mushroom') drawMushroomIcon(ctx, dragState.pointerX, dragState.pointerY, iconSize);
        else if (dragState.dragConsumableType === 'potion') drawPotionIcon(ctx, dragState.pointerX, dragState.pointerY, iconSize);
        else if (dragState.dragConsumableType === 'gold') drawGoldIcon(ctx, dragState.pointerX, dragState.pointerY, iconSize);
        else if (dragState.dragConsumableType === 'page') drawPageIcon(ctx, dragState.pointerX, dragState.pointerY, iconSize);
        else if (dragState.dragConsumableType === 'enchantScroll') drawEnchantScrollIcon(ctx, dragState.pointerX, dragState.pointerY, iconSize);
        else drawHoneyIcon(ctx, dragState.pointerX, dragState.pointerY, iconSize);
        ctx.restore();
        return;
    }
    if (!dragState.weaponKey) return;
    const ghostSize = 44;
    const gx = dragState.pointerX - ghostSize / 2;
    const gy = dragState.pointerY - ghostSize / 2;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = 'rgba(22, 16, 10, 0.97)';
    roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
    ctx.lineWidth = 2;
    roundRect(ctx, gx, gy, ghostSize, ghostSize, 8);
    ctx.stroke();
    drawWeaponIcon(ctx, dragState.pointerX, dragState.pointerY, ghostSize / 2 - 4, dragState.weaponKey);
    ctx.restore();
}

export function renderShop(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    ps: PlayingStateShape
): void {
    const scrollOffset = ps.shopScrollOffset ?? 0;
    const expandedWeapons = ps.shopExpandedWeapons;
    const expandedArmor = ps.shopExpandedArmor;
    const expandedCategories = ps.shopExpandedCategories;
    const layout = getShopLayout(canvas, scrollOffset, expandedWeapons, expandedArmor, expandedCategories, ps);
    const { panel, dropdowns, back } = layout;
    const gold = getTotalGoldFromInventory(ps);

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
            const name = row.armorKey ? (getArmor(row.armorKey)?.name ?? row.armorKey) : getWeaponDisplayName(row.weaponKey!);
            const maxDur = row.armorKey ? MAX_ARMOR_DURABILITY : MAX_WEAPON_DURABILITY;
            if (row.weaponKey) drawWeaponIcon(ctx, iconCx, iconCy, 12, row.weaponKey);
            else {
                ctx.fillStyle = '#e0c8a0';
                ctx.font = '600 16px Cinzel, Georgia, serif';
                ctx.textAlign = 'center';
                ctx.fillText('◆', iconCx, iconCy);
                ctx.textAlign = 'left';
            }
            ctx.fillStyle = canAfford ? '#e0c8a0' : '#6a5a4a';
            ctx.font = '500 13px Cinzel, Georgia, serif';
            ctx.textAlign = 'left';
            ctx.fillText(name, row.x + 44, row.y + row.h / 2);
            const durText = `${row.currentDurability}/${maxDur}`;
            ctx.fillStyle = '#8a7048';
            ctx.font = '500 11px Cinzel, Georgia, serif';
            ctx.fillText(durText, row.x + row.w - 100, row.y + row.h / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = canAfford ? '#c9a227' : '#5a4a38';
            ctx.fillText(row.cost + ' g — Repair', row.x + row.w - 10, row.y + row.h / 2);
            ctx.textAlign = 'left';
        }
    }

    // Parent: Weapons header then weapon dropdowns
    const weaponsParent = layout.parentHeaders.find((ph) => ph.id === 'weapons');
    if (weaponsParent) {
        drawShopParentHeader(ctx, weaponsParent);
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

    // Parent: Armor header then armor dropdowns
    const armorParent = layout.parentHeaders.find((ph) => ph.id === 'armor');
    if (armorParent) {
        drawShopParentHeader(ctx, armorParent);
    }
    for (const ad of layout.armorDropdowns) {
        const header = ad.header;
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

        for (const row of ad.itemRows) {
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
            ctx.fillStyle = '#e0c8a0';
            ctx.font = '600 16px Cinzel, Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillText('◆', iconCx, iconCy);
            const config = getArmor(row.armorKey);
            const name = config?.name ?? row.armorKey;
            ctx.fillStyle = canAfford ? '#e0c8a0' : '#6a5a4a';
            ctx.font = '500 13px Cinzel, Georgia, serif';
            ctx.textAlign = 'left';
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
