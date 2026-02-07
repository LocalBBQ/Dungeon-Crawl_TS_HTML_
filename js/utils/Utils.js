// Utility functions for the game

const FULL_CIRCLE_DEGREES = 360;

const Utils = {
    // Convert degrees to radians (for config/design values)
    degToRad(degrees) {
        return degrees * Math.PI / 180;
    },
    // Calculate distance between two points
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    // Normalize a vector
    normalize(x, y) {
        const length = Math.sqrt(x * x + y * y);
        if (length === 0) return { x: 0, y: 0 };
        return { x: x / length, y: y / length };
    },

    // Linear interpolation
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },

    // Clamp a value between min and max
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    // Check collision between two rectangles
    rectCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    },

    // Random number between min and max
    random(min, max) {
        return Math.random() * (max - min) + min;
    },

    // Random integer between min and max (inclusive)
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    // Calculate angle between two points in radians
    angleTo(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    // Normalize angle to be between -PI and PI
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= 2 * Math.PI;
        while (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    },

    // Check if a point is within an arc (cone) in front of a position
    // Returns true if the point is within the arc
    pointInArc(px, py, centerX, centerY, facingAngle, arcAngle, maxDistance) {
        const dist = this.distance(px, py, centerX, centerY);
        if (dist > maxDistance) return false;
        
        const angleToPoint = this.angleTo(centerX, centerY, px, py);
        const angleDiff = this.normalizeAngle(angleToPoint - facingAngle);
        
        return Math.abs(angleDiff) <= arcAngle / 2;
    }
};

