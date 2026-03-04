/**
 * Strategy Crafting: strategem-style directional recipes (craft, use item, ability).
 * Hold V to open the pane; arrow keys enter the sequence; match executes the recipe.
 */

export type StrategyDirection = 'up' | 'down' | 'left' | 'right';

export type StrategyCraftOutput =
  | { type: 'craft'; consumes: { herb?: number; mushroom?: number; page?: number }; produces: 'healCharge' | 'enchantScroll' | string }
  | { type: 'use'; use: 'whetstone'; target: 'mainhand' | 'offhand' }
  | { type: 'ability'; abilityId: string };

/** Legacy recipe ids replaced by a single sharpen_weapons recipe. */
const LEGACY_WHETSTONE_RECIPE_IDS = ['whetstone_mainhand', 'whetstone_offhand'];
const SHARPEN_WEAPONS_RECIPE_ID = 'sharpen_weapons';

export interface StrategyRecipeDef {
  id: string;
  sequence: StrategyDirection[];
  output: StrategyCraftOutput;
  label: string;
  description: string;
  unlockedByDefault?: boolean;
}

/** All recipe definitions. Add new recipes here. */
export const STRATEGY_RECIPES: StrategyRecipeDef[] = [
  {
    id: 'potion',
    sequence: ['up', 'up', 'down', 'down'],
    output: { type: 'craft', consumes: { herb: 1, mushroom: 1 }, produces: 'potion' },
    label: 'Craft Potion',
    description: 'Herb + Mushroom → 1 potion (use with Q for heal)',
    unlockedByDefault: true
  },
  {
    id: 'sharpen_weapons',
    sequence: ['left', 'right', 'left', 'right'],
    output: { type: 'use', use: 'whetstone', target: 'mainhand' },
    label: 'Sharpen Weapons',
    description: 'Use 1 whetstone on main and off hand',
    unlockedByDefault: true
  },
  {
    id: 'vigor',
    sequence: ['up', 'down', 'up', 'down'],
    output: { type: 'craft', consumes: { herb: 2 }, produces: 'vigorTonic' },
    label: 'Vigor Tonic',
    description: '2 Herbs → tonic (no charge)',
    unlockedByDefault: false
  },
  {
    id: 'enchant_scroll',
    sequence: ['left', 'up', 'right', 'down'],
    output: { type: 'craft', consumes: { page: 3 }, produces: 'enchantScroll' },
    label: 'Craft Enchant Scroll',
    description: '3 Pages → 1 Enchant Scroll (use at reroll station to add or reroll enchants)',
    unlockedByDefault: true
  }
];

const RECIPE_MAP = new Map<string, StrategyRecipeDef>();
for (const r of STRATEGY_RECIPES) {
  RECIPE_MAP.set(r.id, r);
}

export function getStrategyRecipe(id: string): StrategyRecipeDef | undefined {
  return RECIPE_MAP.get(id);
}

export function getDefaultUnlockedRecipeIds(): string[] {
  return STRATEGY_RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id);
}

/**
 * Normalize unlocked recipe ids for the whetstone rework: replace legacy whetstone_mainhand/whetstone_offhand with sharpen_weapons.
 * Call when reading unlockedStrategyRecipeIds so old saves still have the Sharpen Weapons recipe.
 */
export function migrateUnlockedStrategyRecipeIds(ids: string[]): string[] {
  const next = ids.filter((id) => !LEGACY_WHETSTONE_RECIPE_IDS.includes(id));
  const hadLegacy = LEGACY_WHETSTONE_RECIPE_IDS.some((id) => ids.includes(id));
  if (hadLegacy && !next.includes(SHARPEN_WEAPONS_RECIPE_ID)) next.push(SHARPEN_WEAPONS_RECIPE_ID);
  return next;
}

/** Max length of input buffer before auto-reset (avoids accidental long sequences). */
export const STRATEGY_BUFFER_MAX_LENGTH = 12;

/** Number of slots in the strategy loadout (Tab panel). Only slotted strategies can be triggered by V+sequence. */
export const STRATEGY_LOADOUT_SLOT_COUNT = 4;

/**
 * Default strategy loadout: first N unlocked recipe ids, then nulls.
 * Used for new games and when migrating saves that lack strategyLoadoutSlotIds.
 */
export function getDefaultStrategyLoadoutSlotIds(unlockedIds: string[]): (string | null)[] {
  const slots: (string | null)[] = Array(STRATEGY_LOADOUT_SLOT_COUNT).fill(null);
  for (let i = 0; i < STRATEGY_LOADOUT_SLOT_COUNT && i < unlockedIds.length; i++) {
    slots[i] = unlockedIds[i] ?? null;
  }
  return slots;
}
