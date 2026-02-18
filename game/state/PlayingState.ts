/**
 * Centralized state for the playing/hub phase. Single source of truth for portal,
 * board, chest, cooldowns, crossbow, inventory, etc.
 */
import type { Quest } from '../types/quest.ts';

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

export interface ShopState {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One weapon instance: key + durability + optional enchant prefix/suffix. Used for inventory slots and chest. */
export type WeaponInstance = {
  key: string;
  durability: number;
  prefixId?: string;
  suffixId?: string;
};

/** One inventory bag slot: weapon instance or empty. */
export type InventorySlot = WeaponInstance | null;

export function getSlotKey(slot: InventorySlot): string | null {
  return slot?.key ?? null;
}

export const INVENTORY_SLOT_COUNT = 24;

export interface PlayingStateShape {
  portal: PortalState | null;
  portalUseCooldown: number;
  playerNearPortal: boolean;
  board: BoardState | null;
  boardOpen: boolean;
  boardUseCooldown: number;
  playerNearBoard: boolean;
  /** In hub: player is within quest portal bounds (when activeQuest is set). */
  playerNearQuestPortal: boolean;
  questPortalUseCooldown: number;
  chest: ChestState | null;
  chestOpen: boolean;
  chestUseCooldown: number;
  playerNearChest: boolean;
  /** Reroll enchant NPC station (hub). */
  rerollStation: { x: number; y: number; width: number; height: number } | null;
  rerollStationOpen: boolean;
  rerollStationUseCooldown: number;
  playerNearRerollStation: boolean;
  /** Weapon in the reroll station slot (drag in to modify, drag out to re-equip or stash). */
  rerollSlotItem: WeaponInstance | null;
  shop: ShopState | null;
  shopOpen: boolean;
  shopUseCooldown: number;
  shopScrollOffset: number;
  /** Which weapon-type dropdowns are expanded. Key = base weapon key; undefined/true = expanded, false = collapsed. */
  shopExpandedWeapons?: Record<string, boolean>;
  playerNearShop: boolean;
  crossbowReloadProgress: number;
  crossbowReloadInProgress: boolean;
  crossbowPerfectReloadNext: boolean;
  playerProjectileCooldown: number;
  inventoryOpen: boolean;
  killsThisLife: number;
  gold: number;
  lastHitEnemyId: string | null;
  playerInGatherableRange: boolean;
  equippedMainhandKey: string;
  equippedOffhandKey: string;
  /** Current durability for equipped mainhand (0..MAX_WEAPON_DURABILITY). One hit = -1. */
  equippedMainhandDurability: number;
  /** Current durability for equipped offhand (0..MAX_WEAPON_DURABILITY). */
  equippedOffhandDurability: number;
  /** Enchant prefix/suffix for equipped mainhand (synced when equipping). */
  equippedMainhandPrefixId?: string;
  equippedMainhandSuffixId?: string;
  equippedOffhandPrefixId?: string;
  equippedOffhandSuffixId?: string;
  /** 24 slots: weapon instance or null. Starts empty; filled only by taking from chest. */
  inventorySlots: InventorySlot[];
  /** Weapon instances in the chest. Each instance has its own durability. */
  chestSlots: WeaponInstance[];
  hubSelectedLevel: number;
  /** Index into questList for the selected quest on the board. */
  hubSelectedQuestIndex: number;
  /** Current quest list shown on the board (set when board opens). */
  questList: Quest[];
  /** Quest chosen when starting a run; null when in hub or after clearing. */
  activeQuest: Quest | null;
  /** Gold multiplier from active quest difficulty; 1 when no quest. */
  questGoldMultiplier: number;
  screenBeforePause: 'playing' | 'hub' | null;
  /** When transitioning from level to sanctuary: health/stamina to restore on the new player entity. */
  savedSanctuaryHealth?: number;
  savedSanctuaryStamina?: number;
}

/** Initial chest weapon keys (one of each base at Rusty tier; shield has no tier). */
const INITIAL_CHEST_WEAPON_KEYS = [
  'sword_rusty', 'shield', 'defender_rusty', 'dagger_rusty', 'greatsword_rusty', 'crossbow_rusty', 'mace_rusty'
] as const;

/** Initial chest contents: one instance of each, full durability. */
export function getInitialChestWeapons(): WeaponInstance[] {
  return INITIAL_CHEST_WEAPON_KEYS.map((key) => ({ key, durability: MAX_WEAPON_DURABILITY }));
}

/** Max durability per weapon. Each confirmed hit costs 1. */
export const MAX_WEAPON_DURABILITY = 100;

/** Resolves config defaultWeapon (+ optional defaultOffhand) to mainhand and offhand. */
export function resolveDefaultWeapons(defaultWeapon: string, defaultOffhand?: string): { mainhand: string; offhand: string } {
  return { mainhand: defaultWeapon, offhand: defaultOffhand ?? 'none' };
}

const defaultPlayingState = (defaultMainhand: string, defaultOffhand: string, chestSlots: WeaponInstance[]): PlayingStateShape => ({
  portal: null,
  portalUseCooldown: 0,
  playerNearPortal: false,
  board: null,
  boardOpen: false,
  boardUseCooldown: 0,
  playerNearBoard: false,
  playerNearQuestPortal: false,
  questPortalUseCooldown: 0,
  chest: null,
  chestOpen: false,
  chestUseCooldown: 0,
  playerNearChest: false,
  rerollStation: null,
  rerollStationOpen: false,
  rerollStationUseCooldown: 0,
  playerNearRerollStation: false,
  rerollSlotItem: null,
  shop: null,
  shopOpen: false,
  shopUseCooldown: 0,
  shopScrollOffset: 0,
  playerNearShop: false,
  crossbowReloadProgress: 1,
  crossbowReloadInProgress: false,
  crossbowPerfectReloadNext: false,
  playerProjectileCooldown: 0,
  inventoryOpen: false,
  killsThisLife: 0,
  gold: 10000,
  lastHitEnemyId: null,
  playerInGatherableRange: false,
  equippedMainhandKey: defaultMainhand,
  equippedOffhandKey: defaultOffhand,
  equippedMainhandDurability: MAX_WEAPON_DURABILITY,
  equippedOffhandDurability: MAX_WEAPON_DURABILITY,
  inventorySlots: Array(INVENTORY_SLOT_COUNT).fill(null) as InventorySlot[],
  chestSlots: chestSlots.map((i) => ({ key: i.key, durability: i.durability, prefixId: i.prefixId, suffixId: i.suffixId })),
  hubSelectedLevel: 1,
  hubSelectedQuestIndex: 0,
  questList: [],
  activeQuest: null,
  questGoldMultiplier: 1,
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
  playerNearQuestPortal = false;
  questPortalUseCooldown = 0;
  chest: ChestState | null = null;
  chestOpen = false;
  chestUseCooldown = 0;
  playerNearChest = false;
  rerollStation: { x: number; y: number; width: number; height: number } | null = null;
  rerollStationOpen = false;
  rerollStationUseCooldown = 0;
  playerNearRerollStation = false;
  rerollSlotItem: WeaponInstance | null = null;
  shop: ShopState | null = null;
  shopOpen = false;
  shopUseCooldown = 0;
  shopScrollOffset = 0;
  playerNearShop = false;
  crossbowReloadProgress = 1;
  crossbowReloadInProgress = false;
  crossbowPerfectReloadNext = false;
  playerProjectileCooldown = 0;
  inventoryOpen = false;
  killsThisLife = 0;
  gold = 10000;
  lastHitEnemyId: string | null = null;
  playerInGatherableRange = false;
  equippedMainhandKey: string;
  equippedOffhandKey: string;
  equippedMainhandDurability = MAX_WEAPON_DURABILITY;
  equippedOffhandDurability = MAX_WEAPON_DURABILITY;
  inventorySlots: InventorySlot[] = Array(INVENTORY_SLOT_COUNT).fill(null) as InventorySlot[];
  chestSlots: WeaponInstance[] = getInitialChestWeapons();
  hubSelectedLevel = 1;
  hubSelectedQuestIndex = 0;
  questList: Quest[] = [];
  activeQuest: Quest | null = null;
  questGoldMultiplier = 1;
  screenBeforePause: 'playing' | 'hub' | null = null;

  constructor(defaultMainhand: string, defaultOffhand: string = 'none') {
    this.equippedMainhandKey = defaultMainhand;
    this.equippedOffhandKey = defaultOffhand;
  }

  reset(_defaultWeapon?: string): void {
    Object.assign(this, defaultPlayingState('none', 'none', getInitialChestWeapons()));
    this.chestSlots = getInitialChestWeapons();
  }
}
