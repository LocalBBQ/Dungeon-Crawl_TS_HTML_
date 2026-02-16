// Factory for render context passed to layer renderers.
import type { CameraShape } from '../../types/camera.ts';
import type { SystemManager } from '../../core/SystemManager.ts';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  camera: CameraShape;
  systems: SystemManager | null;
  settings: Record<string, unknown>;
}

export function createRenderContext(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  camera: CameraShape,
  systems: SystemManager | null,
  settings: Record<string, unknown>
): RenderContext {
  return { ctx, canvas, camera, systems, settings };
}
