import type { MenuRenderOptions } from './MenuScreenRegistry.js';

function getControlsBackButton(canvas: HTMLCanvasElement) {
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    return { x: cx - 80, y: height / 2 + 180, width: 160, height: 40 };
}

const LINES = [
    'WASD — Move',
    'Shift — Sprint',
    'Space — Dodge',
    'Left click — Attack',
    'Right click — Block',
    'Q — Heal (tap to drink, then regen)',
    'Shift + Left click — Dash attack',
    'E — Portal (tap E at portal to channel; next area or return to Sanctuary)',
    'B — Start recall portal channel (2.5s); tap E at blue portal to return to Sanctuary (keeps inventory)',
    'In Sanctuary: E at board — Level select · E at chest — Equipment · E at shop — Buy weapons'
];

export const controlsScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;

        ctx.fillStyle = 'rgba(10, 8, 6, 0.90)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#c9a227';
        ctx.font = '700 34px Cinzel, Georgia, serif';
        ctx.fillText('Controls', cx, height / 2 - 200);

        ctx.fillStyle = '#e8dcc8';
        ctx.font = '500 15px Cinzel, Georgia, serif';
        const lineHeight = 24;
        const startY = height / 2 - 140;
        LINES.forEach((line, i) => {
            ctx.fillText(line, cx, startY + i * lineHeight);
        });

        const back = getControlsBackButton(canvas);
        ctx.fillStyle = '#1a1008';
        ctx.fillRect(back.x, back.y - back.height / 2, back.width, back.height);
        ctx.strokeStyle = '#4a3020';
        ctx.lineWidth = 2;
        ctx.strokeRect(back.x, back.y - back.height / 2, back.width, back.height);
        ctx.fillStyle = '#a08060';
        ctx.font = '600 15px Cinzel, Georgia, serif';
        ctx.fillText('Back', cx, back.y);
    },

    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null {
        const canvas = options?.canvas;
        if (!canvas) return null;
        const back = getControlsBackButton(canvas);
        if (x >= back.x && x <= back.x + back.width && y >= back.y - back.height / 2 && y <= back.y + back.height / 2) return 'back';
        return null;
    }
};
