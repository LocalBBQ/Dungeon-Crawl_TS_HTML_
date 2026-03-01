import { drawMenuButton } from './MenuDrawUtils.js';
import type { MenuRenderOptions } from './MenuScreenRegistry.js';

export const pauseScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;

        ctx.fillStyle = 'rgba(10, 8, 6, 0.75)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#c9a227';
        ctx.font = '700 38px Cinzel, Georgia, serif';
        ctx.fillText('Paused', cx, height / 2 - 120);

        const buttonWidth = 200;
        const buttonHeight = 44;
        const resumeY = height / 2 - 115;
        const saveY = height / 2 - 65;
        const settingsY = height / 2 - 15;
        const helpY = height / 2 + 35;
        const quitY = height / 2 + 85;

        const pressed = (btn: string) => options?.isButtonPressed && options?.currentScreen ? options.isButtonPressed(options.currentScreen, btn) : false;
        drawMenuButton(ctx, cx, resumeY, buttonWidth, buttonHeight, 'Resume', pressed('resume'));
        drawMenuButton(ctx, cx, saveY, buttonWidth, buttonHeight, 'Save game', pressed('save'));
        drawMenuButton(ctx, cx, settingsY, buttonWidth, buttonHeight, 'Settings', pressed('settings'));
        drawMenuButton(ctx, cx, helpY, buttonWidth, buttonHeight, 'Help — Pack modifiers', pressed('help'));
        drawMenuButton(ctx, cx, quitY, buttonWidth, buttonHeight, 'Quit to main menu', pressed('quit'), { dim: true });

        ctx.fillStyle = '#a08060';
        ctx.font = '500 13px Cinzel, Georgia, serif';
        ctx.fillText('Press ESC to resume', cx, height / 2 + 200);
    },

    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null {
        const canvas = options?.canvas;
        if (!canvas) return null;
        const width = canvas.width;
        const height = canvas.height;
        const buttonWidth = 200;
        const buttonHeight = 44;
        const cx = width / 2;
        const resumeY = height / 2 - 115;
        const saveY = height / 2 - 65;
        const settingsY = height / 2 - 15;
        const helpY = height / 2 + 35;
        const quitY = height / 2 + 85;
        const left = cx - buttonWidth / 2;
        const right = cx + buttonWidth / 2;
        if (x >= left && x <= right && y >= resumeY - buttonHeight / 2 && y <= resumeY + buttonHeight / 2) return 'resume';
        if (x >= left && x <= right && y >= saveY - buttonHeight / 2 && y <= saveY + buttonHeight / 2) return 'save';
        if (x >= left && x <= right && y >= settingsY - buttonHeight / 2 && y <= settingsY + buttonHeight / 2) return 'settings';
        if (x >= left && x <= right && y >= helpY - buttonHeight / 2 && y <= helpY + buttonHeight / 2) return 'help';
        if (x >= left && x <= right && y >= quitY - buttonHeight / 2 && y <= quitY + buttonHeight / 2) return 'quit';
        return null;
    }
};
