/**
 * Base type for ECS components. Entity stores components in a Map and calls
 * optional lifecycle methods (onAdd, onRemove, onDestroy, update).
 */
export interface Component {
  entity?: unknown;
  onAdd?(): void;
  onRemove?(): void;
  onDestroy?(): void;
  update?(deltaTime: number, systems?: unknown): void;
}
