/**
 * Minimal pipeline test: SystemManager + EntityManager + Entity with Transform.
 * Ensures the ECS update loop runs without throwing.
 */
import { describe, it, expect } from 'vitest';
import { SystemManager } from '../../game/core/SystemManager.js';
import { EntityManager } from '../../game/managers/EntityManager.js';
import { Entity } from '../../game/entities/Entity.js';
import { Transform } from '../../game/components/Transform.js';

describe('ECS pipeline', () => {
  it('runs one update with entities and transform', () => {
    const systems = new SystemManager();
    const entities = new EntityManager();
    systems.register('entities', entities);

    const entity = new Entity(100, 200, 'test-1');
    entity.addComponent(new Transform(100, 200));
    entities.add(entity, 'default');

    systems.setUpdateOrder(['entities']);
    expect(() => systems.update(0.016)).not.toThrow();
    expect(entities.get('test-1')).toBe(entity);
    const t = entity.getComponent(Transform);
    expect(t).not.toBeNull();
    expect(t!.x).toBe(100);
    expect(t!.y).toBe(200);
  });
});
