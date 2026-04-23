/**
 * Sanctuary crafting station: DOM modal listing station recipes; rows use data-recipe-id for crafting.
 */
import { getCraftRecipesForStation } from '../config/craftingConfig.js';
import type { CraftRecipeDef } from '../config/craftingConfig.js';
import type { StrategyCraftOutput } from '../config/strategyCraftingConfig.js';
import type { PlayingStateShape } from '../state/PlayingState.js';
import {
  INVENTORY_SLOT_COUNT,
  isHerbSlot,
  isMushroomSlot,
  isWhetstoneSlot,
  isPageSlot
} from '../state/PlayingState.js';

const PANE_ID = 'station-crafting-pane';
const LIST_ID = 'station-crafting-list';
const NOTIFICATION_ID = 'station-crafting-notification';
const NOTIFICATION_DURATION_MS = 2500;

function countHerbs(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return 0;
  return ps.inventorySlots.reduce((sum, s) => (isHerbSlot(s) ? sum + s.count : sum), 0);
}
function countMushrooms(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return 0;
  return ps.inventorySlots.reduce((sum, s) => (isMushroomSlot(s) ? sum + s.count : sum), 0);
}
function countWhetstones(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return 0;
  return ps.inventorySlots.reduce((sum, s) => (isWhetstoneSlot(s) ? sum + s.count : sum), 0);
}
function countPages(ps: PlayingStateShape): number {
  if (!ps.inventorySlots || ps.inventorySlots.length !== INVENTORY_SLOT_COUNT) return 0;
  return ps.inventorySlots.reduce((sum, s) => (isPageSlot(s) ? sum + s.count : sum), 0);
}

function describeWithCounts(output: StrategyCraftOutput, ps: PlayingStateShape, base: string): string {
  const parts: string[] = [base];
  if (output.type === 'craft' && output.consumes) {
    const needHerb = output.consumes.herb ?? 0;
    const needMushroom = output.consumes.mushroom ?? 0;
    const needPage = output.consumes.page ?? 0;
    if (needHerb > 0 || needMushroom > 0 || needPage > 0) {
      const have: string[] = [];
      if (needHerb > 0) have.push(`${countHerbs(ps)} herb${countHerbs(ps) !== 1 ? 's' : ''}`);
      if (needMushroom > 0) have.push(`${countMushrooms(ps)} mushroom${countMushrooms(ps) !== 1 ? 's' : ''}`);
      if (needPage > 0) have.push(`${countPages(ps)} page${countPages(ps) !== 1 ? 's' : ''}`);
      parts.push(`You have: ${have.join(', ')}.`);
    }
  }
  if (output.type === 'use' && output.use === 'whetstone') {
    const n = countWhetstones(ps);
    parts.push(`You have: ${n} whetstone${n !== 1 ? 's' : ''}.`);
  }
  return parts.join(' ');
}

export function setStationCraftingPaneVisible(visible: boolean): void {
  const el = document.getElementById(PANE_ID);
  if (el) el.classList.toggle('station-crafting-pane-open', visible);
  if (!visible) {
    const notif = document.getElementById(NOTIFICATION_ID);
    if (notif) {
      notif.classList.remove('station-crafting-notification-visible');
      notif.textContent = '';
      const t = (notif as HTMLElement & { _notificationTimeout?: number })._notificationTimeout;
      if (t != null) window.clearTimeout(t);
      (notif as HTMLElement & { _notificationTimeout?: number })._notificationTimeout = undefined;
    }
  }
}

export function showStationCraftingNotification(message: string, type: 'success' | 'failure' = 'success'): void {
  const el = document.getElementById(NOTIFICATION_ID);
  if (!el) return;
  el.textContent = message;
  el.className = `station-crafting-notification station-crafting-notification-${type}`;
  el.classList.add('station-crafting-notification-visible');
  clearTimeout((el as HTMLElement & { _notificationTimeout?: number })._notificationTimeout);
  (el as HTMLElement & { _notificationTimeout?: number })._notificationTimeout = window.setTimeout(() => {
    el.classList.remove('station-crafting-notification-visible');
    (el as HTMLElement & { _notificationTimeout?: number })._notificationTimeout = undefined;
  }, NOTIFICATION_DURATION_MS);
}

function recipeSort(a: CraftRecipeDef, b: CraftRecipeDef): number {
  return a.label.localeCompare(b.label);
}

export function updateStationCraftingPane(ps: PlayingStateShape): void {
  const listEl = document.getElementById(LIST_ID);
  if (!listEl) return;

  const unlocked = new Set(ps.unlockedStationRecipeIds ?? []);
  const selectedId = ps.selectedStationRecipeId ?? null;
  const recipes = getCraftRecipesForStation('sanctuaryStation').filter((r) => unlocked.has(r.id)).sort(recipeSort);

  listEl.innerHTML = '';
  for (const recipe of recipes) {
    const item = document.createElement('div');
    item.className = 'station-crafting-recipe';
    item.setAttribute('role', 'listitem');
    if (recipe.id === selectedId) item.classList.add('selected');
    item.setAttribute('data-recipe-id', recipe.id);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'station-crafting-label';
    labelSpan.textContent = recipe.label;
    const descSpan = document.createElement('span');
    descSpan.className = 'station-crafting-desc';
    descSpan.textContent = describeWithCounts(recipe.output, ps, recipe.description);
    item.appendChild(labelSpan);
    item.appendChild(descSpan);
    listEl.appendChild(item);
  }
}
