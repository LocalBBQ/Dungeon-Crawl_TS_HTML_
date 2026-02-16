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

    /** Ease-in quadratic (t in 0..1): slow start, then accelerates. Used for spin rotation and dash ramp. */
    easeInQuad(t) {
        const x = Math.max(0, Math.min(1, t));
        return x * x;
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
    },

    // Check if a point is within the swept portion of a slash (arc from start to current blade position).
    // sweepProgress 0 = no arc swept, 1 = full arc swept. Matches slash rendering: blade at facingAngle - halfArc + sweepProgress * arcAngle.
    pointInSweptArc(px, py, centerX, centerY, facingAngle, arcAngle, sweepProgress, maxDistance) {
        const dist = this.distance(px, py, centerX, centerY);
        if (dist > maxDistance) return false;
        if (sweepProgress <= 0) return false;
        const halfArc = arcAngle / 2;
        const sweepStart = facingAngle - halfArc;
        const angleToPoint = this.angleTo(centerX, centerY, px, py);
        const rel = this.normalizeAngle(angleToPoint - sweepStart);
        const sweptAngle = sweepProgress * arcAngle;
        return rel >= 0 && rel <= sweptAngle;
    },

    // Check if a point is within a rectangle thrust forward from a position
    // originX, originY = start of thrust; facingAngle = direction; length = thrust range; halfWidth = half-width perpendicular to thrust
    pointInThrustRect(px, py, originX, originY, facingAngle, length, halfWidth) {
        const dx = px - originX;
        const dy = py - originY;
        const along = dx * Math.cos(facingAngle) + dy * Math.sin(facingAngle);
        const perp = -dx * Math.sin(facingAngle) + dy * Math.cos(facingAngle);
        return along >= 0 && along <= length && Math.abs(perp) <= halfWidth;
    }
};

