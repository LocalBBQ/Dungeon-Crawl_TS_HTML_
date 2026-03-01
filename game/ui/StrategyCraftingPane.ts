/**
 * Strategy Crafting pane: left-sliding DOM panel showing recipes and current input buffer.
 */
import type { StrategyDirection, StrategyRecipeDef } from '../config/strategyCraftingConfig.js';
import { STRATEGY_RECIPES, getStrategyRecipe, migrateUnlockedStrategyRecipeIds } from '../config/strategyCraftingConfig.js';
import type { PlayingStateShape } from '../state/PlayingState.js';
import {
  INVENTORY_SLOT_COUNT,
  isHerbSlot,
  isMushroomSlot,
  isWhetstoneSlot
} from '../state/PlayingState.js';

const DIRECTION_SYMBOLS: Record<StrategyDirection, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→'
};

const PANE_ID = 'strategy-crafting-pane';
const LIST_ID = 'strategy-crafting-list';
const BUFFER_ID = 'strategy-crafting-buffer';
const BUFFER_WRAP_ID = 'strategy-crafting-buffer-wrap';
const NOTIFICATION_ID = 'strategy-crafting-notification';
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

/** Build description for a recipe, including current inventory counts only for ingredients this recipe uses. */
function getRecipeDescriptionWithCounts(recipe: StrategyRecipeDef, ps: PlayingStateShape): string {
  const out = recipe.output;
  const parts: string[] = [recipe.description];
  if (out.type === 'craft' && out.consumes) {
    const needHerb = out.consumes.herb ?? 0;
    const needMushroom = out.consumes.mushroom ?? 0;
    if (needHerb > 0 || needMushroom > 0) {
      const have: string[] = [];
      if (needHerb > 0) have.push(`${countHerbs(ps)} herb${countHerbs(ps) !== 1 ? 's' : ''}`);
      if (needMushroom > 0) have.push(`${countMushrooms(ps)} mushroom${countMushrooms(ps) !== 1 ? 's' : ''}`);
      parts.push(`You have: ${have.join(', ')}.`);
    }
  }
  if (out.type === 'use' && out.use === 'whetstone') {
    const n = countWhetstones(ps);
    parts.push(`You have: ${n} whetstone${n !== 1 ? 's' : ''}.`);
  }
  return parts.join(' ');
}

const SUCCESS_FLASH_MS = 600;

/** Recipe id that just succeeded; used to highlight the row until successRecipeIdUntil. */
let successRecipeId: string | null = null;
let successRecipeIdUntil = 0;
let successFlashTimeoutId: number | undefined;

/** Clear green confirmation state (buffer + recipe highlight) and any pending timeout. */
function clearStrategyCraftSuccessState(): void {
  if (successFlashTimeoutId != null) {
    window.clearTimeout(successFlashTimeoutId);
    successFlashTimeoutId = undefined;
  }
  successRecipeId = null;
  successRecipeIdUntil = 0;
  const bufferWrap = document.getElementById(BUFFER_WRAP_ID);
  if (bufferWrap) bufferWrap.classList.remove('strategy-crafting-buffer-success');
}

function directionToSymbol(d: StrategyDirection): string {
  return DIRECTION_SYMBOLS[d] ?? d;
}

const DRAG_STORAGE_KEY = 'strategyCraftingPanePosition';

export function setStrategyCraftingPaneVisible(visible: boolean): void {
  const el = document.getElementById(PANE_ID);
  if (el) el.classList.toggle('strategy-crafting-pane-open', visible);
  if (!visible) {
    clearStrategyCraftSuccessState();
    const notif = document.getElementById(NOTIFICATION_ID);
    if (notif) {
      notif.classList.remove('strategy-crafting-notification-visible');
      notif.textContent = '';
      const t = (notif as HTMLElement & { _notificationTimeout?: number })._notificationTimeout;
      if (t != null) window.clearTimeout(t);
      (notif as HTMLElement & { _notificationTimeout?: number })._notificationTimeout = undefined;
    }
  }
}

/**
 * Make the Strategy Crafting pane draggable by its title bar. Call once after DOM ready.
 * Position is persisted to localStorage.
 */
export function initStrategyCraftingPaneDraggable(): void {
  const pane = document.getElementById(PANE_ID);
  const title = pane?.querySelector('.strategy-crafting-title');
  if (!pane || !title) return;

  try {
    const saved = localStorage.getItem(DRAG_STORAGE_KEY);
    if (saved) {
      const { left, top } = JSON.parse(saved) as { left: number; top: number };
      if (typeof left === 'number' && typeof top === 'number') {
        pane.style.left = `${left}px`;
        pane.style.top = `${top}px`;
      }
    }
  } catch {
    // ignore invalid saved position
  }

  (title as HTMLElement).style.cursor = 'move';
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    let left = startLeft + dx;
    let top = startTop + dy;
    const maxLeft = window.innerWidth - pane.getBoundingClientRect().width;
    const maxTop = window.innerHeight - 100;
    left = Math.max(0, Math.min(left, maxLeft));
    top = Math.max(0, Math.min(top, maxTop));
    pane.style.left = `${left}px`;
    pane.style.top = `${top}px`;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    try {
      const left = parseInt(pane.style.left, 10) || 0;
      const top = parseInt(pane.style.top, 10) || 0;
      localStorage.setItem(DRAG_STORAGE_KEY, JSON.stringify({ left, top }));
    } catch {
      // ignore
    }
  };

  title.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = pane.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
}

/**
 * Show an outcome notification (success or failure) for strategy crafting.
 * Message is shown in the pane for NOTIFICATION_DURATION_MS, then cleared.
 */
export function showStrategyCraftNotification(message: string, type: 'success' | 'failure'): void {
  const el = document.getElementById(NOTIFICATION_ID);
  if (!el) return;
  el.textContent = message;
  el.className = `strategy-crafting-notification strategy-crafting-notification-${type}`;
  el.classList.add('strategy-crafting-notification-visible');
  clearTimeout((el as HTMLElement & { _notificationTimeout?: number })._notificationTimeout);
  (el as HTMLElement & { _notificationTimeout?: number })._notificationTimeout = window.setTimeout(() => {
    el.classList.remove('strategy-crafting-notification-visible');
    (el as HTMLElement & { _notificationTimeout?: number })._notificationTimeout = undefined;
  }, NOTIFICATION_DURATION_MS);
}

/**
 * Show visual confirmation that a recipe was crafted successfully:
 * flash the matched recipe row and the input buffer area, then show outcome notification.
 */
export function showRecipeSuccess(recipeId: string): void {
  clearStrategyCraftSuccessState();
  successRecipeId = recipeId;
  successRecipeIdUntil = Date.now() + SUCCESS_FLASH_MS;
  const bufferWrap = document.getElementById(BUFFER_WRAP_ID);
  if (bufferWrap) bufferWrap.classList.add('strategy-crafting-buffer-success');
  successFlashTimeoutId = window.setTimeout(() => {
    clearStrategyCraftSuccessState();
    successFlashTimeoutId = undefined;
  }, SUCCESS_FLASH_MS);
  const recipe = getStrategyRecipe(recipeId);
  const label = recipe?.label ?? recipeId;
  showStrategyCraftNotification(`${label} succeeded`, 'success');
}

export function updateStrategyCraftingPane(
  ps: PlayingStateShape,
  buffer: StrategyDirection[]
): void {
  const pane = document.getElementById(PANE_ID);
  const listEl = document.getElementById(LIST_ID);
  const bufferEl = document.getElementById(BUFFER_ID);
  if (!pane || !listEl) return;

  const unlocked = migrateUnlockedStrategyRecipeIds(ps.unlockedStrategyRecipeIds ?? []);
  const selectedId = ps.selectedStrategyRecipeId ?? null;

  listEl.innerHTML = '';
  for (const recipe of STRATEGY_RECIPES) {
    if (!unlocked.includes(recipe.id)) continue;
    const item = document.createElement('div');
    item.className = 'strategy-crafting-recipe';
    if (recipe.id === selectedId) item.classList.add('selected');
    if (successRecipeId && recipe.id === successRecipeId && Date.now() < successRecipeIdUntil) item.classList.add('strategy-crafting-recipe-success');
    item.setAttribute('data-recipe-id', recipe.id);
    const seqSpan = document.createElement('span');
    seqSpan.className = 'strategy-crafting-sequence';
    recipe.sequence.forEach((dir, i) => {
      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'strategy-crafting-arrow';
      arrowSpan.textContent = directionToSymbol(dir);
      if (i < buffer.length) {
        if (buffer[i] === dir) arrowSpan.classList.add('strategy-crafting-arrow-correct');
        else arrowSpan.classList.add('strategy-crafting-arrow-incorrect');
      }
      seqSpan.appendChild(arrowSpan);
    });
    const labelSpan = document.createElement('span');
    labelSpan.className = 'strategy-crafting-label';
    labelSpan.textContent = recipe.label;
    const descSpan = document.createElement('span');
    descSpan.className = 'strategy-crafting-desc';
    descSpan.textContent = getRecipeDescriptionWithCounts(recipe, ps);
    item.appendChild(seqSpan);
    item.appendChild(labelSpan);
    item.appendChild(descSpan);
    listEl.appendChild(item);
  }

  if (bufferEl) {
    bufferEl.textContent = buffer.length > 0 ? buffer.map(directionToSymbol).join(' ') : '—';
  }
}
