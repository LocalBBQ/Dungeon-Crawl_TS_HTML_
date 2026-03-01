import {
    drawSmallButton,
    drawClassPortraitWarrior,
    drawClassPortraitMage,
    drawClassPortraitRogue,
    CLASS_SELECT_PORTRAIT_SIZE
} from './MenuDrawUtils.js';
import type { MenuRenderOptions } from './MenuScreenRegistry.js';

const CLASS_SELECT_PANEL_WIDTH = 200;
const CLASS_SELECT_BUTTON_WIDTH = 160;
const CLASS_SELECT_BUTTON_HEIGHT = 40;

function getClassSelectBounds(width: number, height: number) {
    const cx = width / 2;
    const gap = 24;
    const totalPanelWidth = CLASS_SELECT_PANEL_WIDTH * 3 + gap * 2;
    const left = cx - totalPanelWidth / 2 + CLASS_SELECT_PANEL_WIDTH / 2 + gap / 2;
    return {
        titleY: height * 0.14,
        panelTop: height * 0.22,
        panelCenterX: { warrior: left, mage: cx, rogue: width - left },
        portraitTop: height * 0.22 + 16,
        nameY: height * 0.22 + 16 + CLASS_SELECT_PORTRAIT_SIZE + 14,
        descY: height * 0.22 + 16 + CLASS_SELECT_PORTRAIT_SIZE + 14 + 24 + 20,
        buttonY: height * 0.22 + 16 + CLASS_SELECT_PORTRAIT_SIZE + 14 + 24 + 52 + 14,
        buttonWidth: CLASS_SELECT_BUTTON_WIDTH,
        buttonHeight: CLASS_SELECT_BUTTON_HEIGHT,
        backButtonY: height - 52,
        backButtonWidth: 120,
        backButtonHeight: 38
    };
}

export const classSelectScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const b = getClassSelectBounds(width, height);

        ctx.fillStyle = 'rgba(10, 8, 6, 0.92)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#c9a227';
        ctx.font = '700 38px Cinzel, Georgia, serif';
        ctx.fillText('Choose Your Class', cx, b.titleY);

        const classes: { key: 'warrior' | 'mage' | 'rogue'; name: string; description: string[] }[] = [
            { key: 'warrior', name: 'Warrior', description: ['Heavy armor and blade.', 'Front-line fighter, high defense.'] },
            { key: 'mage', name: 'Mage', description: ['Staff and arcane arts.', 'Ranged power, crowd control.'] },
            { key: 'rogue', name: 'Rogue', description: ['Dagger and bow.', 'Speed, crits, and mobility.'] }
        ];

        const portraitCenterY = b.portraitTop + CLASS_SELECT_PORTRAIT_SIZE / 2;
        const halfPanel = CLASS_SELECT_PANEL_WIDTH / 2;
        const pressed = (btn: string) => options?.isButtonPressed && options?.currentScreen ? options.isButtonPressed(options.currentScreen, btn) : false;

        for (const c of classes) {
            const px = b.panelCenterX[c.key];
            const panelH = 14 + CLASS_SELECT_PORTRAIT_SIZE + 14 + 24 + 52 + 14 + b.buttonHeight + 14;
            ctx.fillStyle = 'rgba(26, 20, 12, 0.85)';
            ctx.strokeStyle = '#4a3020';
            ctx.lineWidth = 2;
            ctx.fillRect(px - halfPanel, b.panelTop, CLASS_SELECT_PANEL_WIDTH, panelH);
            ctx.strokeRect(px - halfPanel, b.panelTop, CLASS_SELECT_PANEL_WIDTH, panelH);

            ctx.save();
            ctx.translate(px, portraitCenterY);
            if (c.key === 'warrior') drawClassPortraitWarrior(ctx, 0, 0, CLASS_SELECT_PORTRAIT_SIZE);
            else if (c.key === 'mage') drawClassPortraitMage(ctx, 0, 0, CLASS_SELECT_PORTRAIT_SIZE);
            else drawClassPortraitRogue(ctx, 0, 0, CLASS_SELECT_PORTRAIT_SIZE);
            ctx.restore();

            ctx.fillStyle = '#e8dcc8';
            ctx.font = '600 20px Cinzel, Georgia, serif';
            ctx.fillText(c.name, px, b.nameY);
            ctx.fillStyle = '#a08060';
            ctx.font = '500 13px Cinzel, Georgia, serif';
            c.description.forEach((line, i) => {
                ctx.fillText(line, px, b.descY + i * 18);
            });
            drawSmallButton(ctx, px, b.buttonY, b.buttonWidth, b.buttonHeight, 'Select', pressed(c.key));
        }

        ctx.fillStyle = '#706050';
        ctx.font = '500 12px Cinzel, Georgia, serif';
        ctx.fillText('Choose a class to begin', cx, height - 20);
        drawSmallButton(ctx, cx, b.backButtonY, b.backButtonWidth, b.backButtonHeight, 'Back', pressed('back'));
    },

    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null {
        const canvas = options?.canvas;
        if (!canvas) return null;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const b = getClassSelectBounds(width, height);
        const backHw = b.backButtonWidth / 2;
        const backHh = b.backButtonHeight / 2;
        if (x >= cx - backHw && x <= cx + backHw && y >= b.backButtonY - backHh && y <= b.backButtonY + backHh) return 'back';
        const hw = b.buttonWidth / 2;
        const hh = b.buttonHeight / 2;
        if (x >= b.panelCenterX.warrior - hw && x <= b.panelCenterX.warrior + hw && y >= b.buttonY - hh && y <= b.buttonY + hh) return 'warrior';
        if (x >= b.panelCenterX.mage - hw && x <= b.panelCenterX.mage + hw && y >= b.buttonY - hh && y <= b.buttonY + hh) return 'mage';
        if (x >= b.panelCenterX.rogue - hw && x <= b.panelCenterX.rogue + hw && y >= b.buttonY - hh && y <= b.buttonY + hh) return 'rogue';
        return null;
    }
};
