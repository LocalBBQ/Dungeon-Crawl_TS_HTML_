/**
 * Handles inventory, chest, shop, and reroll UI pointer events and tooltip hover.
 * Game delegates to this controller so the main class no longer contains the handler bodies.
 */
import type { PlayingStateShape } from '../state/PlayingState.js';
import { INVENTORY_SLOT_COUNT, MAX_WEAPON_DURABILITY, MAX_ARMOR_DURABILITY } from '../state/PlayingState.js';
import { getInventoryLayout, getChestLayout, getShopLayout, hitTestInventory, hitTestChest, hitTestShop, ensureInventoryInitialized, type DragState } from '../ui/InventoryChestCanvas.js';
import type { TooltipHover } from '../types/tooltip.js';
import { getRerollOverlayLayout, hitTestRerollOverlay } from '../ui/RerollOverlay.js';
import { hitTestMinimapZoomButtons, MINIMAP_ZOOM_MIN, MINIMAP_ZOOM_MAX, MINIMAP_ZOOM_STEP } from '../systems/renderers/MinimapRenderer.ts';
import { getEquipSlotForWeapon } from '../weapons/weaponSlot.js';
import { getArmor } from '../armor/armorConfigs.js';
import {
    equipFromInventory,
    equipFromChest,
    equipFromChestToHand,
    unequipToInventory,
    putInChestFromInventory,
    putInChestFromEquipment,
    setInventorySlot,
    swapEquipmentWithEquipment,
    swapEquipmentWithInventory,
    swapInventorySlots,
    rerollEnchantSlot,
    moveToRerollSlot,
    moveFromRerollSlotTo,
    useWhetstoneOnWeapon,
} from '../state/InventoryActions.js';
import { equipArmorFromInventory, unequipArmorToInventory, swapArmorWithInventory, swapArmorWithArmor, canEquipArmorInSlot } from '../state/ArmorActions.js';

export interface InventoryChestUIControllerContext {
    playingState: PlayingStateShape;
    canvas: HTMLCanvasElement;
    settings: Record<string, unknown>;
    screenManager: { isScreen(name: string): boolean } | null;
    inventoryDragState: DragState;
    refreshInventoryPanel: () => void;
    syncCombat: () => void;
    setTooltipHover: (v: TooltipHover) => void;
    setInventoryPanelVisible: (visible: boolean) => void;
}

export class InventoryChestUIController {
    private ctx: InventoryChestUIControllerContext;

    constructor(ctx: InventoryChestUIControllerContext) {
        this.ctx = ctx;
    }

    isPointerOverUI(x: number, y: number): boolean {
        const g = this.ctx;
        if (g.playingState.chestOpen) return true;
        if (g.playingState.inventoryOpen) {
            const layout = getInventoryLayout(g.canvas);
            const p = layout.panel;
            if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
        }
        if (g.playingState.shopOpen) {
            const layout = getShopLayout(
                g.canvas,
                (g.playingState.shopScrollOffset as number) ?? 0,
                g.playingState.shopExpandedWeapons,
                g.playingState.shopExpandedArmor,
                g.playingState.shopExpandedCategories,
                g.playingState
            );
            const p = layout.panel;
            if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
        }
        return false;
    }

    handleClick(x: number, y: number, e?: MouseEvent): boolean {
        const g = this.ctx;
        const ps = g.playingState;
        const sync = g.syncCombat;

        if (ps.rerollStationOpen) {
            const layout = getRerollOverlayLayout(g.canvas, ps);
            const hit = hitTestRerollOverlay(x, y, ps, layout);
            if (hit?.type === 'back') {
                ps.rerollStationOpen = false;
                return true;
            }
            if (hit?.type === 'reroll' && ps.rerollSlotItem?.key) {
                rerollEnchantSlot(ps, hit.action);
                g.refreshInventoryPanel();
                return true;
            }
            if (hit) return true;
            ensureInventoryInitialized(ps);
            const invLayoutR = getInventoryLayout(g.canvas, { includeChestGrid: true });
            const invHitR = hitTestInventory(x, y, ps, invLayoutR, ps.chestSlots ?? []);
            if (invHitR?.type === 'close') {
                ps.rerollStationOpen = false;
                g.setTooltipHover(null);
                return true;
            }
        }
        if (e?.ctrlKey && (ps.inventoryOpen || ps.chestOpen || ps.rerollStationOpen)) {
            ensureInventoryInitialized(ps);
            const invLayout = ps.rerollStationOpen ? getInventoryLayout(g.canvas, { includeChestGrid: true }) : getInventoryLayout(g.canvas);
            const invHit = hitTestInventory(x, y, ps, invLayout, ps.rerollStationOpen ? (ps.chestSlots ?? []) : undefined);
            if (invHit?.type === 'chest-slot' && invHit.key) {
                const slot = getEquipSlotForWeapon(invHit.key);
                const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                if (slotHasItem) unequipToInventory(ps, slot, undefined, undefined, sync);
                equipFromChestToHand(ps, invHit.index, slot, sync);
                g.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'inventory-slot' && invHit.weaponKey && invHit.index >= 0) {
                const armorConfig = getArmor(invHit.weaponKey);
                if (armorConfig) {
                    const slotHasItem = (armorConfig.slot === 'head' ? ps.equippedArmorHeadKey : armorConfig.slot === 'chest' ? ps.equippedArmorChestKey : armorConfig.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey) !== 'none';
                    if (slotHasItem) swapArmorWithInventory(ps, armorConfig.slot, invHit.index);
                    else equipArmorFromInventory(ps, invHit.index, armorConfig.slot);
                    g.refreshInventoryPanel();
                    return true;
                }
                const slot = getEquipSlotForWeapon(invHit.weaponKey);
                const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                if (slotHasItem) swapEquipmentWithInventory(ps, slot, invHit.index, sync);
                else equipFromInventory(ps, invHit.index, slot, sync);
                g.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'equipment') {
                const key = invHit.slot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
                if (key && key !== 'none') {
                    if (ps.chestOpen || ps.rerollStationOpen) putInChestFromEquipment(ps, invHit.slot, sync);
                    else unequipToInventory(ps, invHit.slot, undefined, undefined, sync);
                    g.refreshInventoryPanel();
                    return true;
                }
            }
            if (invHit?.type === 'armor-equipment') {
                const key = invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey;
                if (key && key !== 'none') {
                    unequipArmorToInventory(ps, invHit.slot);
                    g.refreshInventoryPanel();
                    return true;
                }
            }
            if (ps.chestOpen && !ps.rerollStationOpen) {
                const layout = getChestLayout(g.canvas);
                const chestHit = hitTestChest(x, y, layout, ps.chestSlots ?? []);
                if (chestHit?.type === 'weapon-slot' && chestHit.key) {
                    const slot = getEquipSlotForWeapon(chestHit.key);
                    const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                    if (slotHasItem) unequipToInventory(ps, slot, undefined, undefined, sync);
                    equipFromChestToHand(ps, chestHit.index, slot, sync);
                    g.refreshInventoryPanel();
                    return true;
                }
            }
        }
        if (ps.shopOpen) {
            const layout = getShopLayout(g.canvas, (ps.shopScrollOffset as number) ?? 0, ps.shopExpandedWeapons, ps.shopExpandedArmor, ps.shopExpandedCategories, ps);
            const hit = hitTestShop(x, y, layout);
            if (hit?.type === 'back') {
                ps.shopOpen = false;
                ps.shopUseCooldown = 0.4;
                return true;
            }
            if (hit?.type === 'repair') {
                const gold = (ps.gold as number) ?? 0;
                if (gold >= hit.cost) {
                    ps.gold = gold - hit.cost;
                    if (hit.source === 'mainhand') ps.equippedMainhandDurability = MAX_WEAPON_DURABILITY;
                    else if (hit.source === 'offhand') ps.equippedOffhandDurability = MAX_WEAPON_DURABILITY;
                    else if (hit.source === 'inventory' && 'bagIndex' in hit) {
                        const slot = ps.inventorySlots?.[hit.bagIndex];
                        if (slot) ps.inventorySlots[hit.bagIndex] = { key: slot.key, durability: MAX_WEAPON_DURABILITY };
                    } else if (hit.source === 'armor' && 'armorSlot' in hit) {
                        const s = hit.armorSlot;
                        if (s === 'head') ps.equippedArmorHeadDurability = MAX_ARMOR_DURABILITY;
                        else if (s === 'chest') ps.equippedArmorChestDurability = MAX_ARMOR_DURABILITY;
                        else if (s === 'hands') ps.equippedArmorHandsDurability = MAX_ARMOR_DURABILITY;
                        else if (s === 'feet') ps.equippedArmorFeetDurability = MAX_ARMOR_DURABILITY;
                    } else if (hit.source === 'armor-bag' && 'armorBagIndex' in hit) {
                        const item = ps.inventorySlots?.[hit.armorBagIndex];
                        if (item) ps.inventorySlots![hit.armorBagIndex] = { key: item.key, durability: MAX_ARMOR_DURABILITY };
                    }
                    g.refreshInventoryPanel();
                }
                return true;
            }
            if (hit?.type === 'armor-item') {
                const gold = (ps.gold as number) ?? 0;
                if (gold >= hit.price) {
                    ensureInventoryInitialized(ps);
                    const empty = ps.inventorySlots?.findIndex((s) => s == null) ?? -1;
                    if (empty >= 0) {
                        ps.gold = gold - hit.price;
                        ps.inventorySlots![empty] = { key: hit.armorKey, durability: MAX_ARMOR_DURABILITY };
                        g.refreshInventoryPanel();
                    }
                }
                return true;
            }
            if (hit?.type === 'dropdown') {
                const exp = ps.shopExpandedWeapons ?? {};
                ps.shopExpandedWeapons = { ...exp, [hit.weaponKey]: !(exp[hit.weaponKey] === true) };
                return true;
            }
            if (hit?.type === 'armor-dropdown') {
                const exp = ps.shopExpandedArmor ?? {};
                ps.shopExpandedArmor = { ...exp, [hit.slot]: !(exp[hit.slot] === true) };
                return true;
            }
            if (hit?.type === 'parent-category') {
                const exp = ps.shopExpandedCategories ?? {};
                ps.shopExpandedCategories = { ...exp, [hit.category]: !(exp[hit.category] === true) };
                return true;
            }
            if (hit?.type === 'item') {
                const gold = (ps.gold as number) ?? 0;
                if (gold >= hit.price) {
                    ensureInventoryInitialized(ps);
                    const slots = ps.inventorySlots;
                    const idx = slots?.findIndex((s) => s == null) ?? -1;
                    if (idx >= 0) {
                        ps.gold = gold - hit.price;
                        setInventorySlot(ps, idx, { key: hit.weaponKey, durability: MAX_WEAPON_DURABILITY });
                        g.refreshInventoryPanel();
                    }
                }
            }
            return true;
        }
        if (ps.inventoryOpen) {
            const layout = getInventoryLayout(g.canvas);
            const hit = hitTestInventory(x, y, ps, layout);
            if (hit?.type === 'close') {
                ps.inventoryOpen = false;
                g.setTooltipHover(null);
                g.setTooltipHover(null);
                g.setInventoryPanelVisible(false);
                return true;
            }
        }
        if (ps.chestOpen) {
            const invLayout = getInventoryLayout(g.canvas);
            const invHit = hitTestInventory(x, y, ps, invLayout);
            if (invHit?.type === 'close') {
                ps.chestOpen = false;
                ps.chestUseCooldown = 0;
                g.setTooltipHover(null);
                g.setTooltipHover(null);
                return true;
            }
            const layout = getChestLayout(g.canvas);
            const hit = hitTestChest(x, y, layout, ps.chestSlots ?? []);
            if (hit?.type === 'back') {
                ps.chestOpen = false;
                ps.chestUseCooldown = 0;
                g.setTooltipHover(null);
                g.setTooltipHover(null);
                return true;
            }
        }
        return false;
    }

    handleDoubleClick(x: number, y: number): boolean {
        const g = this.ctx;
        const ps = g.playingState;
        if (!ps.inventoryOpen && !ps.chestOpen) return false;
        ensureInventoryInitialized(ps);
        const sync = g.syncCombat;
        const layout = getInventoryLayout(g.canvas);
        const hit = hitTestInventory(x, y, ps, layout);
        if (hit?.type === 'inventory-slot' && hit.weaponKey && hit.index >= 0) {
            const slot = getEquipSlotForWeapon(hit.weaponKey);
            const slotHasItem = slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
            if (slotHasItem) swapEquipmentWithInventory(ps, slot, hit.index, sync);
            else equipFromInventory(ps, hit.index, slot, sync);
            g.refreshInventoryPanel();
            return true;
        }
        return false;
    }

    handleMinimapZoomClick(x: number, y: number): boolean {
        const g = this.ctx;
        if (!g.settings.showMinimap || !g.screenManager) return false;
        if (!g.screenManager.isScreen('playing') && !g.screenManager.isScreen('hub')) return false;
        const hit = hitTestMinimapZoomButtons(g.canvas.width, g.canvas.height, x, y);
        if (hit === 'minus') {
            const current = (g.settings.minimapZoom as number) ?? 1;
            g.settings.minimapZoom = Math.max(MINIMAP_ZOOM_MIN, current - MINIMAP_ZOOM_STEP);
            return true;
        }
        if (hit === 'plus') {
            const current = (g.settings.minimapZoom as number) ?? 1;
            g.settings.minimapZoom = Math.min(MINIMAP_ZOOM_MAX, current + MINIMAP_ZOOM_STEP);
            return true;
        }
        return false;
    }

    handlePointerDown(x: number, y: number, ctrlKey = false): boolean {
        const g = this.ctx;
        const ps = g.playingState;
        if (!ps.inventoryOpen && !ps.chestOpen && !ps.shopOpen && !ps.rerollStationOpen) return false;
        if (ctrlKey) return false;
        ensureInventoryInitialized(ps);
        const ds = g.inventoryDragState;
        if (ps.rerollStationOpen && ps.rerollSlotItem?.key) {
            const rerollLayout = getRerollOverlayLayout(g.canvas, ps);
            const rerollHit = hitTestRerollOverlay(x, y, ps, rerollLayout);
            if (rerollHit?.type === 'slot') {
                ds.isDragging = true;
                ds.weaponKey = ps.rerollSlotItem!.key;
                ds.durability = ps.rerollSlotItem!.durability;
                ds.sourceSlotIndex = 0;
                ds.sourceContext = 'rerollSlot';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        const invLayout = ps.rerollStationOpen ? getInventoryLayout(g.canvas, { includeChestGrid: true }) : getInventoryLayout(g.canvas);
        const invHit = hitTestInventory(x, y, ps, invLayout, ps.rerollStationOpen ? (ps.chestSlots ?? []) : undefined);
        if (invHit?.type === 'chest-slot' && invHit.key) {
            ds.isDragging = true;
            ds.weaponKey = invHit.key;
            ds.sourceSlotIndex = invHit.index;
            ds.sourceContext = 'chest';
            ds.pointerX = x;
            ds.pointerY = y;
            return true;
        }
        if (invHit?.type === 'inventory-slot' && (invHit.weaponKey || invHit.itemType === 'whetstone')) {
            if (invHit.itemType === 'whetstone') {
                ds.isDragging = true;
                ds.sourceSlotIndex = invHit.index;
                ds.sourceContext = 'inventory';
                ds.weaponKey = '';
                ds.isWhetstone = true;
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
            const isArmor = !!getArmor(invHit.weaponKey!);
            ds.isDragging = true;
            ds.sourceSlotIndex = invHit.index;
            ds.sourceContext = 'inventory';
            ds.pointerX = x;
            ds.pointerY = y;
            if (isArmor) {
                ds.weaponKey = '';
                ds.armorKey = invHit.weaponKey!;
            } else {
                ds.weaponKey = invHit.weaponKey!;
                ds.armorKey = undefined;
                ds.durability = undefined;
            }
            return true;
        }
        if (invHit?.type === 'equipment') {
            const key = invHit.slot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
            if (key && key !== 'none') {
                ds.isDragging = true;
                ds.weaponKey = key;
                ds.durability = invHit.slot === 'mainhand' ? ps.equippedMainhandDurability : ps.equippedOffhandDurability;
                ds.sourceSlotIndex = invHit.slot === 'mainhand' ? 0 : 1;
                ds.sourceContext = 'equipment';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        if (invHit?.type === 'armor-equipment') {
            const key = invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey;
            if (key && key !== 'none') {
                ds.isDragging = true;
                ds.weaponKey = '';
                ds.armorKey = key;
                ds.sourceArmorSlot = invHit.slot;
                ds.sourceContext = 'armor';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        if (ps.chestOpen) {
            const layout = getChestLayout(g.canvas);
            const hit = hitTestChest(x, y, layout, ps.chestSlots ?? []);
            if (hit?.type === 'weapon-slot' && hit.key) {
                ds.isDragging = true;
                ds.weaponKey = hit.key;
                ds.sourceSlotIndex = hit.index;
                ds.sourceContext = 'chest';
                ds.pointerX = x;
                ds.pointerY = y;
                return true;
            }
        }
        return false;
    }

    handlePointerMove(x: number, y: number): void {
        const g = this.ctx;
        const ds = g.inventoryDragState;
        if (ds.isDragging) {
            ds.pointerX = x;
            ds.pointerY = y;
            return;
        }
        this.updateTooltipHover(x, y);
    }

    private updateTooltipHover(x: number, y: number): void {
        const g = this.ctx;
        const ps = g.playingState;
        if (!ps.inventoryOpen && !ps.chestOpen && !ps.rerollStationOpen) {
            g.setTooltipHover(null);
            g.setTooltipHover(null);
            return;
        }
        ensureInventoryInitialized(ps);
        const invLayout = ps.rerollStationOpen ? getInventoryLayout(g.canvas, { includeChestGrid: true }) : getInventoryLayout(g.canvas);
        const invHit = hitTestInventory(x, y, ps, invLayout, ps.rerollStationOpen ? (ps.chestSlots ?? []) : undefined);
        if (invHit?.type === 'armor-equipment') {
            const key = invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey;
            const durability = invHit.slot === 'head' ? ps.equippedArmorHeadDurability : invHit.slot === 'chest' ? ps.equippedArmorChestDurability : invHit.slot === 'hands' ? ps.equippedArmorHandsDurability : ps.equippedArmorFeetDurability;
            if (key && key !== 'none') {
                g.setTooltipHover({ type: 'armor', armorKey: key, x, y, durability });
                return;
            }
        }
        if (invHit?.type === 'chest-slot' && invHit.key) {
            const chestSlots = ps.chestSlots ?? [];
            const instance = chestSlots[invHit.index];
            g.setTooltipHover(instance ? { type: 'weapon', weaponKey: invHit.key, x, y, durability: instance.durability, prefixId: instance.prefixId, suffixId: instance.suffixId } : { type: 'weapon', weaponKey: invHit.key, x, y });
            return;
        }
        if (invHit?.type === 'inventory-slot' && invHit.weaponKey) {
            if (getArmor(invHit.weaponKey)) {
                g.setTooltipHover({ type: 'armor', armorKey: invHit.weaponKey, x, y, durability: invHit.durability });
                return;
            }
            g.setTooltipHover({ type: 'weapon', weaponKey: invHit.weaponKey, x, y, durability: invHit.durability, prefixId: invHit.prefixId, suffixId: invHit.suffixId });
            return;
        }
        if (invHit?.type === 'equipment') {
            const key = invHit.slot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
            if (key && key !== 'none') {
                const prefixId = invHit.slot === 'mainhand' ? ps.equippedMainhandPrefixId : ps.equippedOffhandPrefixId;
                const suffixId = invHit.slot === 'mainhand' ? ps.equippedMainhandSuffixId : ps.equippedOffhandSuffixId;
                const durability = invHit.slot === 'mainhand' ? ps.equippedMainhandDurability : ps.equippedOffhandDurability;
                g.setTooltipHover({ type: 'weapon', weaponKey: key, x, y, durability, prefixId, suffixId });
                return;
            }
        }
        if (ps.chestOpen) {
            const layout = getChestLayout(g.canvas);
            const chestSlots = ps.chestSlots ?? [];
            const hit = hitTestChest(x, y, layout, chestSlots);
            if (hit?.type === 'weapon-slot' && hit.key) {
                const instance = chestSlots[hit.index];
                g.setTooltipHover({ type: 'weapon', weaponKey: hit.key, x, y, durability: instance?.durability, prefixId: instance?.prefixId, suffixId: instance?.suffixId });
                return;
            }
        }
        g.setTooltipHover(null);
    }

    handlePointerUp(x: number, y: number): boolean {
        const g = this.ctx;
        const ds = g.inventoryDragState;
        if (!ds.isDragging) return false;
        const weaponKey = ds.weaponKey;
        const armorKey = ds.armorKey;
        const sourceIndex = ds.sourceSlotIndex;
        const sourceContext = ds.sourceContext;
        const sourceArmorSlot = ds.sourceArmorSlot;
        const sourceArmorInvIndex = ds.sourceContext === 'inventory' && ds.armorKey ? ds.sourceSlotIndex : undefined;
        const dragDurability = ds.durability;
        const wasWhetstone = ds.isWhetstone === true;
        ds.isDragging = false;
        ds.weaponKey = '';
        ds.armorKey = undefined;
        ds.sourceArmorSlot = undefined;
        ds.durability = undefined;
        ds.sourceSlotIndex = -1;
        ds.isWhetstone = false;

        const ps = g.playingState;
        const sync = g.syncCombat;

        if (!ps.inventorySlots || ps.inventorySlots.length < INVENTORY_SLOT_COUNT) {
            if (armorKey && (ps.inventoryOpen || ps.chestOpen)) {
                const invLayout = getInventoryLayout(g.canvas);
                const invHit = hitTestInventory(x, y, ps, invLayout);
                if (invHit?.type === 'armor-equipment' && sourceArmorSlot !== undefined && canEquipArmorInSlot(armorKey, invHit.slot)) {
                    swapArmorWithArmor(ps, sourceArmorSlot, invHit.slot);
                    g.refreshInventoryPanel();
                } else if (invHit?.type === 'armor-equipment' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex >= 0 && canEquipArmorInSlot(armorKey, invHit.slot)) {
                    const slotHasItem = (invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey) !== 'none';
                    if (slotHasItem) swapArmorWithInventory(ps, invHit.slot, sourceArmorInvIndex);
                    else equipArmorFromInventory(ps, sourceArmorInvIndex, invHit.slot);
                    g.refreshInventoryPanel();
                } else if (invHit?.type === 'inventory-slot' && sourceArmorSlot !== undefined) {
                    unequipArmorToInventory(ps, sourceArmorSlot, invHit.index);
                    g.refreshInventoryPanel();
                } else if (invHit?.type === 'inventory-slot' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex !== invHit.index) {
                    swapInventorySlots(ps, sourceArmorInvIndex, invHit.index);
                    g.refreshInventoryPanel();
                }
            }
            return true;
        }

        if (ps.rerollStationOpen) {
            const rerollLayout = getRerollOverlayLayout(g.canvas, ps);
            const s = rerollLayout.slot;
            const inRerollSlot = x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
            if (inRerollSlot && sourceContext !== 'rerollSlot') {
                moveToRerollSlot(ps, sourceContext, sourceIndex, sync);
                g.refreshInventoryPanel();
                return true;
            }
        }

        if (ps.inventoryOpen || ps.chestOpen || ps.rerollStationOpen) {
            const invLayout = ps.rerollStationOpen ? getInventoryLayout(g.canvas, { includeChestGrid: true }) : getInventoryLayout(g.canvas);
            const invHit = hitTestInventory(x, y, ps, invLayout, ps.rerollStationOpen ? (ps.chestSlots ?? []) : undefined);
            if (wasWhetstone && sourceContext === 'inventory' && sourceIndex >= 0 && invHit) {
                if (invHit.type === 'equipment') {
                    const key = invHit.slot === 'mainhand' ? ps.equippedMainhandKey : ps.equippedOffhandKey;
                    if (key && key !== 'none') {
                        if (useWhetstoneOnWeapon(ps, sourceIndex, invHit.slot)) {
                            g.refreshInventoryPanel();
                            return true;
                        }
                    }
                }
                if (invHit.type === 'inventory-slot' && invHit.weaponKey && invHit.itemType === 'weapon') {
                    if (useWhetstoneOnWeapon(ps, sourceIndex, { bagIndex: invHit.index })) {
                        g.refreshInventoryPanel();
                        return true;
                    }
                }
            }
            if (armorKey && invHit?.type === 'armor-equipment' && sourceArmorSlot !== undefined && canEquipArmorInSlot(armorKey, invHit.slot)) {
                swapArmorWithArmor(ps, sourceArmorSlot, invHit.slot);
                g.refreshInventoryPanel();
                return true;
            }
            if (armorKey && invHit?.type === 'armor-equipment' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex >= 0 && canEquipArmorInSlot(armorKey, invHit.slot)) {
                const slotHasItem = (invHit.slot === 'head' ? ps.equippedArmorHeadKey : invHit.slot === 'chest' ? ps.equippedArmorChestKey : invHit.slot === 'hands' ? ps.equippedArmorHandsKey : ps.equippedArmorFeetKey) !== 'none';
                if (slotHasItem) swapArmorWithInventory(ps, invHit.slot, sourceArmorInvIndex);
                else equipArmorFromInventory(ps, sourceArmorInvIndex, invHit.slot);
                g.refreshInventoryPanel();
                return true;
            }
            if (armorKey && invHit?.type === 'inventory-slot' && sourceArmorSlot !== undefined) {
                unequipArmorToInventory(ps, sourceArmorSlot, invHit.index);
                g.refreshInventoryPanel();
                return true;
            }
            if (armorKey && invHit?.type === 'inventory-slot' && sourceArmorInvIndex !== undefined && sourceArmorInvIndex !== invHit.index) {
                swapInventorySlots(ps, sourceArmorInvIndex, invHit.index);
                g.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'chest-slot') {
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'chest', 0);
                    g.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) putInChestFromInventory(ps, sourceIndex);
                else if (sourceContext === 'equipment') putInChestFromEquipment(ps, sourceIndex === 0 ? 'mainhand' : 'offhand', sync);
                g.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'equipment') {
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'equipment', invHit.slot === 'mainhand' ? 0 : 1, sync);
                    g.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'equipment') swapEquipmentWithEquipment(ps, sync);
                else if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) {
                    const slotHasItem = invHit.slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                    if (slotHasItem) swapEquipmentWithInventory(ps, invHit.slot, sourceIndex, sync);
                    else equipFromInventory(ps, sourceIndex, invHit.slot, sync);
                } else if (sourceContext === 'chest' && sourceIndex >= 0 && sourceIndex < (ps.chestSlots?.length ?? 0)) {
                    const slotHasItem = invHit.slot === 'mainhand' ? (ps.equippedMainhandKey && ps.equippedMainhandKey !== 'none') : (ps.equippedOffhandKey && ps.equippedOffhandKey !== 'none');
                    if (slotHasItem) unequipToInventory(ps, invHit.slot, undefined, undefined, sync);
                    equipFromChestToHand(ps, sourceIndex, invHit.slot, sync);
                }
                g.refreshInventoryPanel();
                return true;
            }
            if (invHit?.type === 'inventory-slot') {
                const targetIndex = invHit.index;
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'inventory', targetIndex);
                    g.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) swapInventorySlots(ps, sourceIndex, targetIndex);
                else if (sourceContext === 'chest' && sourceIndex >= 0 && sourceIndex < (ps.chestSlots?.length ?? 0)) equipFromChest(ps, sourceIndex, targetIndex);
                else if (sourceContext === 'equipment') unequipToInventory(ps, sourceIndex === 0 ? 'mainhand' : 'offhand', targetIndex, dragDurability, sync);
                g.refreshInventoryPanel();
                return true;
            }
        }

        if (ps.chestOpen) {
            const layout = getChestLayout(g.canvas);
            const hit = hitTestChest(x, y, layout, ps.chestSlots ?? []);
            if (hit?.type === 'weapon-slot' || hit?.type === 'back') {
                if (sourceContext === 'rerollSlot') {
                    moveFromRerollSlotTo(ps, 'chest', 0);
                    g.refreshInventoryPanel();
                    return true;
                }
                if (sourceContext === 'inventory' && sourceIndex >= 0 && sourceIndex < INVENTORY_SLOT_COUNT) putInChestFromInventory(ps, sourceIndex);
                else if (sourceContext === 'equipment') putInChestFromEquipment(ps, sourceIndex === 0 ? 'mainhand' : 'offhand', sync);
                g.refreshInventoryPanel();
            }
        }
        return true;
    }
}
