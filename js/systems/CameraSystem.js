// Camera System
class CameraSystem {
    constructor(worldWidth, worldHeight) {
        this.x = 0;
        this.y = 0;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.smoothing = GameConfig.camera.smoothing;
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        this.zoomSmoothing = 0.15;
        this.minZoom = GameConfig.camera.minZoom;
        this.maxZoom = GameConfig.camera.maxZoom;
        this.zoomMouseX = 0;
        this.zoomMouseY = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
    }

    addShake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    init(systems) {
        this.systems = systems;
    }

    setZoom(newZoom, mouseX, mouseY, canvasWidth, canvasHeight) {
        this.targetZoom = Utils.clamp(newZoom, this.minZoom, this.maxZoom);
        this.zoomMouseX = mouseX;
        this.zoomMouseY = mouseY;
    }

    update(deltaTime, systems) {
        // Decay screen shake
        if (this.shakeIntensity > 0) {
            this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            this.shakeIntensity *= 0.85;
            if (this.shakeIntensity < 0.5) this.shakeIntensity = 0;
        } else {
            this.shakeOffsetX = 0;
            this.shakeOffsetY = 0;
        }

        // Smoothly interpolate zoom towards target
        const oldZoom = this.zoom;
        this.zoom = Utils.lerp(this.zoom, this.targetZoom, this.zoomSmoothing);

        // If zoom changed significantly, adjust camera position to zoom towards mouse
        if (Math.abs(this.zoom - oldZoom) > 0.001) {
            const worldX = (this.zoomMouseX / oldZoom) + this.x;
            const worldY = (this.zoomMouseY / oldZoom) + this.y;

            this.x = worldX - (this.zoomMouseX / this.zoom);
            this.y = worldY - (this.zoomMouseY / this.zoom);
        }
    }

    setWorldBounds(worldWidth, worldHeight) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
    }

    follow(transform, canvasWidth, canvasHeight, options = {}) {
        if (!transform) return;
        
        const effectiveWidth = canvasWidth / this.zoom;
        const effectiveHeight = canvasHeight / this.zoom;
        
        let targetX = transform.x - effectiveWidth / 2;
        let targetY = transform.y - effectiveHeight / 2;

        targetX = Utils.clamp(targetX, 0, Math.max(0, this.worldWidth - effectiveWidth));
        targetY = Utils.clamp(targetY, 0, Math.max(0, this.worldHeight - effectiveHeight));

        const smoothing = options.fastFollow && GameConfig.camera.fastFollowSmoothing != null
            ? GameConfig.camera.fastFollowSmoothing
            : this.smoothing;
        this.x = Utils.lerp(this.x, targetX, smoothing);
        this.y = Utils.lerp(this.y, targetY, smoothing);
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX / this.zoom) + this.x,
            y: (screenY / this.zoom) + this.y
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom + this.shakeOffsetX,
            y: (worldY - this.y) * this.zoom + this.shakeOffsetY
        };
    }

    toWorldX(screenX) {
        return (screenX / this.zoom) + this.x;
    }

    toWorldY(screenY) {
        return (screenY / this.zoom) + this.y;
    }

    toScreenX(worldX) {
        return (worldX - this.x) * this.zoom + this.shakeOffsetX;
    }

    toScreenY(worldY) {
        return (worldY - this.y) * this.zoom + this.shakeOffsetY;
    }
}

