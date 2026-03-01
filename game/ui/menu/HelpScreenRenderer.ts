import { GameConfig } from '../../config/GameConfig.js';
import { drawSmallButton } from './MenuDrawUtils.js';
import type { MenuRenderOptions } from './MenuScreenRegistry.js';

export function getPackModifierDescription(name: string, def: { damageMultiplier?: number; healthMultiplier?: number; speedMultiplier?: number; knockbackResist?: number; attackCooldownMultiplier?: number; stunBuildupPerHitMultiplier?: number }): string {
    const parts: string[] = [];
    if (def.damageMultiplier != null && def.damageMultiplier !== 1) parts.push(`${Math.round((def.damageMultiplier - 1) * 100)}% damage`);
    if (def.healthMultiplier != null && def.healthMultiplier !== 1) parts.push(`${Math.round((def.healthMultiplier - 1) * 100)}% health`);
    if (def.speedMultiplier != null && def.speedMultiplier !== 1) parts.push(`${Math.round((def.speedMultiplier - 1) * 100)}% speed`);
    if (def.knockbackResist != null && def.knockbackResist > 0) parts.push('knockback resist');
    if (def.attackCooldownMultiplier != null && def.attackCooldownMultiplier < 1) parts.push('faster attacks');
    if (def.stunBuildupPerHitMultiplier != null && def.stunBuildupPerHitMultiplier !== 1) parts.push('stun buildup');
    return parts.length > 0 ? parts.join(', ') : '';
}

export const helpScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;

        const bottomCutoutH = 200;
        ctx.fillStyle = 'rgba(10, 8, 6, 0.88)';
        ctx.fillRect(0, 0, width, height - bottomCutoutH);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#c9a227';
        ctx.font = '700 36px Cinzel, Georgia, serif';
        ctx.fillText('Pack modifiers', cx, 72);

        ctx.fillStyle = '#a08060';
        ctx.font = '500 15px Cinzel, Georgia, serif';
        ctx.fillText('Enemies in a pack (same type, nearby) get one random modifier. Tag appears above them when buff is active.', cx, 112);

        const packModifiers = GameConfig.packModifiers || {};
        const names = Object.keys(packModifiers);
        const lineHeight = 28;
        const startY = 142;

        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const def = packModifiers[name as keyof typeof packModifiers];
            const capName = name.charAt(0).toUpperCase() + name.slice(1);
            const desc = getPackModifierDescription(name, def || {});
            const line = desc ? `${capName} — ${desc}` : capName;
            const y = startY + i * lineHeight;
            ctx.fillStyle = def && (def as { color?: string }).color ? (def as { color: string }).color : '#e8dcc8';
            ctx.font = '600 16px Cinzel, Georgia, serif';
            ctx.fillText(line, cx, y);
        }

        const backY = height - 56;
        const buttonWidth = 120;
        const buttonHeight = 40;
        const pressed = options?.isButtonPressed && options?.currentScreen ? options.isButtonPressed(options.currentScreen, 'back') : false;
        drawSmallButton(ctx, cx, backY, buttonWidth, buttonHeight, 'Back', pressed);
    },

    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null {
        const canvas = options?.canvas;
        if (!canvas) return null;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const backY = height - 56;
        const buttonWidth = 120;
        const buttonHeight = 40;
        const left = cx - buttonWidth / 2;
        const right = cx + buttonWidth / 2;
        if (x >= left && x <= right && y >= backY - buttonHeight / 2 && y <= backY + buttonHeight / 2) return 'back';
        return null;
    }
};
