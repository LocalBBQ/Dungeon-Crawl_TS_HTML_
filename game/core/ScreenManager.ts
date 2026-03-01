// Screen Manager - handles game state and screen rendering
import { listSaveSlots } from './SaveManager.js';
import { GameConfig } from '../config/GameConfig.js';
import { getQuestDescription } from '../config/questConfig.js';
import { STATIC_QUESTS } from '../config/staticQuests.js';
import type { Quest } from '../types/quest.js';
import {
    drawMenuButton as drawMenuButtonUtil,
    drawSmallButton as drawSmallButtonUtil,
    drawTitleBrazier as drawTitleBrazierUtil
} from '../ui/menu/MenuDrawUtils.js';
import { getMenuRenderer, isMenuScreen } from '../ui/menu/MenuScreenRegistry.js';
import { registerAllMenuScreens } from '../ui/menu/registerMenuScreens.js';

registerAllMenuScreens();

export type ScreenName = 'title' | 'classSelect' | 'saveSelect' | 'hub' | 'playing' | 'death' | 'pause' | 'settings' | 'settings-controls' | 'help';

export interface SettingsLike {
  musicEnabled?: boolean;
  sfxEnabled?: boolean;
  showMinimap?: boolean;
  useCharacterSprites?: boolean;
  useEnvironmentSprites?: boolean;
  showPlayerHitboxIndicators?: boolean;
  showEnemyHitboxIndicators?: boolean;
  showEnemyStaminaBars?: boolean;
  showPlayerHealthBarAlways?: boolean;
  showEnemyHealthBars?: boolean;
}

const MENU_SCREENS: ScreenName[] = ['title', 'classSelect', 'saveSelect', 'death', 'pause', 'settings', 'settings-controls', 'help'];

export class ScreenManager {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    currentScreen: ScreenName;
    selectedStartLevel: number;
    onEnterMenuScreen?: () => void;

    constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, onEnterMenuScreen?: () => void) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.currentScreen = 'title';
        this.selectedStartLevel = 1;
        this.onEnterMenuScreen = onEnterMenuScreen;
    }

    /** When the user has mousedown on a menu button (for press animation). Cleared on mouseup/leave. */
    private _pressedButton: { screen: ScreenName; button: string } | null = null;

    setScreen(screen: ScreenName): void {
        this.currentScreen = screen;
        if (MENU_SCREENS.includes(screen) && this.onEnterMenuScreen) {
            this.onEnterMenuScreen();
        }
    }

    setPressedButton(p: { screen: ScreenName; button: string } | null): void {
        this._pressedButton = p;
    }

    isButtonPressed(screen: ScreenName, button: string): boolean {
        return this._pressedButton?.screen === screen && this._pressedButton?.button === button;
    }

    /** Returns which menu button is at (x,y) for the current screen (for press feedback). settings required for 'settings' screen. */
    getPressedButtonAt(x: number, y: number, settings?: SettingsLike): { screen: ScreenName; button: string } | null {
        const s = this.currentScreen;
        if (isMenuScreen(s)) {
            const renderer = getMenuRenderer(s);
            const button = renderer?.getButtonAt(x, y, {
                settings,
                listSaveSlots,
                currentScreen: s,
                isButtonPressed: this.isButtonPressed.bind(this),
                canvas: this.canvas
            }) ?? null;
            return button ? { screen: s, button } : null;
        }
        return null;
    }

    isScreen(screen: ScreenName): boolean {
        return this.currentScreen === screen;
    }

    /** Draw a menu button with optional press offset/depth (2px down, darker fill when pressed). */
    private drawMenuButton(centerX: number, centerY: number, width: number, height: number, label: string, pressed: boolean, options?: { dim?: boolean; fontSize?: number }): void {
        drawMenuButtonUtil(this.ctx, centerX, centerY, width, height, label, pressed, options);
    }

    /** Draw a small rect button (e.g. Select, Load, Back) with press depth. */
    private drawSmallButton(centerX: number, centerY: number, width: number, height: number, label: string, pressed: boolean): void {
        drawSmallButtonUtil(this.ctx, centerX, centerY, width, height, label, pressed);
    }

    getLevelSelectBounds(): { cx: number; rowW: number; rowH: number; startY: number; rows: { level: number; y: number; name: string }[] } {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const rowH = 32;
        const rowW = 280;
        const startY = height / 2 - 48;
        return {
            cx, rowW, rowH, startY,
            rows: [
                { level: 1, y: startY, name: 'Village Outskirts' },
                { level: 2, y: startY + rowH, name: 'Cursed Wilds' },
                { level: 3, y: startY + rowH * 2, name: 'Demon Approach' },
                { level: 4, y: startY + rowH * 3, name: 'The Fort' },
                { level: 5, y: startY + rowH * 4, name: 'Elder Woods' },
            ]
        };
    }

    getLevelSelectAt(x: number, y: number): number | null {
        const b = this.getLevelSelectBounds();
        const left = b.cx - b.rowW / 2;
        const right = b.cx + b.rowW / 2;
        for (const row of b.rows) {
            const top = row.y - b.rowH / 2;
            const bottom = row.y + b.rowH / 2;
            if (x >= left && x <= right && y >= top && y <= bottom) return row.level;
        }
        return null;
    }

    /** Tabbed board frame (bulletin + main quest tabs). Use for hit-test and content area. */
    getTabbedBoardFrame(): { frameX: number; frameY: number; frameW: number; frameH: number; tabBarHeight: number; contentTop: number; contentHeight: number } {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2 - 72;
        const framePad = 20;
        const boardH = 420;
        const tabBarHeight = 40;
        const innerH = boardH + framePad * 2 + 24;
        const frameH = innerH + tabBarHeight;
        const boardW = 780;
        const frameW = boardW + framePad * 2;
        const frameX = cx - frameW / 2;
        const frameY = cy - frameH / 2;
        const contentTop = frameY + tabBarHeight;
        return { frameX, frameY, frameW: 780 + framePad * 2, frameH, tabBarHeight, contentTop, contentHeight: innerH };
    }

    getBoardTabAt(x: number, y: number): 'bulletin' | 'mainQuest' | null {
        const t = this.getTabbedBoardFrame();
        const tabTop = t.frameY + 6;
        const tabH = t.tabBarHeight - 12;
        if (y < tabTop || y > tabTop + tabH) return null;
        const mid = t.frameX + t.frameW / 2;
        if (x >= t.frameX && x < mid) return 'mainQuest';
        if (x >= mid && x <= t.frameX + t.frameW) return 'bulletin';
        return null;
    }

    /** Bulletin board: title, then buttons (side by side), then 3 page rects. contentTop optional for tabbed board. */
    getQuestBoardBounds(questList: Quest[], _levelNames: Record<number, string>, contentTop?: number): {
        cx: number;
        cy: number;
        frameY: number;
        boardW: number;
        boardH: number;
        pageW: number;
        pageH: number;
        pageGap: number;
        rows: { index: number; x: number; y: number; w: number; h: number }[];
        buttonY: number;
        acceptX: number;
        rerollX: number;
        backX: number;
        buttonW: number;
        buttonH: number;
        rerollButtonW: number;
    } {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const cy = height / 2 - 72;
        const framePad = 20;
        const boardW = 780;
        const boardH = 420;
        const frameY = contentTop ?? (cy - boardH / 2 - framePad - 24);
        const titleBottom = frameY + 48;
        const buttonH = 40;
        const buttonY = titleBottom + 24 + buttonH / 2;
        const pageTop = buttonY + buttonH / 2 + 24;
        const pageW = 228;
        const pageH = 300;
        const pageGap = 24;
        const step = pageW + pageGap;
        const rows: { index: number; x: number; y: number; w: number; h: number }[] = [];
        for (let i = 0; i < Math.min(3, questList.length); i++) {
            const pageCx = cx + (i - 1) * step;
            rows.push({
                index: i,
                x: pageCx - pageW / 2,
                y: pageTop,
                w: pageW,
                h: pageH,
            });
        }
        const buttonW = 120;
        const rerollButtonW = 140;
        const buttonGap = 16;
        const totalButtonsW = buttonW + buttonGap + rerollButtonW + buttonGap + buttonW;
        const acceptX = cx - totalButtonsW / 2 + buttonW / 2;
        const rerollX = cx;
        const backX = cx + totalButtonsW / 2 - buttonW / 2;
        return { cx, cy, frameY, boardW, boardH, pageW, pageH, pageGap, rows, buttonY, acceptX, rerollX, backX, buttonW, buttonH, rerollButtonW };
    }

    /** Board overlay button hit-test (Accept / Re-roll / Back), side by side. contentTop optional for tabbed board. */
    getHubBoardButtonAt(x: number, y: number, _questCount = 0, contentTop?: number): 'start' | 'reroll' | 'back' | null {
        const height = this.canvas.height;
        const cx = this.canvas.width / 2;
        const buttonW = 120;
        const buttonH = 40;
        const rerollButtonW = 140;
        const buttonGap = 16;
        const cy = height / 2 - 72;
        const framePad = 20;
        const boardH = 420;
        const frameY = contentTop ?? (cy - boardH / 2 - framePad - 24);
        const buttonY = frameY + 48 + 24 + buttonH / 2;
        const totalButtonsW = buttonW + buttonGap + rerollButtonW + buttonGap + buttonW;
        const acceptX = cx - totalButtonsW / 2 + buttonW / 2;
        const rerollX = cx;
        const backX = cx + totalButtonsW / 2 - buttonW / 2;
        const top = buttonY - buttonH / 2;
        const bottom = buttonY + buttonH / 2;
        if (y >= top && y <= bottom) {
            if (x >= acceptX - buttonW / 2 && x <= acceptX + buttonW / 2) return 'start';
            if (x >= rerollX - rerollButtonW / 2 && x <= rerollX + rerollButtonW / 2) return 'reroll';
            if (x >= backX - buttonW / 2 && x <= backX + buttonW / 2) return 'back';
        }
        return null;
    }

    getQuestSelectAt(x: number, y: number, questList: Quest[], levelNames: Record<number, string>, contentTop?: number): number | null {
        if (!questList.length) return null;
        const b = this.getQuestBoardBounds(questList, levelNames, contentTop);
        for (const row of b.rows) {
            if (x >= row.x && x <= row.x + row.w && y >= row.y && y <= row.y + row.h) return row.index;
        }
        return null;
    }

    getWeaponSelectBounds() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const rowH = 28;
        const rowW = 260;
        const startY = height / 2 + 52;
        return {
            cx, rowW, rowH, startY,
            rows: [
                { key: 'sword_rusty', label: 'Rusty Sword', y: startY },
                { key: 'dagger_rusty', label: 'Rusty Dagger', y: startY + rowH },
                { key: 'greatsword_rusty', label: 'Rusty Greatsword', y: startY + rowH * 2 },
                { key: 'crossbow_rusty', label: 'Rusty Crossbow', y: startY + rowH * 3 },
                { key: 'mace_rusty', label: 'Rusty Mace', y: startY + rowH * 4 }
            ]
        };
    }

    getWeaponSelectAt(x, y) {
        const b = this.getWeaponSelectBounds();
        const left = b.cx - b.rowW / 2;
        const right = b.cx + b.rowW / 2;
        for (const row of b.rows) {
            const top = row.y - b.rowH / 2;
            const bottom = row.y + b.rowH / 2;
            if (x >= left && x <= right && y >= top && y <= bottom) return row.key;
        }
        return null;
    }

    /** Draw a stone brazier (used by hub/board overlays). */
    private drawTitleBrazier(centerX: number, centerY: number, w: number, h: number): void {
        drawTitleBrazierUtil(this.ctx, centerX, centerY, w, h);
    }

    getTitleButtonAt(x: number, y: number): 'newGame' | 'loadGame' | null {
        const b = getMenuRenderer('title')?.getButtonAt(x, y, { canvas: this.canvas });
        return (b === 'newGame' || b === 'loadGame') ? b : null;
    }

    getClassSelectButtonAt(x: number, y: number): 'back' | 'warrior' | 'mage' | 'rogue' | null {
        const b = getMenuRenderer('classSelect')?.getButtonAt(x, y, { canvas: this.canvas });
        return (b === 'back' || b === 'warrior' || b === 'mage' || b === 'rogue') ? b : null;
    }

    getSaveSelectButtonAt(x: number, y: number): 'back' | string | null {
        const b = getMenuRenderer('saveSelect')?.getButtonAt(x, y, { listSaveSlots, canvas: this.canvas });
        return b ?? null;
    }

    getPauseButtonAt(x: number, y: number): string | null {
        return getMenuRenderer('pause')?.getButtonAt(x, y, { canvas: this.canvas }) ?? null;
    }

    /** Draw a small info tile at top center when hovering an enemy: name, health bar, modifier (only if present), short description. */
    renderEnemyTooltip(displayName, modifierName, modifierDescription, healthPercent) {
        const width = this.canvas.width;
        const padding = 16;
        const lineHeight = 20;
        const maxTextWidth = 280;
        const barHeight = 6;
        const barGap = 8;
        const modifierTopGap = 6;

        const hasModifier = modifierName && typeof modifierName === 'string' && modifierName.trim().length > 0;
        const modifierLabel = hasModifier ? (modifierName.charAt(0).toUpperCase() + modifierName.slice(1)) : '';
        const lines = [displayName];
        if (modifierLabel) lines.push(modifierLabel);
        if (hasModifier && modifierDescription) lines.push(modifierDescription);

        this.ctx.font = '500 14px Cinzel, Georgia, serif';
        const measure = (t) => this.ctx.measureText(t).width;
        const tileWidth = Math.min(maxTextWidth, Math.max(...lines.map((t) => measure(t))) + padding * 2);
        const hasBar = typeof healthPercent === 'number' && healthPercent >= 0;
        const barArea = hasBar ? barHeight + barGap : 0;
        const modifierGapArea = (hasModifier && (modifierLabel || modifierDescription)) ? modifierTopGap : 0;
        const tileHeight = padding * 2 + lines.length * lineHeight + barArea + modifierGapArea;

        const cx = width / 2;
        const top = 12;
        const left = cx - tileWidth / 2;
        const topPad = 10;

        this.ctx.fillStyle = 'rgba(26, 16, 8, 0.92)';
        this.ctx.fillRect(left, top, tileWidth, tileHeight + topPad);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(left, top, tileWidth, tileHeight + topPad);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const packModifiers = (typeof GameConfig !== 'undefined' && GameConfig.packModifiers) ? GameConfig.packModifiers : {};
        const modDef = modifierName ? packModifiers[modifierName] : null;
        const modifierColor = (modDef && modDef.color) ? modDef.color : '#e8dcc8';

        let y = top + topPad / 2 + lineHeight / 2;
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 15px Cinzel, Georgia, serif';
        this.ctx.fillText(lines[0], cx, y);
        y += lineHeight;

        if (hasBar) {
            const barWidth = tileWidth - padding * 2;
            const barX = left + padding;
            const barY = y + barGap / 2;
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            const pct = Math.max(0, Math.min(1, healthPercent));
            this.ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffff44' : '#ff4444';
            this.ctx.fillRect(barX, barY, barWidth * pct, barHeight);
            this.ctx.strokeStyle = '#222';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
            y += barHeight + barGap;
        }
        if (modifierGapArea > 0) y += modifierTopGap;

        if (lines.length > 1) {
            this.ctx.fillStyle = modifierColor;
            this.ctx.font = '500 13px Cinzel, Georgia, serif';
            this.ctx.fillText(lines[1], cx, y);
            y += lineHeight;
        }
        if (lines.length > 2) {
            this.ctx.fillStyle = '#a08060';
            this.ctx.font = '500 12px Cinzel, Georgia, serif';
            this.ctx.fillText(lines[2], cx, y);
        }
    }

    getHelpBackButtonAt(x: number, y: number): boolean {
        return getMenuRenderer('help')?.getButtonAt(x, y, { canvas: this.canvas }) === 'back';
    }

    /** Main Quest overlay: quests filtered by unlockedLevelIds, one row per quest. contentTop/contentHeight optional for tabbed board. */
    getMainQuestOverlayBounds(
        unlockedLevelIds: number[],
        contentTop?: number,
        contentHeight?: number,
    ): { titleY: number; listTop: number; rowHeight: number; rows: { index: number; quest: Quest; y: number; left: number; right: number; top: number; bottom: number }[]; buttonY: number; acceptX: number; backX: number; buttonW: number; buttonH: number } {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const listW = 520;
        const rowHeight = 44;
        const unlockedSet = new Set(unlockedLevelIds);
        const quests = STATIC_QUESTS.filter((q) => unlockedSet.has(q.level)).sort((a, b) => a.level - b.level || (a.order ?? 0) - (b.order ?? 0));
        const titleY = contentTop !== undefined ? contentTop + 24 : 56;
        const listTop = contentTop !== undefined ? contentTop + 56 : 88;
        const buttonY = contentTop !== undefined && contentHeight !== undefined ? contentTop + contentHeight - 56 : height - 56;
        const rows: { index: number; quest: Quest; y: number; left: number; right: number; top: number; bottom: number }[] = [];
        const left = cx - listW / 2;
        const right = cx + listW / 2;
        for (let i = 0; i < quests.length; i++) {
            const y = listTop + i * rowHeight + rowHeight / 2;
            rows.push({
                index: i,
                quest: quests[i],
                y,
                left,
                right,
                top: y - rowHeight / 2,
                bottom: y + rowHeight / 2,
            });
        }
        const buttonH = 40;
        const buttonW = 120;
        const gap = 24;
        const acceptX = cx - buttonW / 2 - gap / 2;
        const backX = cx + buttonW / 2 + gap / 2;
        return { titleY, listTop, rowHeight, rows, buttonY, acceptX, backX, buttonW, buttonH };
    }

    renderMainQuestOverlay(
        unlockedLevelIds: number[],
        completedQuestIds: string[],
        selectedQuestIndex: number,
        levelNames: Record<number, string>,
        contentTop?: number,
        contentHeight?: number,
    ): void {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        if (contentTop === undefined) {
            this.ctx.fillStyle = 'rgba(10, 8, 6, 0.82)';
            this.ctx.fillRect(0, 0, width, height);
        }

        const b = this.getMainQuestOverlayBounds(unlockedLevelIds, contentTop, contentHeight);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 24px Cinzel, Georgia, serif';
        this.ctx.fillText('Main Quest', cx, b.titleY);

        const completedSet = new Set(completedQuestIds);
        for (const row of b.rows) {
            const isSelected = selectedQuestIndex === row.index;
            const completed = completedSet.has(row.quest.id);
            const levelName = levelNames[row.quest.level] ?? 'Level ' + row.quest.level;

            this.ctx.fillStyle = isSelected ? 'rgba(201, 162, 39, 0.35)' : 'rgba(26, 16, 8, 0.6)';
            this.ctx.fillRect(row.left, row.top, row.right - row.left, row.bottom - row.top);
            this.ctx.strokeStyle = isSelected ? '#c9a227' : '#4a3020';
            this.ctx.lineWidth = isSelected ? 2 : 1;
            this.ctx.strokeRect(row.left, row.top, row.right - row.left, row.bottom - row.top);

            this.ctx.textAlign = 'left';
            this.ctx.fillStyle = completed ? '#6a8a6a' : '#e8dcc8';
            this.ctx.font = '600 15px Cinzel, Georgia, serif';
            this.ctx.fillText(completed ? '✓ ' + row.quest.name : row.quest.name, row.left + 12, row.y);
            this.ctx.fillStyle = '#a08060';
            this.ctx.font = '500 12px Cinzel, Georgia, serif';
            this.ctx.fillText(levelName, row.right - 10, row.y);
            if (row.quest.gatesBiomeUnlock) {
                this.ctx.fillStyle = '#c9a227';
                this.ctx.font = '500 11px Cinzel, Georgia, serif';
                this.ctx.fillText('Required', row.left + 14, row.y + 14);
            }
            this.ctx.textAlign = 'center';
        }

        const hasSelection = selectedQuestIndex >= 0 && selectedQuestIndex < b.rows.length;
        this.ctx.fillStyle = hasSelection ? '#1a1008' : 'rgba(26, 16, 8, 0.6)';
        this.ctx.fillRect(b.acceptX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.strokeStyle = hasSelection ? '#c9a227' : '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(b.acceptX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.fillStyle = hasSelection ? '#e8dcc8' : '#6a5a50';
        this.ctx.font = '600 14px Cinzel, Georgia, serif';
        this.ctx.fillText('Accept', b.acceptX, b.buttonY);

        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(b.backX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(b.backX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.fillStyle = '#a08060';
        this.ctx.fillText('Back', b.backX, b.buttonY);
    }

    getMainQuestSelectAt(x: number, y: number, unlockedLevelIds: number[], contentTop?: number, contentHeight?: number): number | null {
        const b = this.getMainQuestOverlayBounds(unlockedLevelIds, contentTop, contentHeight);
        for (const row of b.rows) {
            if (x >= row.left && x <= row.right && y >= row.top && y <= row.bottom) return row.index;
        }
        return null;
    }

    getMainQuestButtonAt(x: number, y: number, unlockedLevelIds: number[], contentTop?: number, contentHeight?: number): 'accept' | 'back' | null {
        const b = this.getMainQuestOverlayBounds(unlockedLevelIds, contentTop, contentHeight);
        const halfW = b.buttonW / 2;
        const halfH = b.buttonH / 2;
        if (x >= b.acceptX - halfW && x <= b.acceptX + halfW && y >= b.buttonY - halfH && y <= b.buttonY + halfH) return 'accept';
        if (x >= b.backX - halfW && x <= b.backX + halfW && y >= b.buttonY - halfH && y <= b.buttonY + halfH) return 'back';
        return null;
    }

    checkButtonClick(x: number, y: number, screen: ScreenName): boolean {
        if (screen === 'death') {
            return getMenuRenderer('death')?.getButtonAt(x, y, { canvas: this.canvas }) === 'return';
        }
        return false;
    }

    renderHubBoardOverlay(questList: Quest[], selectedQuestIndex: number, levelNames: Record<number, string>, gold: number = 0): void {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.82)';
        this.ctx.fillRect(0, 0, width, height);

        if (questList.length === 0) {
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillStyle = '#a08060';
            this.ctx.font = '500 16px Cinzel, Georgia, serif';
            this.ctx.fillText('No quests posted.', cx, height / 2);
            return;
        }

        const b = this.getQuestBoardBounds(questList, levelNames);
        const framePad = 20;
        const frameX = cx - b.boardW / 2 - framePad;
        const frameW = b.boardW + framePad * 2;
        const frameH = b.boardH + framePad * 2 + 24;

        // Wooden bulletin board frame
        this.ctx.fillStyle = '#3d2817';
        this.ctx.fillRect(frameX, b.frameY, frameW, frameH);
        this.ctx.strokeStyle = '#5c3d22';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(frameX, b.frameY, frameW, frameH);
        this.ctx.fillStyle = '#2a1810';
        this.ctx.fillRect(frameX + 6, b.frameY + 6, frameW - 12, frameH - 12);

        // Title
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 22px Cinzel, Georgia, serif';
        this.ctx.fillText('Investigations', cx, b.frameY + 22);

        const REROLL_COST = 200;
        const canReroll = gold >= REROLL_COST;

        // Buttons side by side (Accept | Re-roll | Back)
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(b.acceptX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.strokeStyle = '#c9a227';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(b.acceptX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.fillStyle = '#e8dcc8';
        this.ctx.font = '600 14px Cinzel, Georgia, serif';
        this.ctx.fillText('Accept quest', b.acceptX, b.buttonY);

        this.ctx.fillStyle = canReroll ? '#1a1008' : 'rgba(26, 16, 8, 0.6)';
        this.ctx.fillRect(b.rerollX - b.rerollButtonW / 2, b.buttonY - b.buttonH / 2, b.rerollButtonW, b.buttonH);
        this.ctx.strokeStyle = canReroll ? '#c9a227' : '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(b.rerollX - b.rerollButtonW / 2, b.buttonY - b.buttonH / 2, b.rerollButtonW, b.buttonH);
        this.ctx.fillStyle = canReroll ? '#e8dcc8' : '#6a5a50';
        this.ctx.font = '600 13px Cinzel, Georgia, serif';
        this.ctx.fillText('Re-roll (200g)', b.rerollX, b.buttonY);

        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(b.backX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(b.backX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
        this.ctx.fillStyle = '#a08060';
        this.ctx.fillText('Back', b.backX, b.buttonY);

        // Word-wrap a string to fit within maxChars per line (break on spaces when possible).
        const wrapText = (text: string, maxChars: number): string[] => {
            const out: string[] = [];
            let rest = text.trim();
            while (rest.length > 0) {
                if (rest.length <= maxChars) {
                    out.push(rest);
                    break;
                }
                let breakAt = rest.slice(0, maxChars + 1).lastIndexOf(' ');
                if (breakAt <= 0) breakAt = maxChars;
                out.push(rest.slice(0, breakAt).trim());
                rest = rest.slice(breakAt).trim();
            }
            return out;
        };

        // Three quest pages (pinned paper look)
        const maxCharsPerLine = 34;
        const descLineHeight = 18;
        for (let i = 0; i < b.rows.length; i++) {
            const row = b.rows[i];
            const quest = questList[row.index];
            const isSelected = selectedQuestIndex === row.index;
            const levelName = levelNames[quest.level] ?? 'Level ' + quest.level;
            const diffLabel = quest.difficulty?.label ?? quest.difficultyId;
            const descLines = getQuestDescription(quest);
            const wrappedLines: string[] = [];
            for (const line of descLines) {
                wrappedLines.push(...wrapText(line, maxCharsPerLine));
            }

            this.ctx.save();
            const slightRotate = (i - 1) * 0.018;
            this.ctx.translate(row.x + row.w / 2, row.y + row.h / 2);
            this.ctx.rotate(slightRotate);
            this.ctx.translate(-(row.x + row.w / 2), -(row.y + row.h / 2));

            this.ctx.fillStyle = isSelected ? '#f4ecd8' : '#e8dfc8';
            this.ctx.strokeStyle = isSelected ? '#c9a227' : '#8b7355';
            this.ctx.lineWidth = isSelected ? 3 : 1.5;
            this.ctx.fillRect(row.x, row.y, row.w, row.h);
            this.ctx.strokeRect(row.x, row.y, row.w, row.h);

            const pad = 12;
            let ty = row.y + pad + 8;
            this.ctx.fillStyle = '#1a1008';
            this.ctx.font = '700 20px Cinzel, Georgia, serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(levelName, row.x + row.w / 2, ty);
            ty += 26;
            this.ctx.fillStyle = '#4a3020';
            this.ctx.font = '600 16px Cinzel, Georgia, serif';
            this.ctx.fillText(diffLabel, row.x + row.w / 2, ty);
            ty += 22;
            this.ctx.fillStyle = '#2a1810';
            this.ctx.font = '500 14px Cinzel, Georgia, serif';
            for (const line of wrappedLines) {
                this.ctx.fillText(line, row.x + row.w / 2, ty);
                ty += descLineHeight;
            }
            this.ctx.restore();
        }
    }

    renderBoardOverlayWithTabs(
        boardTab: 'bulletin' | 'mainQuest',
        questList: Quest[],
        hubSelectedQuestIndex: number,
        unlockedLevelIds: number[],
        completedQuestIds: string[],
        hubSelectedMainQuestIndex: number,
        levelNames: Record<number, string>,
        gold: number,
    ): void {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.82)';
        this.ctx.fillRect(0, 0, width, height);

        const t = this.getTabbedBoardFrame();
        // Wooden frame
        this.ctx.fillStyle = '#3d2817';
        this.ctx.fillRect(t.frameX, t.frameY, t.frameW, t.frameH);
        this.ctx.strokeStyle = '#5c3d22';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(t.frameX, t.frameY, t.frameW, t.frameH);
        this.ctx.fillStyle = '#2a1810';
        this.ctx.fillRect(t.frameX + 6, t.frameY + 6, t.frameW - 12, t.frameH - 12);

        // Tab bar
        const tabTop = t.frameY + 6;
        const tabH = t.tabBarHeight - 12;
        const tab1Right = t.frameX + t.frameW / 2;
        const tab2Left = tab1Right;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const tabRows: readonly (readonly ['mainQuest' | 'bulletin', string, number, number])[] = [
            ['mainQuest', 'Main Quest', t.frameX, tab1Right],
            ['bulletin', 'Investigations', tab2Left, t.frameX + t.frameW],
        ];
        for (const [tab, label, left, right] of tabRows) {
            const isActive = boardTab === tab;
            this.ctx.fillStyle = isActive ? '#3d2817' : '#2a1810';
            this.ctx.fillRect(left, tabTop, right - left, tabH);
            this.ctx.strokeStyle = isActive ? '#c9a227' : '#4a3020';
            this.ctx.lineWidth = isActive ? 2 : 1;
            this.ctx.strokeRect(left, tabTop, right - left, tabH);
            this.ctx.fillStyle = isActive ? '#e8dcc8' : '#a08060';
            this.ctx.font = isActive ? '600 14px Cinzel, Georgia, serif' : '500 13px Cinzel, Georgia, serif';
            this.ctx.fillText(label, (left + right) / 2, tabTop + tabH / 2);
        }

        if (boardTab === 'bulletin') {
            if (questList.length === 0) {
                this.ctx.fillStyle = '#a08060';
                this.ctx.font = '500 16px Cinzel, Georgia, serif';
                this.ctx.fillText('No quests posted.', cx, t.contentTop + t.contentHeight / 2);
                return;
            }
            const b = this.getQuestBoardBounds(questList, levelNames, t.contentTop);
            this.ctx.fillStyle = '#c9a227';
            this.ctx.font = '700 22px Cinzel, Georgia, serif';
            this.ctx.fillText('Investigations', cx, b.frameY + 22);
            const REROLL_COST = 200;
            const canReroll = gold >= REROLL_COST;
            this.ctx.fillStyle = '#1a1008';
            this.ctx.fillRect(b.acceptX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
            this.ctx.strokeStyle = '#c9a227';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(b.acceptX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
            this.ctx.fillStyle = '#e8dcc8';
            this.ctx.font = '600 14px Cinzel, Georgia, serif';
            this.ctx.fillText('Accept quest', b.acceptX, b.buttonY);
            this.ctx.fillStyle = canReroll ? '#1a1008' : 'rgba(26, 16, 8, 0.6)';
            this.ctx.fillRect(b.rerollX - b.rerollButtonW / 2, b.buttonY - b.buttonH / 2, b.rerollButtonW, b.buttonH);
            this.ctx.strokeStyle = canReroll ? '#c9a227' : '#4a3020';
            this.ctx.strokeRect(b.rerollX - b.rerollButtonW / 2, b.buttonY - b.buttonH / 2, b.rerollButtonW, b.buttonH);
            this.ctx.fillStyle = canReroll ? '#e8dcc8' : '#6a5a50';
            this.ctx.font = '600 13px Cinzel, Georgia, serif';
            this.ctx.fillText('Re-roll (200g)', b.rerollX, b.buttonY);
            this.ctx.fillStyle = '#1a1008';
            this.ctx.fillRect(b.backX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
            this.ctx.strokeStyle = '#4a3020';
            this.ctx.strokeRect(b.backX - b.buttonW / 2, b.buttonY - b.buttonH / 2, b.buttonW, b.buttonH);
            this.ctx.fillStyle = '#a08060';
            this.ctx.fillText('Back', b.backX, b.buttonY);
            const wrapText = (text: string, maxChars: number): string[] => {
                const out: string[] = [];
                let rest = text.trim();
                while (rest.length > 0) {
                    if (rest.length <= maxChars) {
                        out.push(rest);
                        break;
                    }
                    const breakAt = rest.slice(0, maxChars + 1).lastIndexOf(' ');
                    out.push(rest.slice(0, breakAt <= 0 ? maxChars : breakAt).trim());
                    rest = rest.slice(breakAt <= 0 ? maxChars : breakAt).trim();
                }
                return out;
            };
            const maxCharsPerLine = 34;
            const descLineHeight = 18;
            for (let i = 0; i < b.rows.length; i++) {
                const row = b.rows[i];
                const quest = questList[row.index];
                const isSelected = hubSelectedQuestIndex === row.index;
                const levelName = levelNames[quest.level] ?? 'Level ' + quest.level;
                const diffLabel = quest.difficulty?.label ?? quest.difficultyId;
                const descLines = getQuestDescription(quest);
                const wrappedLines: string[] = [];
                for (const line of descLines) {
                    wrappedLines.push(...wrapText(line, maxCharsPerLine));
                }
                this.ctx.save();
                const slightRotate = (i - 1) * 0.018;
                this.ctx.translate(row.x + row.w / 2, row.y + row.h / 2);
                this.ctx.rotate(slightRotate);
                this.ctx.translate(-(row.x + row.w / 2), -(row.y + row.h / 2));
                this.ctx.fillStyle = isSelected ? '#f4ecd8' : '#e8dfc8';
                this.ctx.strokeStyle = isSelected ? '#c9a227' : '#8b7355';
                this.ctx.lineWidth = isSelected ? 3 : 1.5;
                this.ctx.fillRect(row.x, row.y, row.w, row.h);
                this.ctx.strokeRect(row.x, row.y, row.w, row.h);
                const pad = 12;
                let ty = row.y + pad + 8;
                this.ctx.fillStyle = '#1a1008';
                this.ctx.font = '700 20px Cinzel, Georgia, serif';
                this.ctx.fillText(levelName, row.x + row.w / 2, ty);
                ty += 26;
                this.ctx.fillStyle = '#4a3020';
                this.ctx.font = '600 16px Cinzel, Georgia, serif';
                this.ctx.fillText(diffLabel, row.x + row.w / 2, ty);
                ty += 22;
                this.ctx.fillStyle = '#2a1810';
                this.ctx.font = '500 14px Cinzel, Georgia, serif';
                for (const line of wrappedLines) {
                    this.ctx.fillText(line, row.x + row.w / 2, ty);
                    ty += descLineHeight;
                }
                this.ctx.restore();
            }
        } else {
            this.renderMainQuestOverlay(unlockedLevelIds, completedQuestIds, hubSelectedMainQuestIndex, levelNames, t.contentTop, t.contentHeight);
        }
    }

    getWeaponChestOverlayBounds() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;
        const rowH = 28;
        const rowW = 260;
        const startY = height / 2 - 140;
        return {
            cx, rowW, rowH, startY,
            backY: height / 2 + 160,
            rows: [
                { key: 'sword_rusty', mainhandKey: 'sword_rusty', offhandKey: 'none', label: 'Rusty Sword', y: startY },
                { key: 'sword_rusty+shield', mainhandKey: 'sword_rusty', offhandKey: 'shield_wooden', label: 'Rusty Sword + Shield', y: startY + rowH },
                { key: 'dagger_rusty', mainhandKey: 'dagger_rusty', offhandKey: 'none', label: 'Rusty Dagger', y: startY + rowH * 2 },
                { key: 'dagger_rusty+shield', mainhandKey: 'dagger_rusty', offhandKey: 'shield_wooden', label: 'Rusty Dagger + Shield', y: startY + rowH * 3 },
                { key: 'greatsword_rusty', mainhandKey: 'greatsword_rusty', offhandKey: 'none', label: 'Rusty Greatsword', y: startY + rowH * 4 },
                { key: 'crossbow_rusty', mainhandKey: 'crossbow_rusty', offhandKey: 'none', label: 'Rusty Crossbow', y: startY + rowH * 5 },
                { key: 'crossbow_rusty+shield', mainhandKey: 'crossbow_rusty', offhandKey: 'shield_wooden', label: 'Rusty Crossbow + Shield', y: startY + rowH * 6 },
                { key: 'mace_rusty', mainhandKey: 'mace_rusty', offhandKey: 'none', label: 'Rusty Mace', y: startY + rowH * 7 },
                { key: 'mace_rusty+shield', mainhandKey: 'mace_rusty', offhandKey: 'shield_wooden', label: 'Rusty Mace + Shield', y: startY + rowH * 8 }
            ]
        };
    }

    getWeaponChestWeaponAt(x, y) {
        const b = this.getWeaponChestOverlayBounds();
        const left = b.cx - b.rowW / 2;
        const right = b.cx + b.rowW / 2;
        for (const row of b.rows) {
            const top = row.y - b.rowH / 2;
            const bottom = row.y + b.rowH / 2;
            if (x >= left && x <= right && y >= top && y <= bottom) {
                return { mainhandKey: row.mainhandKey, offhandKey: row.offhandKey };
            }
        }
        return null;
    }

    getWeaponChestBackAt(x, y) {
        const b = this.getWeaponChestOverlayBounds();
        const buttonWidth = 120;
        const buttonHeight = 40;
        const left = b.cx - buttonWidth / 2;
        const right = b.cx + buttonWidth / 2;
        const top = b.backY - buttonHeight / 2;
        const bottom = b.backY + buttonHeight / 2;
        return x >= left && x <= right && y >= top && y <= bottom;
    }

    renderWeaponChestOverlay(equippedMainhandKey, equippedOffhandKey) {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const cx = width / 2;

        this.ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillStyle = '#c9a227';
        this.ctx.font = '700 26px Cinzel, Georgia, serif';
        this.ctx.fillText('Equipment', cx, height / 2 - 90);

        const b = this.getWeaponChestOverlayBounds();
        for (const row of b.rows) {
            const isEquipped = equippedMainhandKey === row.mainhandKey && equippedOffhandKey === row.offhandKey;
            this.ctx.fillStyle = isEquipped ? 'rgba(201, 162, 39, 0.25)' : 'rgba(20, 16, 8, 0.6)';
            this.ctx.fillRect(b.cx - b.rowW / 2, row.y - b.rowH / 2, b.rowW, b.rowH);
            this.ctx.strokeStyle = isEquipped ? '#c9a227' : '#4a3020';
            this.ctx.lineWidth = isEquipped ? 2 : 1;
            this.ctx.strokeRect(b.cx - b.rowW / 2, row.y - b.rowH / 2, b.rowW, b.rowH);
            this.ctx.fillStyle = isEquipped ? '#e8dcc8' : '#a08060';
            this.ctx.font = isEquipped ? '600 13px Cinzel, Georgia, serif' : '500 12px Cinzel, Georgia, serif';
            this.ctx.fillText(row.label, b.cx, row.y);
        }

        const buttonWidth = 120;
        const buttonHeight = 40;
        this.ctx.fillStyle = '#1a1008';
        this.ctx.fillRect(cx - buttonWidth / 2, b.backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = '#4a3020';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(cx - buttonWidth / 2, b.backY - buttonHeight / 2, buttonWidth, buttonHeight);
        this.ctx.fillStyle = '#a08060';
        this.ctx.font = '600 13px Cinzel, Georgia, serif';
        this.ctx.fillText('Back', cx, b.backY);
    }

    getSettingsItemAt(x: number, y: number, settings: SettingsLike): string | null {
        return getMenuRenderer('settings')?.getButtonAt(x, y, { settings, canvas: this.canvas }) ?? null;
    }

    getControlsItemAt(x: number, y: number): string | null {
        return getMenuRenderer('settings-controls')?.getButtonAt(x, y, { canvas: this.canvas }) ?? null;
    }

    render(settings: SettingsLike): void {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (isMenuScreen(this.currentScreen)) {
            const renderer = getMenuRenderer(this.currentScreen);
            renderer?.render(this.ctx, this.canvas, {
                settings,
                listSaveSlots,
                currentScreen: this.currentScreen,
                isButtonPressed: this.isButtonPressed.bind(this),
                canvas: this.canvas
            });
        }
        // 'hub' and 'playing' screens are handled by the normal game rendering
    }
}

