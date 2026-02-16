// Base entity class with component support
class Entity {
    constructor(x, y, id = null) {
        this.id = id || `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.components = new Map();
        this.active = true;
    }

    addComponent(component) {
        this.components.set(component.constructor.name, component);
        component.entity = this;
        if (component.onAdd) {
            component.onAdd();
        }
        return this;
    }

    getComponent(componentClass) {
        // First try direct lookup
        const direct = this.components.get(componentClass.name);
        if (direct) return direct;
        
        // If not found, check for subclasses (for inheritance support)
        for (const component of this.components.values()) {
            if (component instanceof componentClass) {
                return component;
            }
        }
        
        return null;
    }

    hasComponent(componentClass) {
        // First try direct lookup
        if (this.components.has(componentClass.name)) {
            return true;
        }
        
        // If not found, check for subclasses (for inheritance support)
        for (const component of this.components.values()) {
            if (component instanceof componentClass) {
                return true;
            }
        }
        
        return false;
    }

    removeComponent(componentClass) {
        const component = this.components.get(componentClass.name);
        if (component && component.onRemove) {
            component.onRemove();
        }
        this.components.delete(componentClass.name);
        return this;
    }

    update(deltaTime, systems) {
        if (!this.active) return;
        
        // Store systems reference for components
        this.systems = systems;
        
        // Update all components
        for (const component of this.components.values()) {
            if (component.update) {
                component.update(deltaTime, systems);
            }
        }
    }

    destroy() {
        this.active = false;
        for (const component of this.components.values()) {
            if (component.onDestroy) {
                component.onDestroy();
            }
        }
        this.components.clear();
    }
}

