/**
 * Handles Strategy Crafting input: hold V to open pane; WASD enters direction sequence.
 * Matches buffer against unlocked recipes and executes on match.
 */
import { EventTypes } from '../core/EventTypes.js';
import type { StrategyDirection } from '../config/strategyCraftingConfig.js';
import {
  STRATEGY_BUFFER_MAX_LENGTH,
  getStrategyRecipe,
  migrateUnlockedStrategyRecipeIds
} from '../config/strategyCraftingConfig.js';
import { executeRecipe, type StrategyCraftingContext } from '../state/StrategyCraftingActions.js';
import type { PlayingStateShape } from '../state/PlayingState.js';

const WASD_TO_DIRECTION: Record<string, StrategyDirection> = {
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right'
};

export interface StrategyCraftingInputControllerContext {
  playingState: PlayingStateShape;
  setStrategyCraftingPaneVisible(visible: boolean): void;
  /** Only open pane when playing or hub (same as inventory). */
  isStrategyCraftingAllowed?(): boolean;
  /** Called when recipe is executed (e.g. to add heal charge). */
  getStrategyCraftingContext(): StrategyCraftingContext | undefined;
  /** Called when pane opens so the game can stop player movement. */
  onStrategyCraftingOpen?(): void;
  /** Called when a recipe is executed successfully (for visual confirmation). */
  onStrategyCraftSuccess?(recipeId: string): void;
  /** Called when recipe matched but execution failed (e.g. not enough ingredients). */
  onStrategyCraftFailed?(reason: string): void;
  /** Called when the user enters a direction (WASD) while the pane is open. */
  onStrategyCraftInput?(): void;
}

export class StrategyCraftingInputController {
  private context: StrategyCraftingInputControllerContext | null = null;
  private buffer: StrategyDirection[] = [];
  private bound = false;

  init(context: StrategyCraftingInputControllerContext): void {
    this.context = context;
  }

  bind(eventBus: { on(event: string, fn: (key: string) => void): void }): void {
    if (this.bound || !this.context) return;
    this.bound = true;

    eventBus.on(EventTypes.INPUT_KEYDOWN, (key: string) => {
      const ctx = this.context;
      if (!ctx) return;
      const ps = ctx.playingState;
      const open = ps.strategyCraftingOpen ?? false;

      if (key === 'v') {
        if (ctx.isStrategyCraftingAllowed && !ctx.isStrategyCraftingAllowed()) return;
        ps.strategyCraftingOpen = true;
        ctx.setStrategyCraftingPaneVisible(true);
        ctx.onStrategyCraftingOpen?.();
        this.buffer = [];
        return;
      }

      const dir = WASD_TO_DIRECTION[key];
      if (dir && open) {
        ctx.onStrategyCraftInput?.();
        this.buffer.push(dir);
        if (this.buffer.length > STRATEGY_BUFFER_MAX_LENGTH) {
          this.buffer.shift();
        }
        const matched = this.matchBuffer(ps);
        if (matched) {
          const context = ctx.getStrategyCraftingContext?.();
          const result = executeRecipe(ps, matched, context);
          if (result.success) {
            ctx.onStrategyCraftSuccess?.(matched);
            this.buffer = [];
          } else {
            ctx.onStrategyCraftFailed?.('reason' in result ? result.reason : 'Unknown error');
          }
        }
        return;
      }
    });

    eventBus.on(EventTypes.INPUT_KEYUP, (key: string) => {
      const ctx = this.context;
      if (!ctx) return;
      const ps = ctx.playingState;

      if (key === 'v') {
        ps.strategyCraftingOpen = false;
        ctx.setStrategyCraftingPaneVisible(false);
        this.buffer = [];
      }
    });
  }

  /** Match current buffer against strategies in the loadout only. Returns recipe id or null. */
  private matchBuffer(ps: PlayingStateShape): string | null {
    const loadout = ps.strategyLoadoutSlotIds ?? [];
    const unlocked = migrateUnlockedStrategyRecipeIds(ps.unlockedStrategyRecipeIds ?? []);
    for (let i = 0; i < loadout.length; i++) {
      const recipeId = loadout[i];
      if (recipeId == null) continue;
      if (!unlocked.includes(recipeId)) continue;
      const recipe = getStrategyRecipe(recipeId);
      if (!recipe) continue;
      if (this.sequenceEqual(this.buffer, recipe.sequence)) return recipe.id;
    }
    return null;
  }

  private sequenceEqual(a: StrategyDirection[], b: StrategyDirection[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  /** Current input buffer (for UI). */
  getBuffer(): StrategyDirection[] {
    return this.buffer.slice();
  }
}
