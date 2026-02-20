/**
 * Handles screen-driven input: canvas click (title/hub/death/pause/settings) and global keys (Tab, Escape, Space, Enter).
 */
import { EventTypes } from './EventTypes.js';
import { getRandomQuestsForBoard } from '../config/questConfig.js';
import type { ScreenName } from './ScreenManager.js';
import type { SettingsLike } from './ScreenManager.js';

export interface ScreenControllerContext {
    screenManager: {
        isScreen(screen: ScreenName): boolean;
        checkButtonClick(x: number, y: number, screen: string): boolean;
        selectedStartLevel: number;
        setScreen(screen: ScreenName): void;
        getLevelSelectAt(x: number, y: number): number | null;
        getQuestSelectAt(x: number, y: number, questList: { level: number; difficultyId: string; difficulty?: { label?: string } }, levelNames: Record<number, string>): number | null;
        getHubBoardButtonAt(x: number, y: number, questCount?: number): 'start' | 'reroll' | 'back' | null;
        getPauseButtonAt(x: number, y: number): string | null;
        getHelpBackButtonAt(x: number, y: number): boolean;
        getSettingsItemAt(x: number, y: number, settings: SettingsLike): string | null;
        getControlsItemAt(x: number, y: number): string | null;
    };
    playingState: {
        inventoryOpen: boolean;
        chestOpen: boolean;
        boardOpen: boolean;
        shopOpen: boolean;
        rerollStationOpen?: boolean;
        equippedMainhandKey: string;
        equippedOffhandKey: string;
        hubSelectedLevel: number;
        hubSelectedQuestIndex: number;
        questList: { level: number; difficultyId: string; difficulty?: { goldMultiplier?: number; label?: string } }[];
        activeQuest: { level: number; difficulty?: { goldMultiplier?: number } } | null;
        questGoldMultiplier: number;
        chestUseCooldown: number;
        boardUseCooldown: number;
        shopUseCooldown: number;
        screenBeforePause: 'playing' | 'hub' | null;
    };
    config?: { levels?: Record<number, { name?: string }> };
    entities: { get(id: string): { getComponent(c: unknown): unknown } | undefined };
    settings: SettingsLike;
    setInventoryPanelVisible(visible: boolean): void;
    refreshInventoryPanel(): void;
    useWhetstone?(): void;
    startGame(): void;
    returnToSanctuaryOnDeath(): void;
    quitToMainMenu(): void;
    clearPlayerInputsForMenu(): void;
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
        } else if (sm.isScreen('hub') && ps.boardOpen) {
            const levelNames: Record<number, string> = ctx.config?.levels
                ? Object.fromEntries(
                    Object.entries(ctx.config.levels).map(([k, v]) => [
                        Number(k),
                        (v as { name?: string }).name ?? 'Level ' + k
                    ])
                ) : {};
            const questIndex = ps.questList.length > 0 ? sm.getQuestSelectAt(x, y, ps.questList, levelNames) : null;
            if (questIndex !== null) {
                ps.hubSelectedQuestIndex = questIndex;
                ps.hubSelectedLevel = ps.questList[questIndex].level;
            } else {
                const btn = sm.getHubBoardButtonAt(x, y, ps.questList.length);
                if (btn === 'start' && ps.questList.length > 0) {
                    const quest = ps.questList[ps.hubSelectedQuestIndex];
                    if (quest) {
                        ps.activeQuest = quest;
                        ps.questGoldMultiplier = quest.difficulty?.goldMultiplier ?? 1;
                        sm.selectedStartLevel = quest.level;
                    }
                    ps.boardOpen = false;
                    // Stay in hub; a quest portal will spawn for the player to enter
                } else if (btn === 'reroll') {
                    const REROLL_COST = 200;
                    const currentGold = ps.gold ?? 0;
                    if (currentGold >= REROLL_COST) {
                        ps.gold = currentGold - REROLL_COST;
                        ps.questList = getRandomQuestsForBoard(3);
                        ps.hubSelectedQuestIndex = 0;
                        if (ps.questList.length > 0) ps.hubSelectedLevel = ps.questList[0].level;
                    }
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
                    if (ps.inventoryOpen) ctx.clearPlayerInputsForMenu();
                    ctx.setInventoryPanelVisible(false);
                }
                return;
            }
            // Whetstone: use by dragging onto weapon in inventory (no keybind)

            if (isStartKey) {
                if (sm.isScreen('title')) {
                    sm.selectedStartLevel = 0;
                    ctx.startGame();
                } else if (sm.isScreen('death')) {
                    ctx.returnToSanctuaryOnDeath();
                }
            } else if (isEscapeKey) {
                // Enchantment (reroll) screen: Escape closes the overlay only, does not pause
                if (ps.rerollStationOpen) {
                    ps.rerollStationOpen = false;
                    return;
                }
                if (ps.inventoryOpen) {
                    ps.inventoryOpen = false;
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
                    if (ps.shopOpen) {
                        ps.shopOpen = false;
                        ps.shopUseCooldown = 0.4;
                    } else if (ps.chestOpen) {
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
