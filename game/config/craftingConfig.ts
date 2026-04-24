/**
 * Shared craft definitions: station UI and field execution both reference these recipes.
 */
import type { StrategyCraftOutput } from './strategyCraftingConfig.js';

export type CraftStationKind = 'sanctuaryStation' | 'field';

export interface CraftRecipeDef {
  id: string;
  label: string;
  description: string;
  output: StrategyCraftOutput;
  /** Where `craftRecipe` may run this definition. */
  allowedStations: CraftStationKind[];
  unlockedByDefault?: boolean;
}

/** Bump when adding recipes or changing unlock/migration rules for crafting saves. */
export const CRAFTING_SCHEMA_VERSION = 1;

export const CRAFT_RECIPES: CraftRecipeDef[] = [
  {
    id: 'potion',
    label: 'Craft Potion',
    description: 'Herb + Mushroom → 1 potion (use with Q for heal)',
    output: { type: 'craft', consumes: { herb: 1, mushroom: 1 }, produces: 'potion' },
    allowedStations: ['sanctuaryStation', 'field'],
    unlockedByDefault: true
  },
  {
    id: 'sharpen_weapons',
    label: 'Sharpen Weapons',
    description: 'Use 1 whetstone on main and off hand (active set)',
    output: { type: 'use', use: 'whetstone', target: 'mainhand' },
    allowedStations: ['sanctuaryStation', 'field'],
    unlockedByDefault: true
  },
  {
    id: 'enchant_scroll',
    label: 'Craft Enchant Scroll',
    description: '4 Enchantment Pages → 1 Enchant Scroll',
    output: { type: 'craft', consumes: { page: 4 }, produces: 'enchantScroll' },
    allowedStations: ['sanctuaryStation', 'field'],
    unlockedByDefault: true
  },
  {
    id: 'vigor',
    label: 'Vigor Tonic',
    description: '2 Herbs → tonic (no heal charge)',
    output: { type: 'craft', consumes: { herb: 2 }, produces: 'vigorTonic' },
    allowedStations: ['field'],
    unlockedByDefault: false
  }
];

const RECIPE_MAP = new Map<string, CraftRecipeDef>();
for (const r of CRAFT_RECIPES) {
  RECIPE_MAP.set(r.id, r);
}

export function getCraftRecipe(id: string): CraftRecipeDef | undefined {
  return RECIPE_MAP.get(id);
}

export function getCraftRecipesForStation(station: CraftStationKind): CraftRecipeDef[] {
  return CRAFT_RECIPES.filter((r) => r.allowedStations.includes(station));
}

export function getDefaultUnlockedStationRecipeIds(): string[] {
  return CRAFT_RECIPES.filter(
    (r) => r.allowedStations.includes('sanctuaryStation') && r.unlockedByDefault
  ).map((r) => r.id);
}
