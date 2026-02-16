/**
 * Centralized state for the playing/hub phase. Single source of truth for portal,
 * board, chest, cooldowns, crossbow, inventory, etc.
 */
export interface PortalState {
  x: number;
  y: number;
  width: number;
  height: number;
  spawned: boolean;
  hasNextLevel: boolean;
  targetLevel: number;
}

export interface BoardState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChestState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlayingStateShape {
  portal: PortalState | null;
  portalUseCooldown: number;
  playerNearPortal: boolean;
  board: BoardState | null;
  boardOpen: boolean;
  boardUseCooldown: number;
  playerNearBoard: boolean;
  chest: ChestState | null;
  chestOpen: boolean;
  chestUseCooldown: number;
  playerNearChest: boolean;
  crossbowReloadProgress: number;
  crossbowReloadInProgress: boolean;
  crossbowPerfectReloadNext: boolean;
  playerProjectileCooldown: number;
  inventoryOpen: boolean;
  killsThisLife: number;
  gold: number;
  lastHitEnemyId: string | null;
  playerInGatherableRange: boolean;
  equippedWeaponKey: string;
  hubSelectedLevel: number;
  screenBeforePause: 'playing' | 'hub' | null;
}

const defaultPlayingState = (defaultWeapon: string): PlayingStateShape => ({
  portal: null,
  portalUseCooldown: 0,
  playerNearPortal: false,
  board: null,
  boardOpen: false,
  boardUseCooldown: 0,
  playerNearBoard: false,
  chest: null,
  chestOpen: false,
  chestUseCooldown: 0,
  playerNearChest: false,
  crossbowReloadProgress: 1,
  crossbowReloadInProgress: false,
  crossbowPerfectReloadNext: false,
  playerProjectileCooldown: 0,
  inventoryOpen: false,
  killsThisLife: 0,
  gold: 0,
  lastHitEnemyId: null,
  playerInGatherableRange: false,
  equippedWeaponKey: defaultWeapon,
  hubSelectedLevel: 1,
  screenBeforePause: null
});

export class PlayingState implements PlayingStateShape {
  portal: PortalState | null = null;
  portalUseCooldown = 0;
  playerNearPortal = false;
  board: BoardState | null = null;
  boardOpen = false;
  boardUseCooldown = 0;
  playerNearBoard = false;
  chest: ChestState | null = null;
  chestOpen = false;
  chestUseCooldown = 0;
  playerNearChest = false;
  crossbowReloadProgress = 1;
  crossbowReloadInProgress = false;
  crossbowPerfectReloadNext = false;
  playerProjectileCooldown = 0;
  inventoryOpen = false;
  killsThisLife = 0;
  gold = 0;
  lastHitEnemyId: string | null = null;
  playerInGatherableRange = false;
  equippedWeaponKey: string;
  hubSelectedLevel = 1;
  screenBeforePause: 'playing' | 'hub' | null = null;

  constructor(defaultWeapon: string) {
    this.equippedWeaponKey = defaultWeapon;
  }

  reset(defaultWeapon: string): void {
    Object.assign(this, defaultPlayingState(defaultWeapon));
  }
}
