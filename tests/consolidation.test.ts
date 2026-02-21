/**
 * Regression tests for consolidation: crossbow reload helper and unified PickupManager.
 */
import { describe, it, expect } from 'vitest';
import { updateCrossbowReload } from '../game/utils/crossbowReload.js';
import { PickupManager } from '../game/managers/PickupManager.js';

describe('updateCrossbowReload', () => {
  it('advances progress when isCrossbow and in progress', () => {
    const state = { crossbowReloadProgress: 0.2, crossbowReloadInProgress: true, crossbowPerfectReloadNext: false };
    const config = { player: { crossbow: { reloadTime: 1 } } };
    updateCrossbowReload(0.2, state, undefined, config, true);
    expect(state.crossbowReloadProgress).toBe(0.4);
    expect(state.crossbowReloadInProgress).toBe(true);
  });

  it('clears in-progress when progress reaches 1', () => {
    const state = { crossbowReloadProgress: 0.95, crossbowReloadInProgress: true };
    const config = { player: { crossbow: { reloadTime: 1 } } };
    updateCrossbowReload(0.1, state, undefined, config, true);
    expect(state.crossbowReloadProgress).toBe(1);
    expect(state.crossbowReloadInProgress).toBe(false);
  });

  it('resets state when player has no crossbow', () => {
    const state = { crossbowReloadProgress: 0.5, crossbowReloadInProgress: true, crossbowPerfectReloadNext: true };
    const player = {};
    const config = { player: {} };
    updateCrossbowReload(0.1, state, player as any, config, false);
    expect(state.crossbowReloadProgress).toBe(1);
    expect(state.crossbowReloadInProgress).toBe(false);
    expect(state.crossbowPerfectReloadNext).toBe(false);
  });
});

describe('PickupManager', () => {
  it('spawns one of each type and update runs without throwing', () => {
    const pm = new PickupManager();
    pm.spawnGold(10, 20, 5);
    pm.spawnWhetstone(30, 40);
    pm.spawnHealthOrb(50, 60, 25);
    pm.spawnWeapon(70, 80, { key: 'sword', durability: 10, prefixId: undefined, suffixId: undefined });
    expect(pm.items.length).toBe(4);
    expect(() => pm.update(0.016, null)).not.toThrow();
    expect(pm.items.length).toBe(4);
  });

  it('clear removes all items', () => {
    const pm = new PickupManager();
    pm.spawnGold(0, 0, 1);
    pm.spawnWhetstone(0, 0);
    expect(pm.items.length).toBe(2);
    pm.clear();
    expect(pm.items.length).toBe(0);
  });
});
