// Obstacle/Environment objects for collision
class Obstacle {
    constructor(x, y, width, height, type = 'tree') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.sprite = null;
        this.spritePath = null;
    }

    checkCollision(entity) {
        const transform = entity.getComponent(Transform);
        if (!transform) return false;

        return Utils.rectCollision(
            this.x, this.y, this.width, this.height,
            transform.left, transform.top, transform.width, transform.height
        );
    }
}

if (typeof window !== 'undefined') {
    window.Obstacle = Obstacle;
}
