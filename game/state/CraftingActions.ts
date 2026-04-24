/**
 * Shared craft execution for sanctuary station (click) and field strategy (sequence).
 */
import type { PlayingStateShape } from './PlayingState.js';
import { INVENTORY_SLOT_COUNT, isHerbSlot, isMushroomSlot, isWhetstoneSlot } from './PlayingState.js';
import { getCraftRecipe, type CraftStationKind } from '../config/craftingConfig.js';
import { migrateUnlockedStrategyRecipeIds } from '../config/strategyCraftingConfig.js';
import {
  addCraftedPotionToToolbeltOrInventory,
  addEnchantScrollToInventory,
  countPages,
  consumePages,
  useWhetstoneOnWeapon
} from './InventoryActions.js';

export type CraftResult = { success: true } | { success: false; reason: string };

export interface CraftContext {
  addHealCharge?(): void;
}

function countHerbs(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return 0;
  return ps.inventorySlots.reduce((sum, s) => (isHerbSlot(s) ? sum + s.count : sum), 0);
}

function countMushrooms(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return 0;
  return ps.inventorySlots.reduce((sum, s) => (isMushroomSlot(s) ? sum + s.count : sum), 0);
}

function consumeHerbs(ps: PlayingStateShape, n: number): boolean {
  if (!ps.inventorySlots || n <= 0) return n === 0;
  let remaining = n;
  for (let i = 0; i < ps.inventorySlots.length && remaining > 0; i++) {
    const slot = ps.inventorySlots[i];
    if (!isHerbSlot(slot)) continue;
    const take = Math.min(remaining, slot.count);
    remaining -= take;
    if (slot.count === take) {
      ps.inventorySlots[i] = null;
    } else {
      slot.count -= take;
    }
  }
  return remaining === 0;
}

function consumeMushrooms(ps: PlayingStateShape, n: number): boolean {
  if (!ps.inventorySlots || n <= 0) return n === 0;
  let remaining = n;
  for (let i = 0; i < ps.inventorySlots.length && remaining > 0; i++) {
    const slot = ps.inventorySlots[i];
    if (!isMushroomSlot(slot)) continue;
    const take = Math.min(remaining, slot.count);
    remaining -= take;
    if (slot.count === take) {
      ps.inventorySlots[i] = null;
    } else {
      slot.count -= take;
    }
  }
  return remaining === 0;
}

function findWhetstoneSlotIndex(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return -1;
  return ps.inventorySlots.findIndex((s) => isWhetstoneSlot(s) && s.count >= 1);
}

function isRecipeUnlocked(ps: PlayingStateShape, recipeId: string, station: CraftStationKind): boolean {
  if (station === 'sanctuaryStation') {
    const ids = ps.unlockedStationRecipeIds ?? [];
    return ids.includes(recipeId);
  }
  return migrateUnlockedStrategyRecipeIds(ps.unlockedStrategyRecipeIds ?? []).includes(recipeId);
}

export function craftRecipe(
  ps: PlayingStateShape,
  recipeId: string,
  station: CraftStationKind,
  context?: CraftContext
): CraftResult {
  if (!isRecipeUnlocked(ps, recipeId, station)) {
    return { success: false, reason: 'Recipe not unlocked' };
  }

  const recipe = getCraftRecipe(recipeId);
  if (!recipe) return { success: false, reason: 'Unknown recipe' };

  if (!recipe.allowedStations.includes(station)) {
    return { success: false, reason: 'Recipe not available here' };
  }

  const out = recipe.output;

  if (out.type === 'craft') {
    const herbNeed = out.consumes.herb ?? 0;
    const mushroomNeed = out.consumes.mushroom ?? 0;
    const pageNeed = out.consumes.page ?? 0;
    const hasHerb = countHerbs(ps) >= herbNeed;
    const hasMushroom = countMushrooms(ps) >= mushroomNeed;
    const hasPages = countPages(ps) >= pageNeed;
    if (!hasHerb && !hasMushroom && !hasPages) return { success: false, reason: 'Not enough ingredients' };
    if (herbNeed > 0 && !hasHerb) return { success: false, reason: 'Not enough herbs' };
    if (mushroomNeed > 0 && !hasMushroom) return { success: false, reason: 'Not enough mushrooms' };
    if (pageNeed > 0 && !hasPages) return { success: false, reason: 'Not enough Enchantment Pages' };

    consumeHerbs(ps, herbNeed);
    consumeMushrooms(ps, mushroomNeed);
    if (pageNeed > 0) consumePages(ps, pageNeed);

    if (out.produces === 'healCharge' && context?.addHealCharge) {
      context.addHealCharge();
    } else if (out.produces === 'potion') {
      if (!addCraftedPotionToToolbeltOrInventory(ps)) return { success: false, reason: 'Inventory full' };
    } else if (out.produces === 'enchantScroll') {
      if (!addEnchantScrollToInventory(ps)) return { success: false, reason: 'Inventory full' };
    } else {
      return { success: false, reason: 'Unknown craft output' };
    }
    return { success: true };
  }

  if (out.type === 'use') {
    if (out.use !== 'whetstone') return { success: false, reason: 'Invalid recipe' };
    const slotIndex = findWhetstoneSlotIndex(ps);
    if (slotIndex < 0) return { success: false, reason: 'No whetstone' };
    const ok = useWhetstoneOnWeapon(ps, slotIndex, out.target);
    return ok ? { success: true } : { success: false, reason: 'Could not sharpen weapon' };
  }

  if (out.type === 'ability') {
    return { success: true };
  }

  return { success: false, reason: 'Unknown recipe type' };
}
