// Centralized system manager
class SystemManager {
    constructor() {
        this.systems = new Map();
        this.eventBus = new EventBus();
    }

    register(name, system) {
        this.systems.set(name, system);
        if (system.init) {
            system.init(this);
        }
        return this;
    }

    get(name) {
        return this.systems.get(name);
    }

    update(deltaTime) {
        for (const system of this.systems.values()) {
            if (system.update) {
                system.update(deltaTime, this);
            }
        }
    }

    destroy() {
        for (const system of this.systems.values()) {
            if (system.destroy) {
                system.destroy();
            }
        }
        this.systems.clear();
        this.eventBus.clear();
    }
}

