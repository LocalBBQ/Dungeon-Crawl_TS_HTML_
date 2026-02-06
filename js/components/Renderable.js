// Renderable component - defines how entity should be rendered
class Renderable {
    constructor(type, config = {}) {
        this.type = type; // 'player', 'enemy', 'obstacle', etc.
        this.color = config.color || '#ffffff';
        this.entity = null;
    }

    setColor(color) {
        this.color = color;
    }
}

