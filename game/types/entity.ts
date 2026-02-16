/**
 * Shape of an Entity for typing. Components are stored by constructor name.
 */
export interface EntityShape {
  id: string;
  active: boolean;
  components: Map<string, unknown>;
  systems?: unknown;
  onHealthChanged?(current: number, max: number): void;
  getComponent<T>(componentClass: new (...args: unknown[]) => T): T | null;
  hasComponent(componentClass: new (...args: unknown[]) => unknown): boolean;
  addComponent(component: unknown): this;
  removeComponent(componentClass: new (...args: unknown[]) => unknown): this;
  update(deltaTime: number, systems?: unknown): void;
  destroy(): void;
}
