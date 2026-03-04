/**
 * SFX layer: subscribes to EventBus and plays Howler sounds.
 * Respects settings.sfxEnabled. Add OGG/MP3 files under public/sounds/ — see docs/sounds.md.
 */
import { Howl } from 'howler';
import type { EventBus } from '../core/EventBus.js';
import { EventTypes } from '../core/EventTypes.js';
import uiMenuButtonClickWav from './ui_sfx/UI_Menu_Button_Click.wav?url';
import weaponSwingWav from './player_sfx/Weapon_Swing_On_Attack.wav?url';
import enemyHitWav from './enemy_sfx/Enemy_Hit.wav?url';
import pickupGoldWav from './item_sfx/Pickup_Gold.wav?url';
import pullPlantWav from './item_sfx/Pull_Plant.wav?url';
import potionCompleteToastWav from './ui_sfx/Potion_Complete_Toast.wav?url';
import stratCraftClickWav from './ui_sfx/Strat_Craft_Click.wav?url';
import evadeWooshWav from './player_sfx/Evade_Woosh.wav?url';
import bushRustleWav from './environment_sfx/Bush_Rustle.wav?url';

const SOUND_BASE = '/sounds/';
let defaultVolume = 0.5;

export interface SoundManagerOptions {
  eventBus: EventBus;
  getSfxEnabled: () => boolean;
  /** Base URL for sound files (default /sounds/). Vite serves public/sounds at /sounds/. */
  basePath?: string;
}

/** Sound IDs used by the game. File names are {id}.ogg or {id}.mp3 in public/sounds/ (or .wav for UI_MENU_BUTTON_CLICK). */
export const SOUND_IDS = {
  HIT: 'hit',
  KILL: 'kill',
  PLAYER_HURT: 'player_hurt',
  DASH: 'dash',
  INVENTORY_OPEN: 'inventory_open',
  BLOCK: 'block',
  UI_MENU_BUTTON_CLICK: 'UI_Menu_Button_Click',
  WEAPON_SWING: 'Weapon_Swing_On_Attack',
  ENEMY_HIT: 'Enemy_Hit',
  PICKUP_GOLD: 'Pickup_Gold',
  PULL_PLANT: 'Pull_Plant',
  POTION_COMPLETE_TOAST: 'Potion_Complete_Toast',
  STRAT_CRAFT_CLICK: 'Strat_Craft_Click',
  EVADE_WOOSH: 'Evade_Woosh',
  BUSH_RUSTLE: 'Bush_Rustle',
} as const;

export type SoundId = (typeof SOUND_IDS)[keyof typeof SOUND_IDS];

export class SoundManager {
  private eventBus: EventBus;
  private getSfxEnabled: () => boolean;
  private basePath: string;
  private howls: Partial<Record<SoundId | string, Howl>> = {};

  constructor(options: SoundManagerOptions) {
    this.eventBus = options.eventBus;
    this.getSfxEnabled = options.getSfxEnabled;
    this.basePath = options.basePath ?? SOUND_BASE;
    this.subscribe();
  }

  private subscribe(): void {
    this.eventBus.onTyped(EventTypes.PLAYER_HIT_ENEMY, (payload) => {
      if (!payload.killed) this.play(SOUND_IDS.ENEMY_HIT);
    });
    this.eventBus.onTyped(EventTypes.PLAYER_KILLED_ENEMY, () => {
      this.play(SOUND_IDS.KILL);
    });
    this.eventBus.onTyped(EventTypes.DAMAGE_TAKEN, (data) => {
      if (data.isPlayerDamage) {
        this.play(data.isBlocked ? SOUND_IDS.BLOCK : SOUND_IDS.PLAYER_HURT);
      }
    });
    this.eventBus.on(EventTypes.PLAYER_DASH_ATTACK, () => {
      this.play(SOUND_IDS.DASH);
    });
    this.eventBus.on(EventTypes.PLAYER_DODGE, () => {
      this.play(SOUND_IDS.EVADE_WOOSH, 0.4);
    });
    this.eventBus.on(EventTypes.PLAYER_MELEE_SWING, () => {
      this.play(SOUND_IDS.WEAPON_SWING, 1.0);
    });
    this.eventBus.onTyped(EventTypes.INPUT_KEYDOWN, (key) => {
      if (key === 'tab') this.play(SOUND_IDS.INVENTORY_OPEN);
    });
    this.eventBus.on(EventTypes.UI_BUTTON_CLICK, () => {
      this.play(SOUND_IDS.UI_MENU_BUTTON_CLICK, 0.2);
    });
    this.eventBus.on(EventTypes.GOLD_PICKED_UP, () => {
      this.play(SOUND_IDS.PICKUP_GOLD, 0.2);
    });
    this.eventBus.on(EventTypes.HERB_MUSHROOM_GATHERED, () => {
      this.play(SOUND_IDS.PULL_PLANT);
    });
    this.eventBus.on(EventTypes.BUSH_DESTROYED, () => {
      this.play(SOUND_IDS.BUSH_RUSTLE, 0.20);
    });
  }

  /**
   * Play a sound by id. File is loaded on first use from public/sounds/{id}.ogg (and .mp3 fallback if you add it).
   * If the file is missing, Howler may log a 404; add the file to public/sounds/ to fix.
   */
  play(soundId: SoundId | string, volume = defaultVolume): void {
    if (!this.getSfxEnabled()) return;
    const howl = this.getOrCreate(soundId, volume);
    howl.volume(volume);
    howl.play();
  }

  /**
   * Get or create a Howl for the given sound id. Caches by id.
   * Uses .ogg first; add .mp3 to the src array for fallback if needed.
   */
  getOrCreate(soundId: string, volume = defaultVolume): Howl {
    let howl = this.howls[soundId];
    if (howl) return howl;
    const src = soundId === SOUND_IDS.UI_MENU_BUTTON_CLICK
      ? [uiMenuButtonClickWav]
      : soundId === SOUND_IDS.WEAPON_SWING
        ? [weaponSwingWav]
        : soundId === SOUND_IDS.ENEMY_HIT
          ? [enemyHitWav]
          : soundId === SOUND_IDS.PICKUP_GOLD
            ? [pickupGoldWav]
            : soundId === SOUND_IDS.PULL_PLANT
              ? [pullPlantWav]
              : soundId === SOUND_IDS.POTION_COMPLETE_TOAST
                ? [potionCompleteToastWav]
                : soundId === SOUND_IDS.STRAT_CRAFT_CLICK
                  ? [stratCraftClickWav]
                  : soundId === SOUND_IDS.EVADE_WOOSH
                    ? [evadeWooshWav]
                    : soundId === SOUND_IDS.BUSH_RUSTLE
                      ? [bushRustleWav]
                      : [`${this.basePath}${soundId}.ogg`, `${this.basePath}${soundId}.mp3`];
    howl = new Howl({ src, volume, html5: false });
    this.howls[soundId] = howl;
    return howl;
  }

  /** Preload one or more sounds so they play without delay on first trigger. */
  preload(...soundIds: (SoundId | string)[]): void {
    soundIds.forEach((id) => this.getOrCreate(id));
  }

  /** Set global SFX volume (0–1) for future play()/getOrCreate() calls. */
  setDefaultVolume(volume: number): void {
    defaultVolume = Math.max(0, Math.min(1, volume));
  }
}
