// Transform component - position, rotation, scale
class Transform {
    constructor(x = 0, y = 0, width = 30, height = 30) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rotation = 0;
        this.scale = 1;
        this.entity = null;
    }

    get centerX() {
        return this.x;
    }

    get centerY() {
        return this.y;
    }

    get left() {
        return this.x - this.width / 2;
    }

    get right() {
        return this.x + this.width / 2;
    }

    get top() {
        return this.y - this.height / 2;
    }

    get bottom() {
        return this.y + this.height / 2;
    }
}

