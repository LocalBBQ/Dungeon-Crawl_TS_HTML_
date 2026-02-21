/**
 * Shared crossbow reload logic: advance progress, sync to player.
 * Used by Game (playing) and PlayingStateController (hub).
 */
import type { EntityShape } from '../types/entity.js';

export interface CrossbowReloadState {
  crossbowReloadProgress: number;
  crossbowReloadInProgress: boolean;
  crossbowPerfectReloadNext?: boolean;
}

export interface CrossbowReloadConfig {
  player: { crossbow?: { reloadTime: number } };
}

export function updateCrossbowReload(
  deltaTime: number,
  playingState: CrossbowReloadState,
  player: EntityShape | undefined,
  config: CrossbowReloadConfig,
  isCrossbow: boolean
): void {
  const crossbowConfig = config.player.crossbow;

  if (isCrossbow && crossbowConfig && playingState.crossbowReloadInProgress && playingState.crossbowReloadProgress < 1) {
    playingState.crossbowReloadProgress = Math.min(1, playingState.crossbowReloadProgress + deltaTime / crossbowConfig.reloadTime);
    if (playingState.crossbowReloadProgress >= 1) playingState.crossbowReloadInProgress = false;
  }
  if (player && !isCrossbow) {
    playingState.crossbowReloadProgress = 1;
    playingState.crossbowReloadInProgress = false;
    playingState.crossbowPerfectReloadNext = false;
  }
  if (player && isCrossbow) {
    (player as EntityShape & { crossbowReloadProgress?: number; crossbowReloadInProgress?: boolean }).crossbowReloadProgress = playingState.crossbowReloadProgress;
    (player as EntityShape & { crossbowReloadInProgress?: boolean }).crossbowReloadInProgress = playingState.crossbowReloadInProgress;
  }
}
