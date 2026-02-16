/**
 * Camera shape used by renderers and systems (world-to-screen).
 */
export interface CameraShape {
  x: number;
  y: number;
  zoom: number;
  toScreenX(worldX: number): number;
  toScreenY(worldY: number): number;
}
