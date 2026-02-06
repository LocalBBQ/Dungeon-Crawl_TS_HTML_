// Camera for following the player
class Camera {
    constructor(x, y, worldWidth, worldHeight) {
        this.x = x;
        this.y = y;
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.smoothing = 0.1;
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        this.zoomSmoothing = 0.15;
        this.minZoom = 1;
        this.maxZoom = 2.0;
        this.zoomMouseX = 0;
        this.zoomMouseY = 0;
    }

    setZoom(newZoom, mouseX, mouseY, canvasWidth, canvasHeight) {
        // Set target zoom (will be smoothly interpolated)
        this.targetZoom = Utils.clamp(newZoom, this.minZoom, this.maxZoom);
        this.zoomMouseX = mouseX;
        this.zoomMouseY = mouseY;
    }

    updateZoom(canvasWidth, canvasHeight) {
        // Smoothly interpolate zoom towards target
        const oldZoom = this.zoom;
        this.zoom = Utils.lerp(this.zoom, this.targetZoom, this.zoomSmoothing);
        
        // If zoom changed significantly, adjust camera position to zoom towards mouse
        if (Math.abs(this.zoom - oldZoom) > 0.001) {
            const worldX = (this.zoomMouseX / oldZoom) + this.x;
            const worldY = (this.zoomMouseY / oldZoom) + this.y;
            
            // Adjust camera position to maintain zoom point
            this.x = worldX - (this.zoomMouseX / this.zoom);
            this.y = worldY - (this.zoomMouseY / this.zoom);
        }
    }

    follow(target, canvasWidth, canvasHeight) {
        // Calculate desired camera position (centered on target)
        // Account for zoom in the effective viewport size
        const effectiveWidth = canvasWidth / this.zoom;
        const effectiveHeight = canvasHeight / this.zoom;
        
        const targetX = target.x - effectiveWidth / 2;
        const targetY = target.y - effectiveHeight / 2;

        // Smooth camera movement - always follow player, even at world bounds
        this.x = Utils.lerp(this.x, targetX, this.smoothing);
        this.y = Utils.lerp(this.y, targetY, this.smoothing);
    }

    toWorldX(screenX) {
        return (screenX / this.zoom) + this.x;
    }

    toWorldY(screenY) {
        return (screenY / this.zoom) + this.y;
    }

    toScreenX(worldX) {
        return (worldX - this.x) * this.zoom;
    }

    toScreenY(worldY) {
        return (worldY - this.y) * this.zoom;
    }
}

