/**
 * Centralized state for the playing/hub phase. Single source of truth for portal,
 * board, chest, cooldowns, crossbow, inventory, etc.
 */
import type { Quest } from '../types/quest.js';
import { getDefaultUnlockedRecipeIds } from '../config/strategyCraftingConfig.js';

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

/** Stackable consumable in inventory (e.g. whetstone). */
export type WhetstoneConsumable = { type: 'whetstone'; count: number };

/** Stackable herb (gathered in world). */
export type HerbConsumable = { type: 'herb'; count: number };

/** Stackable mushroom (gathered in world). */
export type MushroomConsumable = { type: 'mushroom'; count: number };

/** Stackable honey (consumable). */
export type HoneyConsumable = { type: 'honey'; count: number };

/** Stackable potion (consumable). */
export type PotionConsumable = { type: 'potion'; count: number };

/** Stackable gold (stored in inventory). */
export type GoldConsumable = { type: 'gold'; count: number };

/** One inventory bag slot: weapon instance, consumable, or empty. */
export type InventorySlot = WeaponInstance | WhetstoneConsumable | HerbConsumable | MushroomConsumable | HoneyConsumable | PotionConsumable | GoldConsumable | null;

/** Armor equipment slot id (head, chest, hands, feet). */
export type ArmorSlotId = 'head' | 'chest' | 'hands' | 'feet';

/** One armor instance: key + durability. Same shape as WeaponInstance. */
export type ArmorInstance = { key: string; durability: number };

export const MAX_ARMOR_DURABILITY = 100;

export function getSlotKey(slot: InventorySlot): string | null {
  return slot != null && 'key' in slot ? slot.key : null;
}

export function isWeaponInstance(slot: InventorySlot): slot is WeaponInstance {
  return slot != null && 'key' in slot;
}

export function isWhetstoneSlot(slot: InventorySlot): slot is WhetstoneConsumable {
  return slot != null && 'type' in slot && (slot as WhetstoneConsumable).type === 'whetstone';
}

export function isHerbSlot(slot: InventorySlot): slot is HerbConsumable {
  return slot != null && 'type' in slot && (slot as HerbConsumable).type === 'herb';
}

export function isMushroomSlot(slot: InventorySlot): slot is MushroomConsumable {
  return slot != null && 'type' in slot && (slot as MushroomConsumable).type === 'mushroom';
}

export function isHoneySlot(slot: InventorySlot): slot is HoneyConsumable {
  return slot != null && 'type' in slot && (slot as HoneyConsumable).type === 'honey';
}

export function isPotionSlot(slot: InventorySlot): slot is PotionConsumable {
  return slot != null && 'type' in slot && (slot as PotionConsumable).type === 'potion';
}

export function isGoldSlot(slot: InventorySlot): slot is GoldConsumable {
  return slot != null && 'type' in slot && (slot as GoldConsumable).type === 'gold';
}

/** Player inventory: 18 slots (3×6 grid) holding weapons and/or armor. */
export const INVENTORY_SLOT_COUNT = 18;

/** Toolbelt: 4 quick-access slots for potions (extra inventory). */
export const TOOLBELT_SLOT_COUNT = 4;

/** Chest: 24 slots for weapons (and/or armor). */
export const CHEST_SLOT_COUNT = 24;

export interface PlayingStateShape {
  portal: PortalState | null;
  portalUseCooldown: number;
  playerNearPortal: boolean;
  /** 0..1 progress while channeling portal/stairs (E or B); 0 when not channeling. */
  portalChannelProgress: number;
  /** Which action is being channeled: 'e' = next area, 'b' = return to sanctuary; null when not channeling. */
  portalChannelAction: 'e' | 'b' | null;
  /** 0..1 progress while holding B to spawn recall portal; 0 when not holding. */
  recallChannelProgress: number;
  /** Player-spawned blue portal (hold B 2.5s); E at portal returns to Sanctuary and keeps inventory. */
  recallPortal: { x: number; y: number; width: number; height: number; spawned: boolean } | null;
  playerNearRecallPortal: boolean;
  /** 0..1 channel progress while holding E at recall portal; 0 when not channeling. */
  recallPortalChannelProgress: number;
  board: BoardState | null;
  boardOpen: boolean;
  boardUseCooldown: number;
  playerNearBoard: boolean;
  /** In hub: player is within quest portal bounds (when activeQuest is set). */
  playerNearQuestPortal: boolean;
  questPortalUseCooldown: number;
  /** 0..1 channel progress for entering quest via hub quest portal; 0 when not channeling. */
  questPortalChannelProgress: number;
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
  /** Which armor-slot dropdowns are expanded. Key = slot id; undefined = collapsed (auto-collapsed like weapons). */
  shopExpandedArmor?: Record<string, boolean>;
  /** Which parent categories are expanded: 'weapons' | 'armor'. undefined = both collapsed. */
  shopExpandedCategories?: Record<string, boolean>;
  playerNearShop: boolean;
  crossbowReloadProgress: number;
  crossbowReloadInProgress: boolean;
  crossbowPerfectReloadNext: boolean;
  playerProjectileCooldown: number;
  inventoryOpen: boolean;
  killsThisLife: number;
  /** @deprecated Use getTotalGoldFromInventory; legacy value migrated into inventory on first read. */
  gold?: number;
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
  /** Toolbelt: quick-access slots (e.g. potions). Extra inventory; 4 slots. */
  toolbeltSlots: (PotionConsumable | null)[];
  /** Chest: 24 slots. Weapons (and optionally armor) stored here. */
  chestSlots: (WeaponInstance | null)[];
  /** Equipped armor: key per slot, 'none' when empty. */
  equippedArmorHeadKey: string;
  equippedArmorChestKey: string;
  equippedArmorHandsKey: string;
  equippedArmorFeetKey: string;
  /** Current durability for each equipped armor slot (0..MAX_ARMOR_DURABILITY). */
  equippedArmorHeadDurability: number;
  equippedArmorChestDurability: number;
  equippedArmorHandsDurability: number;
  equippedArmorFeetDurability: number;
  hubSelectedLevel: number;
  /** Index into questList for the selected quest on the board. */
  hubSelectedQuestIndex: number;
  /** Current quest list shown on the board (set when board opens). */
  questList: Quest[];
  /** Quest chosen when starting a run; null when in hub or after clearing. */
  activeQuest: Quest | null;
  /** Gold multiplier from active quest difficulty; 1 when no quest. */
  questGoldMultiplier: number;
  /** Current delve floor (1-based). 0 when not in a delve run. */
  delveFloor: number;
  /** Last enemy kill position (center) in delve; used to spawn stairs. */
  lastEnemyKillX: number | null;
  lastEnemyKillY: number | null;
  /** Seconds left to show the "Quest Complete!" flair; 0 = hidden. */
  questCompleteFlairRemaining: number;
  /** True after we've triggered the flair this run (so we don't re-trigger every frame). */
  questCompleteFlairTriggered?: boolean;
  /** Persistent list of completed static quest ids (for biome unlock). */
  completedQuestIds: string[];
  /** Level ids (biomes) unlocked for play. Default [1] = Village Outskirts. */
  unlockedLevelIds: number[];
  /** When board is open: 'bulletin' = random quests, 'mainQuest' = static quest list. */
  boardTab: 'bulletin' | 'mainQuest';
  /** Index of selected row in the Main Quest tab. */
  hubSelectedMainQuestIndex: number;
  screenBeforePause: 'playing' | 'hub' | null;
  /** When entering a level with a survive quest, set once; used for objective completion. */
  questSurviveStartTime?: number;
  /** When transitioning from level to sanctuary: health/stamina to restore on the new player entity. */
  savedSanctuaryHealth?: number;
  savedSanctuaryStamina?: number;
  /** When entering level 12 from a cave entrance, set to return level (e.g. 1); portal then returns here instead of hub. */
  portalReturnLevel: number | null;
  /** In hub: level to re-enter via blue portal (set when returning from a quest). */
  hubReenterLevel: number | null;
  /** In hub: quest to restore when re-entering (same quest that was left). */
  hubReenterQuest: Quest | null;
  /** In hub: delve floor to restore when re-entering a delve. */
  hubReenterDelveFloor: number;
  /** True when returning to hub via blue recall portal (E at blue); only then show blue re-enter portal in hub. Cleared in startGame(). */
  returnedViaBlueRecall?: boolean;
  playerNearReenterPortal: boolean;
  reenterPortalChannelProgress: number;
  /** True when player overlaps a caveEntrance obstacle (level 1 etc). */
  playerNearCaveEntrance: boolean;
  /** World rect of the cave entrance the player is overlapping (for prompt position). */
  caveEntranceRect: { x: number; y: number; width: number; height: number } | null;
  /** 0..1 channel progress for entering cave; 0 when not channeling. */
  caveEntranceChannelProgress: number;
  /** True when player overlaps a caveExit obstacle (inside cave, exit back to previous level). */
  playerNearCaveExit: boolean;
  /** World rect of the cave exit the player is overlapping (for prompt position). */
  caveExitRect: { x: number; y: number; width: number; height: number } | null;
  /** 0..1 channel progress for exiting cave; 0 when not channeling. */
  caveExitChannelProgress: number;
  /** Strategy Crafting: true while V is held. */
  strategyCraftingOpen: boolean;
  /** Recipe ids the player has collected (unlocked). */
  unlockedStrategyRecipeIds: string[];
  /** Selected recipe id in the Strategy Crafting pane. */
  selectedStrategyRecipeId: string | null;
  /** Player class chosen at new game (affects starting loadouts). */
  playerClass?: PlayerClass;
  /** Which weapon set is active (0 or 1). Swapped with R. */
  activeWeaponSet?: 0 | 1;
  /** Second weapon set. */
  equippedMainhandKey2?: string;
  equippedOffhandKey2?: string;
  equippedMainhandDurability2?: number;
  equippedOffhandDurability2?: number;
  /** Draggable UI panel offsets (dx, dy) from default position. Persisted so layout respects user drag. */
  uiPanelOffsets?: {
    inventory?: { dx: number; dy: number };
    shop?: { dx: number; dy: number };
    reroll?: { dx: number; dy: number };
  };
  /** Serialized level map for return-from-cave; keyed by level id. */
  serializedReturnLevelMap?: Record<string, unknown>;
  /** True when ogre den exit portal has been spawned (cave sub-level). */
  ogreDenExitSpawned?: boolean;
}

export type PlayerClass = 'warrior' | 'mage' | 'rogue';

/** Default loadouts per class: Warrior = sword; Mage = staff; Rogue = dagger + bow in set 2. */
export function getDefaultLoadoutsForClass(playerClass: PlayerClass): { set1: { mainhand: string; offhand: string }; set2: { mainhand: string; offhand: string } } {
  if (playerClass === 'warrior') {
    return { set1: { mainhand: 'sword_rusty', offhand: 'none' }, set2: { mainhand: 'none', offhand: 'none' } };
  }
  if (playerClass === 'mage') {
    return { set1: { mainhand: 'staff_oak', offhand: 'none' }, set2: { mainhand: 'none', offhand: 'none' } };
  }
  return { set1: { mainhand: 'dagger_rusty', offhand: 'none' }, set2: { mainhand: 'bow_oak', offhand: 'none' } }; // rogue
}

export interface ActiveWeaponSetSnapshot {
  mainhandKey: string;
  offhandKey: string;
  mainhandDurability: number;
  offhandDurability: number;
  mainhandPrefixId?: string;
  mainhandSuffixId?: string;
  offhandPrefixId?: string;
  offhandSuffixId?: string;
}

export function getActiveWeaponSet(ps: PlayingStateShape): ActiveWeaponSetSnapshot {
  if (ps.activeWeaponSet === 1) {
    return {
      mainhandKey: ps.equippedMainhandKey2 ?? 'none',
      offhandKey: ps.equippedOffhandKey2 ?? 'none',
      mainhandDurability: ps.equippedMainhandDurability2 ?? MAX_WEAPON_DURABILITY,
      offhandDurability: ps.equippedOffhandDurability2 ?? MAX_WEAPON_DURABILITY,
      mainhandPrefixId: (ps as unknown as Record<string, unknown>).equippedMainhandPrefixId2 as string | undefined,
      mainhandSuffixId: (ps as unknown as Record<string, unknown>).equippedMainhandSuffixId2 as string | undefined,
      offhandPrefixId: (ps as unknown as Record<string, unknown>).equippedOffhandPrefixId2 as string | undefined,
      offhandSuffixId: (ps as unknown as Record<string, unknown>).equippedOffhandSuffixId2 as string | undefined
    };
  }
  return {
    mainhandKey: ps.equippedMainhandKey,
    offhandKey: ps.equippedOffhandKey,
    mainhandDurability: ps.equippedMainhandDurability,
    offhandDurability: ps.equippedOffhandDurability,
    mainhandPrefixId: ps.equippedMainhandPrefixId,
    mainhandSuffixId: ps.equippedMainhandSuffixId,
    offhandPrefixId: ps.equippedOffhandPrefixId,
    offhandSuffixId: ps.equippedOffhandSuffixId
  };
}

export function getInactiveWeaponSet(ps: PlayingStateShape): ActiveWeaponSetSnapshot {
  if (ps.activeWeaponSet === 1) {
    return {
      mainhandKey: ps.equippedMainhandKey,
      offhandKey: ps.equippedOffhandKey,
      mainhandDurability: ps.equippedMainhandDurability,
      offhandDurability: ps.equippedOffhandDurability,
      mainhandPrefixId: ps.equippedMainhandPrefixId,
      mainhandSuffixId: ps.equippedMainhandSuffixId,
      offhandPrefixId: ps.equippedOffhandPrefixId,
      offhandSuffixId: ps.equippedOffhandSuffixId
    };
  }
  return {
    mainhandKey: ps.equippedMainhandKey2 ?? 'none',
    offhandKey: ps.equippedOffhandKey2 ?? 'none',
    mainhandDurability: ps.equippedMainhandDurability2 ?? MAX_WEAPON_DURABILITY,
    offhandDurability: ps.equippedOffhandDurability2 ?? MAX_WEAPON_DURABILITY,
    mainhandPrefixId: (ps as unknown as Record<string, unknown>).equippedMainhandPrefixId2 as string | undefined,
    mainhandSuffixId: (ps as unknown as Record<string, unknown>).equippedMainhandSuffixId2 as string | undefined,
    offhandPrefixId: (ps as unknown as Record<string, unknown>).equippedOffhandPrefixId2 as string | undefined,
    offhandSuffixId: (ps as unknown as Record<string, unknown>).equippedOffhandSuffixId2 as string | undefined
  };
}

export function setActiveWeaponSet(ps: PlayingStateShape, updates: Partial<ActiveWeaponSetSnapshot>): void {
  const target = ps as unknown as Record<string, unknown>;
  if (ps.activeWeaponSet === 1) {
    if (updates.mainhandKey !== undefined) target.equippedMainhandKey2 = updates.mainhandKey;
    if (updates.offhandKey !== undefined) target.equippedOffhandKey2 = updates.offhandKey;
    if (updates.mainhandDurability !== undefined) target.equippedMainhandDurability2 = updates.mainhandDurability;
    if (updates.offhandDurability !== undefined) target.equippedOffhandDurability2 = updates.offhandDurability;
    if (updates.mainhandPrefixId !== undefined) target.equippedMainhandPrefixId2 = updates.mainhandPrefixId;
    if (updates.mainhandSuffixId !== undefined) target.equippedMainhandSuffixId2 = updates.mainhandSuffixId;
    if (updates.offhandPrefixId !== undefined) target.equippedOffhandPrefixId2 = updates.offhandPrefixId;
    if (updates.offhandSuffixId !== undefined) target.equippedOffhandSuffixId2 = updates.offhandSuffixId;
  } else {
    if (updates.mainhandKey !== undefined) ps.equippedMainhandKey = updates.mainhandKey;
    if (updates.offhandKey !== undefined) ps.equippedOffhandKey = updates.offhandKey;
    if (updates.mainhandDurability !== undefined) ps.equippedMainhandDurability = updates.mainhandDurability;
    if (updates.offhandDurability !== undefined) ps.equippedOffhandDurability = updates.offhandDurability;
    if (updates.mainhandPrefixId !== undefined) ps.equippedMainhandPrefixId = updates.mainhandPrefixId;
    if (updates.mainhandSuffixId !== undefined) ps.equippedMainhandSuffixId = updates.mainhandSuffixId;
    if (updates.offhandPrefixId !== undefined) ps.equippedOffhandPrefixId = updates.offhandPrefixId;
    if (updates.offhandSuffixId !== undefined) ps.equippedOffhandSuffixId = updates.offhandSuffixId;
  }
}

export function swapActiveWeaponSet(ps: PlayingStateShape): void {
  (ps as unknown as Record<string, unknown>).activeWeaponSet = ps.activeWeaponSet === 1 ? 0 : 1;
}

/** Initial chest weapon keys (one of each base at Rusty tier; shield at Wooden tier). */
const INITIAL_CHEST_WEAPON_KEYS = [
  'sword_rusty', 'shield_wooden', 'defender_rusty', 'dagger_rusty', 'greatsword_rusty', 'crossbow_rusty', 'mace_rusty'
] as const;

/** Initial chest contents: 24 slots, first 7 filled with one of each base weapon, rest empty. */
export function getInitialChestWeapons(): (WeaponInstance | null)[] {
  const filled = INITIAL_CHEST_WEAPON_KEYS.map((key) => ({ key, durability: MAX_WEAPON_DURABILITY } as WeaponInstance));
  const slots: (WeaponInstance | null)[] = Array(CHEST_SLOT_COUNT).fill(null);
  filled.forEach((w, i) => { slots[i] = w; });
  return slots;
}

/** Max durability per weapon. Each confirmed hit costs 1. */
export const MAX_WEAPON_DURABILITY = 300;

/** Resolves config defaultWeapon (+ optional defaultOffhand) to mainhand and offhand. */
export function resolveDefaultWeapons(defaultWeapon: string, defaultOffhand?: string): { mainhand: string; offhand: string } {
  return { mainhand: defaultWeapon, offhand: defaultOffhand ?? 'none' };
}

const defaultPlayingState = (
  defaultMainhand: string,
  defaultOffhand: string,
  chestSlots: (WeaponInstance | null)[],
  playerClass?: PlayerClass
): PlayingStateShape => {
  const loadouts = playerClass != null ? getDefaultLoadoutsForClass(playerClass) : null;
  const set1 = loadouts ? loadouts.set1 : { mainhand: defaultMainhand, offhand: defaultOffhand };
  const set2 = loadouts ? loadouts.set2 : { mainhand: 'none', offhand: 'none' };
  return {
    portal: null,
    portalUseCooldown: 0,
    playerNearPortal: false,
    portalChannelProgress: 0,
    portalChannelAction: null,
    recallChannelProgress: 0,
    recallPortal: null,
    playerNearRecallPortal: false,
    recallPortalChannelProgress: 0,
    board: null,
    boardOpen: false,
    boardUseCooldown: 0,
    playerNearBoard: false,
    playerNearQuestPortal: false,
    questPortalUseCooldown: 0,
    questPortalChannelProgress: 0,
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
    lastHitEnemyId: null,
    playerInGatherableRange: false,
    equippedMainhandKey: set1.mainhand,
    equippedOffhandKey: set1.offhand,
    equippedMainhandDurability: MAX_WEAPON_DURABILITY,
    equippedOffhandDurability: MAX_WEAPON_DURABILITY,
    activeWeaponSet: 0,
    equippedMainhandKey2: set2.mainhand,
    equippedOffhandKey2: set2.offhand,
    equippedMainhandDurability2: MAX_WEAPON_DURABILITY,
    equippedOffhandDurability2: MAX_WEAPON_DURABILITY,
    playerClass: playerClass ?? undefined,
    inventorySlots: (() => {
      const slots = Array(INVENTORY_SLOT_COUNT).fill(null) as InventorySlot[];
      slots[0] = { type: 'gold', count: 10000 };
      return slots;
    })(),
    toolbeltSlots: Array(TOOLBELT_SLOT_COUNT).fill(null) as (PotionConsumable | null)[],
    chestSlots: chestSlots.map((i) => i ? { key: i.key, durability: i.durability, prefixId: i.prefixId, suffixId: i.suffixId } : null),
    equippedArmorHeadKey: 'none',
    equippedArmorChestKey: 'none',
    equippedArmorHandsKey: 'none',
    equippedArmorFeetKey: 'none',
    equippedArmorHeadDurability: MAX_ARMOR_DURABILITY,
    equippedArmorChestDurability: MAX_ARMOR_DURABILITY,
    equippedArmorHandsDurability: MAX_ARMOR_DURABILITY,
    equippedArmorFeetDurability: MAX_ARMOR_DURABILITY,
    hubSelectedLevel: 1,
    hubSelectedQuestIndex: 0,
    questList: [],
    activeQuest: null,
    questGoldMultiplier: 1,
    delveFloor: 0,
    lastEnemyKillX: null,
    lastEnemyKillY: null,
    questCompleteFlairRemaining: 0,
    questCompleteFlairTriggered: false,
    completedQuestIds: [],
    unlockedLevelIds: [1],
    boardTab: 'mainQuest',
    hubSelectedMainQuestIndex: 0,
    screenBeforePause: null,
    portalReturnLevel: null,
    hubReenterLevel: null,
    hubReenterQuest: null,
    hubReenterDelveFloor: 0,
    playerNearReenterPortal: false,
    reenterPortalChannelProgress: 0,
    playerNearCaveEntrance: false,
    caveEntranceRect: null,
    caveEntranceChannelProgress: 0,
    playerNearCaveExit: false,
    caveExitRect: null,
    caveExitChannelProgress: 0,
    strategyCraftingOpen: false,
    unlockedStrategyRecipeIds: getDefaultUnlockedRecipeIds(),
    selectedStrategyRecipeId: null
  };
};

export class PlayingState implements PlayingStateShape {
  portal: PortalState | null = null;
  portalUseCooldown = 0;
  playerNearPortal = false;
  portalChannelProgress = 0;
  portalChannelAction: 'e' | 'b' | null = null;
  recallChannelProgress = 0;
  recallPortal: { x: number; y: number; width: number; height: number; spawned: boolean } | null = null;
  playerNearRecallPortal = false;
  recallPortalChannelProgress = 0;
  board: BoardState | null = null;
  boardOpen = false;
  boardUseCooldown = 0;
  playerNearBoard = false;
  playerNearQuestPortal = false;
  questPortalUseCooldown = 0;
  questPortalChannelProgress = 0;
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
  lastHitEnemyId: string | null = null;
  playerInGatherableRange = false;
  equippedMainhandKey: string;
  equippedOffhandKey: string;
  equippedMainhandDurability = MAX_WEAPON_DURABILITY;
  equippedOffhandDurability = MAX_WEAPON_DURABILITY;
  inventorySlots: InventorySlot[] = (() => {
    const slots = Array(INVENTORY_SLOT_COUNT).fill(null) as InventorySlot[];
    slots[0] = { type: 'gold', count: 10000 };
    return slots;
  })();
  toolbeltSlots: (PotionConsumable | null)[] = Array(TOOLBELT_SLOT_COUNT).fill(null);
  chestSlots: (WeaponInstance | null)[] = getInitialChestWeapons();
  equippedArmorHeadKey = 'none';
  equippedArmorChestKey = 'none';
  equippedArmorHandsKey = 'none';
  equippedArmorFeetKey = 'none';
  equippedArmorHeadDurability = MAX_ARMOR_DURABILITY;
  equippedArmorChestDurability = MAX_ARMOR_DURABILITY;
  equippedArmorHandsDurability = MAX_ARMOR_DURABILITY;
  equippedArmorFeetDurability = MAX_ARMOR_DURABILITY;
  hubSelectedLevel = 1;
  hubSelectedQuestIndex = 0;
  questList: Quest[] = [];
  activeQuest: Quest | null = null;
  questGoldMultiplier = 1;
  delveFloor = 0;
  lastEnemyKillX: number | null = null;
  lastEnemyKillY: number | null = null;
  questCompleteFlairRemaining = 0;
  questCompleteFlairTriggered = false;
  completedQuestIds: string[] = [];
  unlockedLevelIds: number[] = [1];
  boardTab: 'bulletin' | 'mainQuest' = 'mainQuest';
  hubSelectedMainQuestIndex = 0;
  screenBeforePause: 'playing' | 'hub' | null = null;
  questSurviveStartTime?: number;
  savedSanctuaryHealth?: number;
  savedSanctuaryStamina?: number;
  shopExpandedWeapons?: Record<string, boolean>;
  shopExpandedArmor?: Record<string, boolean>;
  shopExpandedCategories?: Record<string, boolean>;
  portalReturnLevel: number | null = null;
  hubReenterLevel: number | null = null;
  hubReenterQuest: Quest | null = null;
  hubReenterDelveFloor = 0;
  playerNearReenterPortal = false;
  reenterPortalChannelProgress = 0;
  playerNearCaveEntrance = false;
  caveEntranceRect: { x: number; y: number; width: number; height: number } | null = null;
  caveEntranceChannelProgress = 0;
  playerNearCaveExit = false;
  caveExitRect: { x: number; y: number; width: number; height: number } | null = null;
  caveExitChannelProgress = 0;
  strategyCraftingOpen = false;
  unlockedStrategyRecipeIds: string[] = getDefaultUnlockedRecipeIds();
  selectedStrategyRecipeId: string | null = null;
  playerClass?: PlayerClass;
  activeWeaponSet: 0 | 1 = 0;
  equippedMainhandKey2 = 'none';
  equippedOffhandKey2 = 'none';
  equippedMainhandDurability2 = MAX_WEAPON_DURABILITY;
  equippedOffhandDurability2 = MAX_WEAPON_DURABILITY;

  constructor(defaultMainhand: string, defaultOffhand: string = 'none') {
    this.equippedMainhandKey = defaultMainhand;
    this.equippedOffhandKey = defaultOffhand;
  }

  reset(defaultMainhand: string = 'none', defaultOffhand: string = 'none', playerClass?: PlayerClass): void {
    Object.assign(this, defaultPlayingState(defaultMainhand, defaultOffhand, getInitialChestWeapons(), playerClass));
    this.chestSlots = getInitialChestWeapons();
  }
}
