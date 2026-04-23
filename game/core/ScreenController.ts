/**
 * Handles screen-driven input: canvas click (title/hub/death/pause/settings) and global keys (Tab, Escape, Space, Enter).
 */
import { EventTypes } from './EventTypes.js';
import { getTotalGoldFromInventory, tryConsumeGold } from '../state/InventoryActions.js';
import { getRandomQuestsForBoard, difficulties } from '../config/questConfig.js';
import { STATIC_QUESTS } from '../config/staticQuests.js';
import type { ScreenName } from './ScreenManager.js';
import type { SettingsLike } from './ScreenManager.js';
import type { Quest } from '../types/quest.js';
import type { PlayingStateShape } from '../state/PlayingState.js';

export interface ScreenControllerContext {
    screenManager: {
        isScreen(screen: ScreenName): boolean;
        checkButtonClick(x: number, y: number, screen: string): boolean;
        selectedStartLevel: number;
        setScreen(screen: ScreenName): void;
        getTitleButtonAt(x: number, y: number): 'newGame' | 'loadGame' | null;
        getLevelSelectAt(x: number, y: number): number | null;
        getQuestSelectAt(x: number, y: number, questList: Quest[], levelNames: Record<number, string>, contentTop?: number): number | null;
        getHubBoardButtonAt(x: number, y: number, questCount?: number, contentTop?: number): 'start' | 'reroll' | 'back' | null;
        getBoardTabAt(x: number, y: number): 'bulletin' | 'mainQuest' | null;
        getTabbedBoardFrame(): { contentTop: number; contentHeight: number };
        getMainQuestSelectAt(x: number, y: number, unlockedLevelIds: number[], contentTop?: number, contentHeight?: number): number | null;
        getMainQuestButtonAt(x: number, y: number, unlockedLevelIds: number[], contentTop?: number, contentHeight?: number): 'accept' | 'back' | null;
        getPauseButtonAt(x: number, y: number): string | null;
        getClassSelectButtonAt(x: number, y: number): 'back' | 'warrior' | 'mage' | 'rogue' | null;
        getSaveSelectButtonAt(x: number, y: number): 'back' | string | null;
        getHelpBackButtonAt(x: number, y: number): boolean;
        getSettingsItemAt(x: number, y: number, settings: SettingsLike): string | null;
        getControlsItemAt(x: number, y: number): string | null;
    };
    playingState: PlayingStateShape;
    config?: { levels?: Record<number, { name?: string }> };
    entities: { get(id: string): { getComponent(c: unknown): unknown } | undefined };
    settings: SettingsLike;
    setInventoryPanelVisible(visible: boolean): void;
    refreshInventoryPanel(): void;
    useWhetstone?(): void;
    startGame(): void;
    startNewGame(selectedClass: 'warrior' | 'mage' | 'rogue'): void;
    loadGame(slotId: string): void;
    returnToSanctuaryOnDeath(): void;
    saveGame(slotId: string): void;
    deleteSave(slotId: string): void;
    quitToMainMenu(): void;
    clearPlayerInputsForMenu(): void;
}

export class ScreenController {
    private context: ScreenControllerContext;

    constructor(context: ScreenControllerContext) {
        this.context = context;
    }

    handleCanvasClick(x: number, y: number): boolean {
        const ctx = this.context;
        const sm = ctx.screenManager;
        const ps = ctx.playingState;
        let handled = false;
        if (sm.isScreen('title')) {
            const titleBtn = sm.getTitleButtonAt(x, y);
            if (titleBtn === 'newGame') { sm.setScreen('classSelect'); handled = true; }
            else if (titleBtn === 'loadGame') { sm.setScreen('saveSelect'); handled = true; }
        } else if (sm.isScreen('classSelect')) {
            const classBtn = sm.getClassSelectButtonAt(x, y);
            if (classBtn === 'back') { sm.setScreen('title'); handled = true; }
            else if (classBtn === 'warrior' || classBtn === 'mage' || classBtn === 'rogue') {
                sm.selectedStartLevel = 0;
                ctx.startNewGame(classBtn);
                handled = true;
            }
        } else if (sm.isScreen('saveSelect')) {
            const saveBtn = sm.getSaveSelectButtonAt(x, y);
            if (saveBtn === 'back') { sm.setScreen('title'); handled = true; }
            else if (saveBtn?.startsWith('delete-')) { ctx.deleteSave(saveBtn.slice(7)); handled = true; }
            else if (saveBtn && saveBtn !== 'back') { ctx.loadGame(saveBtn); handled = true; }
        } else if (sm.isScreen('hub') && ps.boardOpen) {
            const t = sm.getTabbedBoardFrame();
            const tab = sm.getBoardTabAt(x, y);
            if (tab !== null) {
                ps.boardTab = tab;
                return true;
            }
            const levelNames: Record<number, string> = ctx.config?.levels
                ? Object.fromEntries(
                    Object.entries(ctx.config.levels).map(([k, v]) => [
                        Number(k),
                        (v as { name?: string }).name ?? 'Level ' + k
                    ])
                ) : {};
            if (ps.boardTab === 'bulletin') {
                const questIndex = ps.questList.length > 0 ? sm.getQuestSelectAt(x, y, ps.questList, levelNames, t.contentTop) : null;
                if (questIndex !== null) {
                    ps.hubSelectedQuestIndex = questIndex;
                    ps.hubSelectedLevel = ps.questList[questIndex].level;
                    handled = true;
                } else {
                    const btn = sm.getHubBoardButtonAt(x, y, ps.questList.length, t.contentTop);
                    if (btn === 'start' && ps.questList.length > 0) {
                        const quest = ps.questList[ps.hubSelectedQuestIndex];
                        if (quest) {
                            ps.activeQuest = quest;
                            ps.questGoldMultiplier = quest.difficulty?.goldMultiplier ?? 1;
                            sm.selectedStartLevel = quest.level;
                        }
                        ps.boardOpen = false;
                        handled = true;
                    } else if (btn === 'reroll') {
                        const REROLL_COST = 200;
                        if (getTotalGoldFromInventory(ps) >= REROLL_COST && tryConsumeGold(ps, REROLL_COST)) {
                            ps.questList = getRandomQuestsForBoard(3);
                            ps.hubSelectedQuestIndex = 0;
                            if (ps.questList.length > 0) ps.hubSelectedLevel = ps.questList[0].level;
                        }
                        handled = true;
                    } else if (btn === 'back') {
                        ps.boardOpen = false;
                        handled = true;
                    }
                }
            } else {
                const unlocked = ps.unlockedLevelIds ?? [1];
                const rowIndex = sm.getMainQuestSelectAt(x, y, unlocked, t.contentTop, t.contentHeight);
                if (rowIndex !== null) {
                    ps.hubSelectedMainQuestIndex = rowIndex;
                    handled = true;
                } else {
                    const btn = sm.getMainQuestButtonAt(x, y, unlocked, t.contentTop, t.contentHeight);
                    if (btn === 'accept') {
                        const quests = STATIC_QUESTS.filter((q) => unlocked.includes(q.level)).sort((a, b) => a.level - b.level || (a.order ?? 0) - (b.order ?? 0));
                        const selected = quests[ps.hubSelectedMainQuestIndex];
                        if (selected) {
                            const difficulty = difficulties[selected.difficultyId ?? 'normal'];
                            ps.activeQuest = {
                                ...selected,
                                difficultyId: selected.difficultyId ?? 'normal',
                                difficulty,
                                questType: 'standard',
                            };
                            ps.questGoldMultiplier = difficulty?.goldMultiplier ?? 1;
                            sm.selectedStartLevel = selected.level;
                            ps.boardOpen = false;
                        }
                        handled = true;
                    } else if (btn === 'back') {
                        ps.boardOpen = false;
                        handled = true;
                    }
                }
            }
        } else if (sm.isScreen('death')) {
            if (sm.checkButtonClick(x, y, 'death')) {
                ctx.returnToSanctuaryOnDeath();
                handled = true;
            }
        } else if (sm.isScreen('pause')) {
            const pauseBtn = sm.getPauseButtonAt(x, y);
            if (pauseBtn === 'resume') { sm.setScreen(ps.screenBeforePause || 'playing'); handled = true; }
            else if (pauseBtn === 'save') { ctx.saveGame('1'); handled = true; }
            else if (pauseBtn === 'quit') { ctx.quitToMainMenu(); handled = true; }
            else if (pauseBtn === 'settings') { sm.setScreen('settings'); handled = true; }
            else if (pauseBtn === 'help') { sm.setScreen('help'); handled = true; }
        } else if (sm.isScreen('help')) {
            if (sm.getHelpBackButtonAt(x, y)) {
                sm.setScreen('pause');
                handled = true;
            }
        } else if (sm.isScreen('settings')) {
            const item = sm.getSettingsItemAt(x, y, ctx.settings);
            if (item === 'music') { ctx.settings.musicEnabled = !ctx.settings.musicEnabled; handled = true; }
            else if (item === 'sfx') { ctx.settings.sfxEnabled = !ctx.settings.sfxEnabled; handled = true; }
            else if (item === 'minimap') { ctx.settings.showMinimap = !ctx.settings.showMinimap; handled = true; }
            else if (item === 'characterSprites') { ctx.settings.useCharacterSprites = !ctx.settings.useCharacterSprites; handled = true; }
            else if (item === 'environmentSprites') { ctx.settings.useEnvironmentSprites = !ctx.settings.useEnvironmentSprites; handled = true; }
            else if (item === 'playerHitboxIndicators') { ctx.settings.showPlayerHitboxIndicators = !ctx.settings.showPlayerHitboxIndicators; handled = true; }
            else if (item === 'enemyHitboxIndicators') { ctx.settings.showEnemyHitboxIndicators = !ctx.settings.showEnemyHitboxIndicators; handled = true; }
            else if (item === 'enemyStaminaBars') { ctx.settings.showEnemyStaminaBars = !ctx.settings.showEnemyStaminaBars; handled = true; }
            else if (item === 'playerHealthBarAlways') { ctx.settings.showPlayerHealthBarAlways = !ctx.settings.showPlayerHealthBarAlways; handled = true; }
            else if (item === 'enemyHealthBars') { ctx.settings.showEnemyHealthBars = !ctx.settings.showEnemyHealthBars; handled = true; }
            else if (item === 'controls') { sm.setScreen('settings-controls'); handled = true; }
            else if (item === 'back') { sm.setScreen('pause'); handled = true; }
        } else if (sm.isScreen('settings-controls')) {
            const item = sm.getControlsItemAt(x, y);
            if (item === 'back') {
                sm.setScreen('settings');
                handled = true;
            }
        }
        return handled;
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
                    ctx.setInventoryPanelVisible(ps.inventoryOpen);
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
