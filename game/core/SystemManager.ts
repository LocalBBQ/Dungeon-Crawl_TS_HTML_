// Centralized system manager
// Lean ECS pattern: systems may query entities by component set (e.g. get('entities').getAll(),
// then filter by entity.getComponent(Transform) && entity.getComponent(Movement)) and implement
// behavior in their update(); components remain the data store. No formal ECS library required.
import { EventBus } from './EventBus.ts';
import type { GameSystems } from '../types/systems.js';

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

  /** Type-safe access to all registered systems. Prefer over get(name) when types are known. */
  getTyped(): GameSystems {
    const s = this;
    return {
      get config() { return s.systems.get('config') as GameSystems['config']; },
      get playingState() { return s.systems.get('playingState') as GameSystems['playingState']; },
      get entities() { return s.systems.get('entities') as GameSystems['entities']; },
      get sprites() { return s.systems.get('sprites') as GameSystems['sprites']; },
      get input() { return s.systems.get('input') as GameSystems['input']; },
      get camera() { return s.systems.get('camera') as GameSystems['camera']; },
      get collision() { return s.systems.get('collision') as GameSystems['collision']; },
      get obstacles() { return s.systems.get('obstacles') as GameSystems['obstacles']; },
      get gatherables() { return s.systems.get('gatherables') as GameSystems['gatherables']; },
      get pathfinding() { return s.systems.get('pathfinding') as GameSystems['pathfinding']; },
      get enemies() { return s.systems.get('enemies') as GameSystems['enemies']; },
      get hazards() { return s.systems.get('hazards') as GameSystems['hazards']; },
      get damageNumbers() { return s.systems.get('damageNumbers') as GameSystems['damageNumbers']; },
      get projectiles() { return s.systems.get('projectiles') as GameSystems['projectiles']; },
      get pickups() { return s.systems.get('pickups') as GameSystems['pickups']; },
      get render() { return s.systems.get('render') as GameSystems['render']; },
    } as GameSystems;
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
