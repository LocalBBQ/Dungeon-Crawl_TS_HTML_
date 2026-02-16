/**
 * Handles screen-driven input: canvas click (title/hub/death/pause/settings) and global keys (Tab, Escape, Space, Enter).
 */
import { EventTypes } from './EventTypes.js';
import { Combat } from '../components/Combat.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import type { ScreenName } from './ScreenManager.js';
import type { SettingsLike } from './ScreenManager.js';

export interface ScreenControllerContext {
    screenManager: {
        isScreen(screen: ScreenName): boolean;
        checkButtonClick(x: number, y: number, screen: string): boolean;
        selectedStartLevel: number;
        setScreen(screen: ScreenName): void;
        getWeaponChestWeaponAt(x: number, y: number): string | null;
        getWeaponChestBackAt(x: number, y: number): boolean;
        getLevelSelectAt(x: number, y: number): number | null;
        getHubBoardButtonAt(x: number, y: number): string | null;
        getPauseButtonAt(x: number, y: number): string | null;
        getHelpBackButtonAt(x: number, y: number): boolean;
        getSettingsItemAt(x: number, y: number, settings: SettingsLike): string | null;
        getControlsItemAt(x: number, y: number): string | null;
    };
    playingState: {
        inventoryOpen: boolean;
        chestOpen: boolean;
        boardOpen: boolean;
        equippedWeaponKey: string;
        hubSelectedLevel: number;
        chestUseCooldown: number;
        boardUseCooldown: number;
        screenBeforePause: 'playing' | 'hub' | null;
    };
    entities: { get(id: string): { getComponent(c: unknown): unknown } | undefined };
    settings: SettingsLike;
    setInventoryPanelVisible(visible: boolean): void;
    refreshInventoryPanel(): void;
    startGame(): void;
    returnToSanctuaryOnDeath(): void;
    quitToMainMenu(): void;
}

export class ScreenController {
    private context: ScreenControllerContext;

    constructor(context: ScreenControllerContext) {
        this.context = context;
    }

    handleCanvasClick(x: number, y: number) {
        const ctx = this.context;
        const sm = ctx.screenManager;
        const ps = ctx.playingState;

        if (sm.isScreen('title')) {
            if (sm.checkButtonClick(x, y, 'title')) {
                sm.selectedStartLevel = 0;
                ctx.startGame();
            }
        } else if (sm.isScreen('hub') && ps.chestOpen) {
            const weaponKey = sm.getWeaponChestWeaponAt(x, y);
            if (weaponKey !== null) {
                ps.equippedWeaponKey = weaponKey;
                const player = ctx.entities.get('player');
                if (player && Weapons[weaponKey]) {
                    const combat = player.getComponent(Combat) as Combat | null;
                    if (combat && combat.isPlayer) {
                        combat.stopBlocking();
                        combat.setWeapon(Weapons[weaponKey]);
                    }
                }
            } else if (sm.getWeaponChestBackAt(x, y)) {
                ps.chestOpen = false;
                ps.chestUseCooldown = 0;
            }
        } else if (sm.isScreen('hub') && ps.boardOpen) {
            const levelAt = sm.getLevelSelectAt(x, y);
            if (levelAt !== null) {
                ps.hubSelectedLevel = levelAt;
            } else {
                const btn = sm.getHubBoardButtonAt(x, y);
                if (btn === 'start') {
                    ps.boardOpen = false;
                    sm.selectedStartLevel = ps.hubSelectedLevel;
                    ctx.startGame();
                } else if (btn === 'back') {
                    ps.boardOpen = false;
                }
            }
        } else if (sm.isScreen('death')) {
            if (sm.checkButtonClick(x, y, 'death')) {
                ctx.returnToSanctuaryOnDeath();
            }
        } else if (sm.isScreen('pause')) {
            const pauseBtn = sm.getPauseButtonAt(x, y);
            if (pauseBtn === 'resume') {
                sm.setScreen(ps.screenBeforePause || 'playing');
            } else if (pauseBtn === 'quit') {
                ctx.quitToMainMenu();
            } else if (pauseBtn === 'settings') {
                sm.setScreen('settings');
            } else if (pauseBtn === 'help') {
                sm.setScreen('help');
            }
        } else if (sm.isScreen('help')) {
            if (sm.getHelpBackButtonAt(x, y)) {
                sm.setScreen('pause');
            }
        } else if (sm.isScreen('settings')) {
            const item = sm.getSettingsItemAt(x, y, ctx.settings);
            if (item === 'music') {
                ctx.settings.musicEnabled = !ctx.settings.musicEnabled;
            } else if (item === 'sfx') {
                ctx.settings.sfxEnabled = !ctx.settings.sfxEnabled;
            } else if (item === 'minimap') {
                ctx.settings.showMinimap = !ctx.settings.showMinimap;
            } else if (item === 'characterSprites') {
                ctx.settings.useCharacterSprites = !ctx.settings.useCharacterSprites;
            } else if (item === 'environmentSprites') {
                ctx.settings.useEnvironmentSprites = !ctx.settings.useEnvironmentSprites;
            } else if (item === 'playerHitboxIndicators') {
                ctx.settings.showPlayerHitboxIndicators = !ctx.settings.showPlayerHitboxIndicators;
            } else if (item === 'enemyHitboxIndicators') {
                ctx.settings.showEnemyHitboxIndicators = !ctx.settings.showEnemyHitboxIndicators;
            } else if (item === 'enemyStaminaBars') {
                ctx.settings.showEnemyStaminaBars = !ctx.settings.showEnemyStaminaBars;
            } else if (item === 'playerHealthBarAlways') {
                ctx.settings.showPlayerHealthBarAlways = !ctx.settings.showPlayerHealthBarAlways;
            } else if (item === 'enemyHealthBars') {
                ctx.settings.showEnemyHealthBars = !ctx.settings.showEnemyHealthBars;
            } else if (item === 'controls') {
                sm.setScreen('settings-controls');
            } else if (item === 'back') {
                sm.setScreen('pause');
            }
        } else if (sm.isScreen('settings-controls')) {
            const item = sm.getControlsItemAt(x, y);
            if (item === 'back') {
                sm.setScreen('settings');
            }
        }
    }

    bindGlobalKeys(eventBus: { on(event: string, fn: (key: string) => void): void }) {
        const ctx = this.context;
        const sm = ctx.screenManager;
        const ps = ctx.playingState;

        eventBus.on(EventTypes.INPUT_KEYDOWN, (key: string) => {
            const isStartKey = key === ' ' || key === 'enter';
            const isEscapeKey = key === 'escape' || key === 'esc';

            if (key === 'tab') {
                if (sm.isScreen('playing') || sm.isScreen('hub')) {
                    ps.inventoryOpen = !ps.inventoryOpen;
                    ctx.setInventoryPanelVisible(ps.inventoryOpen);
                    if (ps.inventoryOpen) ctx.refreshInventoryPanel();
                }
                return;
            }

            if (isStartKey) {
                if (sm.isScreen('title')) {
                    sm.selectedStartLevel = 0;
                    ctx.startGame();
                } else if (sm.isScreen('death')) {
                    ctx.returnToSanctuaryOnDeath();
                } else if (sm.isScreen('hub') && ps.boardOpen) {
                    ps.boardOpen = false;
                    sm.selectedStartLevel = ps.hubSelectedLevel;
                    ctx.startGame();
                }
            } else if (isEscapeKey) {
                if (ps.inventoryOpen) {
                    ps.inventoryOpen = false;
                    ctx.setInventoryPanelVisible(false);
                    return;
                }
                if (sm.isScreen('playing')) {
                    ps.screenBeforePause = 'playing';
                    sm.setScreen('pause');
                } else if (sm.isScreen('pause')) {
                    sm.setScreen(ps.screenBeforePause || 'playing');
                } else if (sm.isScreen('settings')) {
                    sm.setScreen('pause');
                } else if (sm.isScreen('settings-controls')) {
                    sm.setScreen('settings');
                } else if (sm.isScreen('help')) {
                    sm.setScreen('pause');
                } else if (sm.isScreen('hub')) {
                    if (ps.chestOpen) {
                        ps.chestOpen = false;
                        ps.chestUseCooldown = 0;
                    } else if (ps.boardOpen) {
                        ps.boardOpen = false;
                    } else {
                        ps.screenBeforePause = 'hub';
                        sm.setScreen('pause');
                    }
                }
            }
        });
    }
}
