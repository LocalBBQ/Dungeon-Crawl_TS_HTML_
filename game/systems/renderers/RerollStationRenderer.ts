// Renders reroll enchant NPC station and interaction prompt. data: { rerollStation, playerNearRerollStation }
import type { RenderContext } from './RenderContext.js';

interface RerollStationLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class RerollStationRenderer {
  render(context: RenderContext, data: {
    rerollStation?: RerollStationLike | null;
    playerNearRerollStation?: boolean;
    skipInteractionPrompt?: boolean;
    interactionPromptOnly?: boolean;
    /** Prompt line when this station is crafting (hub second station). */
    interactionPromptText?: string;
  }): void {
    const { ctx, canvas, camera } = context;
    const {
      rerollStation,
      playerNearRerollStation,
      skipInteractionPrompt = false,
      interactionPromptOnly = false,
      interactionPromptText = 'Press E to reroll enchantments'
    } = data;
    if (!rerollStation) return;
    const screenX = camera.toScreenX(rerollStation.x);
    const screenY = camera.toScreenY(rerollStation.y);
    const w = rerollStation.width * camera.zoom;
    const h = rerollStation.height * camera.zoom;
    if (screenX + w < 0 || screenX > canvas.width || screenY + h < 0 || screenY > canvas.height) return;

    if (interactionPromptOnly) {
      if (!playerNearRerollStation) return;
      this.drawStationPrompt(ctx, screenX, screenY, w, h, interactionPromptText);
      return;
    }

    // Station: anvil / enchant table (simple rect + icon)
    ctx.fillStyle = '#3d3428';
    ctx.fillRect(screenX, screenY, w, h);
    ctx.strokeStyle = '#6b5a4a';
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(screenX, screenY, w, h);
    ctx.fillStyle = '#7a6b5a';
    ctx.font = '600 10px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Reroll', screenX + w / 2, screenY + h * 0.35);
    ctx.fillText('Enchants', screenX + w / 2, screenY + h * 0.65);

    if (!skipInteractionPrompt && playerNearRerollStation) {
      this.drawStationPrompt(ctx, screenX, screenY, w, h, interactionPromptText);
    }
  }

  private drawStationPrompt(
    ctx: CanvasRenderingContext2D,
    screenX: number,
    screenY: number,
    w: number,
    h: number,
    text: string
  ): void {
    const cx = screenX + w / 2;
    const promptY = screenY - h / 2 - 22;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textMetrics = ctx.measureText(text);
    const padding = 10;
    const bgWidth = textMetrics.width + padding * 2;
    const bgHeight = 22;
    const bgX = cx - bgWidth / 2;
    const bgY = promptY - bgHeight / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(bgX, bgY, bgWidth, bgHeight);
    ctx.fillStyle = '#e8dcc8';
    ctx.fillText(text, cx, promptY);
  }
}
