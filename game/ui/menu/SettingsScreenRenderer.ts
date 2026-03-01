import type { SettingsLike } from '../../core/ScreenManager.js';
import type { MenuRenderOptions } from './MenuScreenRegistry.js';

function getSettingsLayout(canvas: HTMLCanvasElement, settings: SettingsLike) {
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const rowHeight = 32;
    const rowWidth = 360;
    const startY = height / 2 - 60;

    const rows: { key: string; label: string; value?: boolean; type: string; x: number; y: number }[] = [
        { key: 'music', label: 'Music', value: settings.musicEnabled, type: 'toggle', x: cx - rowWidth / 2, y: startY + 0 * 40 },
        { key: 'sfx', label: 'Sound Effects', value: settings.sfxEnabled, type: 'toggle', x: cx - rowWidth / 2, y: startY + 1 * 40 },
        { key: 'minimap', label: 'Minimap', value: settings.showMinimap, type: 'toggle', x: cx - rowWidth / 2, y: startY + 2 * 40 },
        { key: 'characterSprites', label: 'Character Sprites', value: settings.useCharacterSprites, type: 'toggle', x: cx - rowWidth / 2, y: startY + 3 * 40 },
        { key: 'environmentSprites', label: 'Environment Sprites', value: settings.useEnvironmentSprites, type: 'toggle', x: cx - rowWidth / 2, y: startY + 4 * 40 },
        { key: 'playerHitboxIndicators', label: 'Player Hitbox Indicators', value: settings.showPlayerHitboxIndicators, type: 'toggle', x: cx - rowWidth / 2, y: startY + 5 * 40 },
        { key: 'enemyHitboxIndicators', label: 'Enemy Hitbox Indicators', value: settings.showEnemyHitboxIndicators, type: 'toggle', x: cx - rowWidth / 2, y: startY + 6 * 40 },
        { key: 'enemyStaminaBars', label: 'Enemy Stamina Bars', value: settings.showEnemyStaminaBars, type: 'toggle', x: cx - rowWidth / 2, y: startY + 7 * 40 },
        { key: 'playerHealthBarAlways', label: 'Player Health Bar Always', value: settings.showPlayerHealthBarAlways, type: 'toggle', x: cx - rowWidth / 2, y: startY + 8 * 40 },
        { key: 'enemyHealthBars', label: 'Enemy Health Bars', value: settings.showEnemyHealthBars, type: 'toggle', x: cx - rowWidth / 2, y: startY + 9 * 40 },
        { key: 'controls', label: 'Controls', type: 'link', x: cx - rowWidth / 2, y: startY + 10 * 40 }
    ];

    const lastRow = rows[rows.length - 1];
    const backButton = { key: 'back', label: 'Back', x: cx - 80, y: lastRow.y + 60, width: 160, height: 40 };
    return { rows, backButton, rowWidth, rowHeight };
}

export const settingsScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const settings = options?.settings ?? {};

        ctx.fillStyle = 'rgba(10, 8, 6, 0.80)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#c9a227';
        ctx.font = '700 34px Cinzel, Georgia, serif';
        ctx.fillText('Settings', cx, height / 2 - 140);

        const layout = getSettingsLayout(canvas, settings);

        layout.rows.forEach((row) => {
            ctx.fillStyle = 'rgba(20, 16, 8, 0.8)';
            ctx.fillRect(row.x, row.y - layout.rowHeight / 2, layout.rowWidth, layout.rowHeight);
            ctx.strokeStyle = '#4a3020';
            ctx.lineWidth = 1;
            ctx.strokeRect(row.x, row.y - layout.rowHeight / 2, layout.rowWidth, layout.rowHeight);
            ctx.fillStyle = '#e8dcc8';
            ctx.font = '500 15px Cinzel, Georgia, serif';
            const text = row.type === 'link' ? row.label : `${row.label}: ${row.value ? 'On' : 'Off'}`;
            ctx.fillText(text, cx, row.y);
        });

        const back = layout.backButton;
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
        const settings = options?.settings ?? {};
        if (!canvas) return null;
        const layout = getSettingsLayout(canvas, settings);

        for (const row of layout.rows) {
            const left = row.x;
            const right = row.x + layout.rowWidth;
            const top = row.y - layout.rowHeight / 2;
            const bottom = row.y + layout.rowHeight / 2;
            if (x >= left && x <= right && y >= top && y <= bottom) return row.key;
        }

        const back = layout.backButton;
        if (x >= back.x && x <= back.x + back.width && y >= back.y - back.height / 2 && y <= back.y + back.height / 2) return 'back';
        return null;
    }
};
