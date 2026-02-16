// Entity Manager - manages all game entities
import type { SystemManager } from '../core/SystemManager.ts';
import type { EntityShape } from '../types/entity.js';

export class EntityManager {
  entities: Map<string, EntityShape>;
  entityGroups: Map<string, EntityShape[]>;
  systems: SystemManager | null;

  constructor() {
    this.entities = new Map();
    this.entityGroups = new Map();
    this.systems = null;
  }

  add(entity: EntityShape, group = 'default'): EntityShape {
    this.entities.set(entity.id, entity);
    if (!this.entityGroups.has(group)) {
      this.entityGroups.set(group, []);
    }
    this.entityGroups.get(group)!.push(entity);
    return entity;
  }

  remove(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.destroy();
      this.entities.delete(entityId);
      for (const group of this.entityGroups.values()) {
        const index = group.indexOf(entity);
        if (index > -1) group.splice(index, 1);
      }
    }
  }

  get(entityId: string): EntityShape | undefined {
    return this.entities.get(entityId);
  }

  getAll(group: string | null = null): EntityShape[] {
    if (group) {
      return this.entityGroups.get(group) || [];
    }
    return Array.from(this.entities.values());
  }

  update(deltaTime: number, systems: SystemManager): void {
    this.systems = systems;
    for (const entity of this.entities.values()) {
      entity.update(deltaTime, systems);
    }
  }

  init(systems: SystemManager): void {
    this.systems = systems;
  }

  clear(): void {
    for (const entity of this.entities.values()) {
      entity.destroy();
    }
    this.entities.clear();
    this.entityGroups.clear();
  }
}
