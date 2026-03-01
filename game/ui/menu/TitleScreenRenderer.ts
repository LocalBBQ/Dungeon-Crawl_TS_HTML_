import { drawMenuButton, drawTitleBrazier } from './MenuDrawUtils.js';
import type { MenuRenderOptions } from './MenuScreenRegistry.js';

export const titleScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
        ctx.fillRect(0, 0, width, height);

        const brazierY = cy - 90;
        const brazierW = 56;
        const brazierH = 100;
        drawTitleBrazier(ctx, cx - 220, brazierY, brazierW, brazierH);
        drawTitleBrazier(ctx, cx + 220, brazierY, brazierW, brazierH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#c9a227';
        ctx.font = '700 52px Cinzel, Georgia, serif';
        ctx.fillText('Dungeon Crawl', width / 2, height / 2 - 90);

        ctx.fillStyle = '#a08060';
        ctx.font = '500 15px Cinzel, Georgia, serif';
        ctx.fillText('Choose an option below', width / 2, height / 2 - 10);

        const buttonWidth = 180;
        const buttonHeight = 44;
        const gap = 20;
        const totalW = buttonWidth * 2 + gap;
        const leftX = width / 2 - totalW / 2 + buttonWidth / 2 + gap / 2;
        const rightX = width / 2 + totalW / 2 - buttonWidth / 2 - gap / 2;
        const buttonY = height / 2 + 50;

        const pressed = options?.isButtonPressed && options?.currentScreen ? (btn: string) => options.isButtonPressed!(options.currentScreen!, btn) : () => false;
        drawMenuButton(ctx, leftX, buttonY, buttonWidth, buttonHeight, 'New Game', pressed('newGame'));
        drawMenuButton(ctx, rightX, buttonY, buttonWidth, buttonHeight, 'Load Game', pressed('loadGame'));
    },

    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null {
        const canvas = options?.canvas;
        if (!canvas) return null;
        const width = canvas.width;
        const height = canvas.height;
        const buttonWidth = 180;
        const buttonHeight = 44;
        const gap = 20;
        const totalW = buttonWidth * 2 + gap;
        const leftX = width / 2 - totalW / 2 + buttonWidth / 2 + gap / 2;
        const rightX = width / 2 + totalW / 2 - buttonWidth / 2 - gap / 2;
        const buttonY = height / 2 + 50;
        const hw = buttonWidth / 2;
        const hh = buttonHeight / 2;
        if (x >= leftX - hw && x <= leftX + hw && y >= buttonY - hh && y <= buttonY + hh) return 'newGame';
        if (x >= rightX - hw && x <= rightX + hw && y >= buttonY - hh && y <= buttonY + hh) return 'loadGame';
        return null;
    }
};
