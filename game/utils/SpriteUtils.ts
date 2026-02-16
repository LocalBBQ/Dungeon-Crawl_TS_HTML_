// Sprite utility functions for direction mapping and animation

export interface SpriteSheetLike {
  image?: HTMLImageElement;
  rows?: number;
  cols?: number;
  frameWidth?: number;
  frameHeight?: number;
}

export interface FrameCoords {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

const SpriteUtils = {
  /** Convert facing angle to 4-direction index: 0=right, 1=down, 2=left, 3=up */
  angleToDirection(angle: number): number {
    const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
    if (normalized >= -Math.PI / 4 && normalized < Math.PI / 4) return 0;
    if (normalized >= Math.PI / 4 && normalized < (3 * Math.PI) / 4) return 1;
    if (normalized >= (3 * Math.PI) / 4 || normalized < (-3 * Math.PI) / 4) return 2;
    return 3;
  },

  getDirectionName(direction: number): string {
    const names = ['right', 'down', 'left', 'up'];
    return names[direction] ?? 'right';
  },

  /** Convert facing angle to 8-direction index for sprite sheet rows. */
  angleTo8Direction(angle: number): number {
    let normalized = angle;
    while (normalized < 0) normalized += Math.PI * 2;
    while (normalized >= Math.PI * 2) normalized -= Math.PI * 2;
    const sectorSize = Math.PI / 4;
    const offset = sectorSize / 2;
    let sector = Math.floor((normalized + offset) / sectorSize);
    if (sector >= 8) sector = 0;
    return sector;
  },

  getFrameCoords(
    spriteSheet: SpriteSheetLike | null,
    row: number,
    col: number
  ): FrameCoords | null {
    if (!spriteSheet?.image) return null;
    const maxRow = Math.max(0, (spriteSheet.rows ?? 1) - 1);
    const maxCol = Math.max(0, (spriteSheet.cols ?? 1) - 1);
    const r = Math.max(0, Math.min(row, maxRow));
    const c = Math.max(0, Math.min(col, maxCol));
    const fw = spriteSheet.frameWidth ?? 0;
    const fh = spriteSheet.frameHeight ?? 0;
    let sourceX = c * fw;
    let sourceY = r * fh;
    let sourceWidth = fw;
    let sourceHeight = fh;
    if (sourceX + sourceWidth > spriteSheet.image.width) {
      sourceWidth = spriteSheet.image.width - sourceX;
    }
    if (sourceY + sourceHeight > spriteSheet.image.height) {
      sourceHeight = spriteSheet.image.height - sourceY;
    }
    if (sourceWidth <= 0 || sourceHeight <= 0) return null;
    return {
      sourceX: Math.floor(sourceX),
      sourceY: Math.floor(sourceY),
      sourceWidth: Math.floor(sourceWidth),
      sourceHeight: Math.floor(sourceHeight),
    };
  },

  getFrameIndex(row: number, col: number, cols: number): number {
    return row * cols + col;
  },

  getRowCol(frameIndex: number, cols: number): { row: number; col: number } {
    return {
      row: Math.floor(frameIndex / cols),
      col: frameIndex % cols,
    };
  },
};

export { SpriteUtils };
