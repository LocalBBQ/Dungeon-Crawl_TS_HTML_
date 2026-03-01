import { drawMenuButton } from './MenuDrawUtils.js';
import type { MenuRenderOptions } from './MenuScreenRegistry.js';

export const deathScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void {
        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#c9a227';
        ctx.font = '700 38px Cinzel, Georgia, serif';
        ctx.fillText('Thou art fallen', width / 2, height / 2 - 88);

        ctx.fillStyle = '#a08060';
        ctx.font = '500 15px Cinzel, Georgia, serif';
        ctx.fillText('You dropped your equipment and passed out.', width / 2, height / 2 - 48);
        ctx.fillText('A strange presence has brought you back to the Sanctuary.', width / 2, height / 2 - 28);

        ctx.font = '500 14px Cinzel, Georgia, serif';
        ctx.fillText('Press SPACE or click to return to Sanctuary', width / 2, height / 2 + 4);

        const buttonX = width / 2;
        const buttonY = height / 2 + 70;
        const buttonWidth = 160;
        const buttonHeight = 48;
        const pressed = options?.isButtonPressed && options?.currentScreen ? options.isButtonPressed(options.currentScreen, 'return') : false;
        drawMenuButton(ctx, buttonX, buttonY, buttonWidth, buttonHeight, 'Return to Sanctuary', pressed);
    },

    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null {
        const canvas = options?.canvas;
        if (!canvas) return null;
        const width = canvas.width;
        const height = canvas.height;
        const buttonX = width / 2;
        const buttonY = height / 2 + 70;
        const buttonWidth = 160;
        const buttonHeight = 48;
        const buttonLeft = buttonX - buttonWidth / 2;
        const buttonRight = buttonX + buttonWidth / 2;
        const buttonTop = buttonY - buttonHeight / 2;
        const buttonBottom = buttonY + buttonHeight / 2;
        if (x >= buttonLeft && x <= buttonRight && y >= buttonTop && y <= buttonBottom) return 'return';
        return null;
    }
};
