/**
 * Strategy Crafting: execute recipes (craft, use item, ability).
 * Caller can pass context for side effects (e.g. add heal charge via player entity).
 */
import type { PlayingStateShape } from './PlayingState.js';
import { INVENTORY_SLOT_COUNT, isHerbSlot, isMushroomSlot, isWhetstoneSlot } from './PlayingState.js';
import { getStrategyRecipe, migrateUnlockedStrategyRecipeIds } from '../config/strategyCraftingConfig.js';
import { addPotionToInventory, useWhetstoneOnWeapon } from './InventoryActions.js';

export type ExecuteRecipeResult =
  | { success: true }
  | { success: false; reason: string };

export interface StrategyCraftingContext {
  /** Add one heal charge to the player (e.g. crafted potion). */
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

/**
 * Execute a strategy recipe by id. Returns a result with success and optional failure reason.
 */
export function executeRecipe(
  ps: PlayingStateShape,
  recipeId: string,
  context?: StrategyCraftingContext
): ExecuteRecipeResult {
  const unlocked = migrateUnlockedStrategyRecipeIds(ps.unlockedStrategyRecipeIds ?? []);
  if (!unlocked.includes(recipeId)) return { success: false, reason: 'Recipe not unlocked' };

  const recipe = getStrategyRecipe(recipeId);
  if (!recipe) return { success: false, reason: 'Unknown recipe' };

  const out = recipe.output;

  if (out.type === 'craft') {
    const herbNeed = out.consumes.herb ?? 0;
    const mushroomNeed = out.consumes.mushroom ?? 0;
    const hasHerb = countHerbs(ps) >= herbNeed;
    const hasMushroom = countMushrooms(ps) >= mushroomNeed;
    if (!hasHerb && !hasMushroom) return { success: false, reason: 'Not enough herbs and mushrooms' };
    if (!hasHerb) return { success: false, reason: 'Not enough herbs' };
    if (!hasMushroom) return { success: false, reason: 'Not enough mushrooms' };
    consumeHerbs(ps, herbNeed);
    consumeMushrooms(ps, mushroomNeed);
    if (out.produces === 'healCharge' && context?.addHealCharge) {
      context.addHealCharge();
    } else if (out.produces === 'potion') {
      if (!addPotionToInventory(ps)) return { success: false, reason: 'Inventory full' };
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
    // Placeholder for future ability system
    return { success: true };
  }

  return { success: false, reason: 'Unknown recipe type' };
}
