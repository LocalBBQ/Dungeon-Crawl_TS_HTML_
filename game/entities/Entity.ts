// Base entity class with component support
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';

type ComponentCtor = new (...args: unknown[]) => unknown;

export class Entity {
  id: string;
  components: Map<string, unknown>;
  active: boolean;
  systems?: SystemsMap;

  constructor(x: number, y: number, id: string | null = null) {
    this.id = id ?? `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.components = new Map();
    this.active = true;
  }

  addComponent(component: Component & { constructor: { name: string } }): this {
    this.components.set(component.constructor.name, component);
    component.entity = this;
    if (component.onAdd) component.onAdd();
    return this;
  }

  getComponent<T>(componentClass: new (...args: unknown[]) => T): T | null {
    const direct = this.components.get(componentClass.name);
    if (direct != null && direct instanceof componentClass) return direct as T;
    for (const component of this.components.values()) {
      if (component instanceof (componentClass as ComponentCtor)) return component as T;
    }
    return null;
  }

  hasComponent(componentClass: new (...args: unknown[]) => unknown): boolean {
    if (this.components.has(componentClass.name)) return true;
    for (const component of this.components.values()) {
      if (component instanceof (componentClass as ComponentCtor)) return true;
    }
    return false;
  }

  removeComponent(componentClass: new (...args: unknown[]) => unknown): this {
    const component = this.components.get(componentClass.name) as Component | undefined;
    if (component?.onRemove) component.onRemove();
    this.components.delete(componentClass.name);
    return this;
  }

  update(deltaTime: number, systems?: SystemsMap): void {
    if (!this.active) return;
    this.systems = systems;
    for (const component of this.components.values()) {
      const c = component as Component;
      if (c.update) c.update(deltaTime, systems);
    }
  }

  destroy(): void {
    this.active = false;
    for (const component of this.components.values()) {
      const c = component as Component;
      if (c.onDestroy) c.onDestroy();
    }
    this.components.clear();
  }
}
