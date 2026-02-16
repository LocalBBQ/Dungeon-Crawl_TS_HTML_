// Camera System
import { GameConfig } from '../config/GameConfig.ts';
import { Utils } from '../utils/Utils.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import type { GameConfigShape } from '../types/config.js';

interface TransformLike {
  x: number;
  y: number;
}

export class CameraSystem {
  x: number;
  y: number;
  worldWidth: number;
  worldHeight: number;
  smoothing: number;
  zoom: number;
  targetZoom: number;
  zoomSmoothing: number;
  minZoom: number;
  maxZoom: number;
  zoomMouseX: number;
  zoomMouseY: number;
  shakeIntensity: number;
  shakeOffsetX: number;
  shakeOffsetY: number;
  systems: SystemManager | null;
  private config: GameConfigShape = GameConfig;

  constructor(worldWidth: number, worldHeight: number) {
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
    this.systems = null;
  }

  addShake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  init(systems: SystemManager): void {
    this.systems = systems;
    const cfg = systems.get<GameConfigShape>('config');
    if (cfg) this.config = cfg;
  }

  setZoom(newZoom: number, mouseX: number, mouseY: number, _canvasWidth?: number, _canvasHeight?: number): void {
    this.targetZoom = Utils.clamp(newZoom, this.minZoom, this.maxZoom);
    this.zoomMouseX = mouseX;
    this.zoomMouseY = mouseY;
  }

  update(deltaTime: number, _systems?: SystemManager): void {
    if (this.shakeIntensity > 0) {
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity *= 0.85;
      if (this.shakeIntensity < 0.5) this.shakeIntensity = 0;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
    const oldZoom = this.zoom;
    this.zoom = Utils.lerp(this.zoom, this.targetZoom, this.zoomSmoothing);
    if (Math.abs(this.zoom - oldZoom) > 0.001) {
      const worldX = this.zoomMouseX / oldZoom + this.x;
      const worldY = this.zoomMouseY / oldZoom + this.y;
      this.x = worldX - this.zoomMouseX / this.zoom;
      this.y = worldY - this.zoomMouseY / this.zoom;
    }
  }

  setWorldBounds(worldWidth: number, worldHeight: number): void {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  follow(transform: TransformLike | null, canvasWidth: number, canvasHeight: number, options: { fastFollow?: boolean } = {}): void {
    if (!transform) return;
    const effectiveWidth = canvasWidth / this.zoom;
    const effectiveHeight = canvasHeight / this.zoom;
    let targetX = transform.x - effectiveWidth / 2;
    let targetY = transform.y - effectiveHeight / 2;
    targetX = Utils.clamp(targetX, 0, Math.max(0, this.worldWidth - effectiveWidth));
    targetY = Utils.clamp(targetY, 0, Math.max(0, this.worldHeight - effectiveHeight));
    const smoothing =
      options.fastFollow && (this.config.camera as { fastFollowSmoothing?: number }).fastFollowSmoothing != null
        ? (this.config.camera as { fastFollowSmoothing: number }).fastFollowSmoothing
        : this.smoothing;
    this.x = Utils.lerp(this.x, targetX, smoothing);
    this.y = Utils.lerp(this.y, targetY, smoothing);
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return { x: screenX / this.zoom + this.x, y: screenY / this.zoom + this.y };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + this.shakeOffsetX,
      y: (worldY - this.y) * this.zoom + this.shakeOffsetY,
    };
  }

  toWorldX(screenX: number): number {
    return screenX / this.zoom + this.x;
  }

  toWorldY(screenY: number): number {
    return screenY / this.zoom + this.y;
  }

  toScreenX(worldX: number): number {
    return (worldX - this.x) * this.zoom + this.shakeOffsetX;
  }

  toScreenY(worldY: number): number {
    return (worldY - this.y) * this.zoom + this.shakeOffsetY;
  }
}
