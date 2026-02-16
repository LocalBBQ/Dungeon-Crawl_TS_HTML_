// Centralized system manager
// Lean ECS pattern: systems may query entities by component set (e.g. get('entities').getAll(),
// then filter by entity.getComponent(Transform) && entity.getComponent(Movement)) and implement
// behavior in their update(); components remain the data store. No formal ECS library required.
import { EventBus } from './EventBus.ts';

export interface SystemLike {
  init?(systems: SystemManager): void;
  update?(deltaTime: number, systems: SystemManager): void;
  destroy?(): void;
}

export class SystemManager {
  systems: Map<string, SystemLike>;
  eventBus: EventBus;
  /** When set, update() runs systems in this order; otherwise Map insertion order. */
  updateOrder: string[] | null = null;

  constructor() {
    this.systems = new Map();
    this.eventBus = new EventBus();
  }

  setUpdateOrder(order: string[]): this {
    this.updateOrder = order;
    return this;
  }

  register(name: string, system: SystemLike): this {
    this.systems.set(name, system);
    if (system.init) {
      system.init(this);
    }
    return this;
  }

  get<T = SystemLike>(name: string): T | undefined {
    return this.systems.get(name) as T | undefined;
  }

  update(deltaTime: number): void {
    if (this.updateOrder && this.updateOrder.length > 0) {
      for (const name of this.updateOrder) {
        const system = this.systems.get(name);
        if (system?.update) system.update(deltaTime, this);
      }
    } else {
      for (const system of this.systems.values()) {
        if (system.update) system.update(deltaTime, this);
      }
    }
  }

  destroy(): void {
    for (const system of this.systems.values()) {
      if (system.destroy) {
        system.destroy();
      }
    }
    this.systems.clear();
    this.eventBus.clear();
  }
}
