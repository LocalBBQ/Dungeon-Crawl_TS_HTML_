import { drawSmallButton } from './MenuDrawUtils.js';
import type { MenuRenderOptions } from './MenuScreenRegistry.js';

export const saveSelectScreenRenderer = {
    render(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, options?: MenuRenderOptions): void {
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;

        ctx.fillStyle = 'rgba(10, 8, 6, 0.92)';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#c9a227';
        ctx.font = '700 38px Cinzel, Georgia, serif';
        ctx.fillText('Load Game', cx, height * 0.12);

        ctx.fillStyle = '#a08060';
        ctx.font = '500 14px Cinzel, Georgia, serif';
        ctx.fillText('Choose a save slot to continue', cx, height * 0.18);

        const slots = options?.listSaveSlots?.() ?? [];
        const rowHeight = 56;
        const startY = height * 0.26;
        const slotWidth = Math.min(420, width - 80);
        const labelLeft = cx - slotWidth / 2;
        const loadBtnWidth = 80;
        const loadBtnHeight = 36;
        const deleteBtnWidth = 64;
        const deleteBtnHeight = 36;
        const btnGap = 10;

        const pressed = (btn: string) => options?.isButtonPressed && options?.currentScreen ? options.isButtonPressed(options.currentScreen, btn) : false;

        slots.forEach((slot, i) => {
            const y = startY + i * rowHeight;
            ctx.fillStyle = 'rgba(26, 20, 12, 0.85)';
            ctx.strokeStyle = '#4a3020';
            ctx.lineWidth = 2;
            ctx.fillRect(labelLeft, y - rowHeight / 2 + 4, slotWidth, rowHeight - 8);
            ctx.strokeRect(labelLeft, y - rowHeight / 2 + 4, slotWidth, rowHeight - 8);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#e8dcc8';
            ctx.font = '600 16px Cinzel, Georgia, serif';
            ctx.fillText(`Slot ${slot.id}`, labelLeft + 16, y);
            ctx.fillStyle = slot.isEmpty ? '#706050' : '#a08060';
            ctx.font = '500 14px Cinzel, Georgia, serif';
            ctx.fillText(slot.label, labelLeft + 72, y);
            ctx.textAlign = 'center';

            if (!slot.isEmpty) {
                const loadX = labelLeft + slotWidth - loadBtnWidth / 2 - 16;
                const deleteX = loadX - loadBtnWidth / 2 - btnGap - deleteBtnWidth / 2;
                drawSmallButton(ctx, deleteX, y, deleteBtnWidth, deleteBtnHeight, 'Delete', pressed(`delete-${slot.id}`));
                drawSmallButton(ctx, loadX, y, loadBtnWidth, loadBtnHeight, 'Load', pressed(slot.id));
            }
        });

        ctx.textAlign = 'center';
        const backY = height - 52;
        const backW = 120;
        const backH = 38;
        drawSmallButton(ctx, cx, backY, backW, backH, 'Back', pressed('back'));
    },

    getButtonAt(x: number, y: number, options?: MenuRenderOptions): string | null {
        const canvas = options?.canvas;
        const listSaveSlots = options?.listSaveSlots;
        if (!canvas || !listSaveSlots) return null;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const slots = listSaveSlots();
        const rowHeight = 56;
        const startY = height * 0.26;
        const slotWidth = Math.min(420, width - 80);
        const labelLeft = cx - slotWidth / 2;
        const loadBtnWidth = 80;
        const loadBtnHeight = 36;
        const deleteBtnWidth = 64;
        const deleteBtnHeight = 36;
        const btnGap = 10;

        const backY = height - 52;
        const backW = 120;
        const backH = 38;
        if (x >= cx - backW / 2 && x <= cx + backW / 2 && y >= backY - backH / 2 && y <= backY + backH / 2) return 'back';

        for (let i = 0; i < slots.length; i++) {
            if (slots[i].isEmpty) continue;
            const rowY = startY + i * rowHeight;
            const loadX = labelLeft + slotWidth - loadBtnWidth / 2 - 16;
            const deleteX = loadX - loadBtnWidth / 2 - btnGap - deleteBtnWidth / 2;
            if (x >= deleteX - deleteBtnWidth / 2 && x <= deleteX + deleteBtnWidth / 2 && y >= rowY - deleteBtnHeight / 2 && y <= rowY + deleteBtnHeight / 2) {
                return `delete-${slots[i].id}`;
            }
            if (x >= loadX - loadBtnWidth / 2 && x <= loadX + loadBtnWidth / 2 && y >= rowY - loadBtnHeight / 2 && y <= rowY + loadBtnHeight / 2) {
                return slots[i].id;
            }
        }
        return null;
    }
};
