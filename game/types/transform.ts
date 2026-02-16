/**
 * Transform component shape: position, size, rotation, scale.
 */
export interface TransformShape {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  entity?: unknown;
  readonly centerX: number;
  readonly centerY: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
