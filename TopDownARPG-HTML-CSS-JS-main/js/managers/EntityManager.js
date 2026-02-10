// Entity Manager - manages all game entities
class EntityManager {
    constructor() {
        this.entities = new Map();
        this.entityGroups = new Map();
    }

    add(entity, group = 'default') {
        this.entities.set(entity.id, entity);
        
        if (!this.entityGroups.has(group)) {
            this.entityGroups.set(group, []);
        }
        this.entityGroups.get(group).push(entity);
        
        return entity;
    }

    remove(entityId) {
        const entity = this.entities.get(entityId);
        if (entity) {
            entity.destroy();
            this.entities.delete(entityId);
            
            for (const group of this.entityGroups.values()) {
                const index = group.indexOf(entity);
                if (index > -1) {
                    group.splice(index, 1);
                }
            }
        }
    }

    get(entityId) {
        return this.entities.get(entityId);
    }

    getAll(group = null) {
        if (group) {
            return this.entityGroups.get(group) || [];
        }
        return Array.from(this.entities.values());
    }

    update(deltaTime, systems) {
        // Store systems reference
        this.systems = systems;
        
        for (const entity of this.entities.values()) {
            entity.update(deltaTime, systems);
        }
    }
    
    // Make EntityManager compatible with SystemManager
    init(systems) {
        this.systems = systems;
    }

    clear() {
        for (const entity of this.entities.values()) {
            entity.destroy();
        }
        this.entities.clear();
        this.entityGroups.clear();
    }
}

