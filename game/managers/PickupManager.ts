/**
 * Unified pickup manager: gold, weapon, whetstone, health orb.
 * Replaces GoldPickupManager, WeaponPickupManager, WhetstonePickupManager, HealthOrbManager.
 */
import { Transform } from '../components/Transform.js';
import { Health } from '../components/Health.js';
import { PlayerHealing } from '../components/PlayerHealing.js';
import type { SystemManager } from '../core/SystemManager.js';
import type { CameraShape } from '../types/camera.js';
import type { EntityShape } from '../types/entity.js';
import type { WeaponInstance } from '../state/PlayingState.js';

export type PickupType = 'gold' | 'weapon' | 'whetstone' | 'healthOrb';

interface BasePickup {
  id: string;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
  age: number;
  pulsePhase: number;
}

export interface GoldPickupItem extends BasePickup {
  type: 'gold';
  amount: number;
}

export interface WeaponPickupItem extends BasePickup {
  type: 'weapon';
  instance: WeaponInstance;
}

export interface WhetstonePickupItem extends BasePickup {
  type: 'whetstone';
}

export interface HealthOrbPickupItem extends BasePickup {
  type: 'healthOrb';
  healthAmount: number;
}

export type PickupItem = GoldPickupItem | WeaponPickupItem | WhetstonePickupItem | HealthOrbPickupItem;

export type OnGoldCollected = (amount: number) => void;
export type OnWeaponCollected = (instance: WeaponInstance) => void;
/** Return false to leave the pickup in the world (e.g. inventory full). */
export type OnWhetstoneCollected = () => boolean | void;

export class PickupManager {
  items: PickupItem[] = [];
  onGoldCollected: OnGoldCollected | null = null;
  onWeaponCollected: OnWeaponCollected | null = null;
  onWhetstoneCollected: OnWhetstoneCollected | null = null;

  spawnGold(x: number, y: number, amount: number): GoldPickupItem {
    const item: GoldPickupItem = {
      id: `gold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'gold',
      x, y, amount,
      radius: 4,
      lifetime: 60,
      age: 0,
      pulsePhase: 0
    };
    this.items.push(item);
    return item;
  }

  spawnWeapon(x: number, y: number, instance: WeaponInstance): WeaponPickupItem {
    const item: WeaponPickupItem = {
      id: `weapon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'weapon',
      x, y, instance,
      radius: 8,
      lifetime: 120,
      age: 0,
      pulsePhase: 0
    };
    this.items.push(item);
    return item;
  }

  spawnWhetstone(x: number, y: number): WhetstonePickupItem {
    const item: WhetstonePickupItem = {
      id: `whetstone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'whetstone',
      x, y,
      radius: 6,
      lifetime: 90,
      age: 0,
      pulsePhase: 0
    };
    this.items.push(item);
    return item;
  }

  spawnHealthOrb(x: number, y: number, healthAmount = 20): HealthOrbPickupItem {
    const item: HealthOrbPickupItem = {
      id: `orb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'healthOrb',
      x, y, healthAmount,
      radius: 8,
      lifetime: 10.0,
      age: 0,
      pulsePhase: 0
    };
    this.items.push(item);
    return item;
  }

  update(deltaTime: number, systems: SystemManager | null): void {
    const entityManager = systems ? systems.get<{ get(id: string): EntityShape | undefined }>('entities') : null;
    const player = entityManager ? entityManager.get('player') : null;
    if (!player) return;
    const playerTransform = player.getComponent(Transform);
    if (!playerTransform) return;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age += deltaTime;
      if (item.type === 'healthOrb') item.pulsePhase += deltaTime * 3;
      if (item.age >= item.lifetime) {
        this.items.splice(i, 1);
        continue;
      }
      const dx = playerTransform.x - item.x;
      const dy = playerTransform.y - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pickupRadius = item.radius + playerTransform.width / 2;
      if (distance >= pickupRadius) continue;

      let remove = true;
      switch (item.type) {
        case 'gold':
          if (this.onGoldCollected) this.onGoldCollected(item.amount);
          break;
        case 'weapon':
          if (this.onWeaponCollected) this.onWeaponCollected(item.instance);
          break;
        case 'whetstone':
          const consumed = this.onWhetstoneCollected ? this.onWhetstoneCollected() : true;
          if (consumed === false) remove = false;
          break;
        case 'healthOrb': {
          const playerHealing = player.getComponent(PlayerHealing);
          if (playerHealing) {
            playerHealing.charges = Math.min(playerHealing.maxCharges, playerHealing.charges + 1);
          }
          break;
        }
      }
      if (remove) this.items.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: CameraShape): void {
    for (const item of this.items) {
      const screenX = camera.toScreenX(item.x);
      const screenY = camera.toScreenY(item.y);
      if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
          screenY < -50 || screenY > ctx.canvas.height + 50) continue;
      switch (item.type) {
        case 'gold':
          this._renderGold(ctx, camera, item, screenX, screenY);
          break;
        case 'weapon':
          this._renderWeapon(ctx, camera, item, screenX, screenY);
          break;
        case 'whetstone':
          this._renderWhetstone(ctx, camera, item, screenX, screenY);
          break;
        case 'healthOrb':
          this._renderHealthOrb(ctx, camera, item, screenX, screenY);
          break;
      }
    }
  }

  private _renderGold(ctx: CanvasRenderingContext2D, camera: CameraShape, item: GoldPickupItem, screenX: number, screenY: number): void {
    const radius = item.radius * camera.zoom;
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius * 2);
    gradient.addColorStop(0, 'rgba(255, 200, 50, 0.7)');
    gradient.addColorStop(0.5, 'rgba(220, 170, 40, 0.35)');
    gradient.addColorStop(1, 'rgba(200, 150, 30, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b828';
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5d050';
    ctx.beginPath();
    ctx.arc(screenX - radius * 0.25, screenY - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  private _renderWeapon(ctx: CanvasRenderingContext2D, camera: CameraShape, item: WeaponPickupItem, screenX: number, screenY: number): void {
    const radius = item.radius * camera.zoom;
    item.pulsePhase += 0.08;
    const pulse = 1 + Math.sin(item.pulsePhase) * 0.15;
    const r = radius * pulse;
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, r * 2);
    gradient.addColorStop(0, 'rgba(180, 140, 80, 0.6)');
    gradient.addColorStop(0.5, 'rgba(120, 90, 50, 0.3)');
    gradient.addColorStop(1, 'rgba(80, 60, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8dcc8';
    ctx.font = '600 10px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Weapon', screenX, screenY + r + 12);
  }

  private _renderWhetstone(ctx: CanvasRenderingContext2D, camera: CameraShape, item: WhetstonePickupItem, screenX: number, screenY: number): void {
    const radius = item.radius * camera.zoom;
    item.pulsePhase += 0.06;
    const pulse = 1 + Math.sin(item.pulsePhase) * 0.12;
    const r = radius * pulse;
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, r * 2);
    gradient.addColorStop(0, 'rgba(160, 150, 140, 0.65)');
    gradient.addColorStop(0.5, 'rgba(100, 95, 90, 0.35)');
    gradient.addColorStop(1, 'rgba(70, 65, 60, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, r * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 170, 160, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c4b8a8';
    ctx.font = '600 10px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Whetstone', screenX, screenY + r + 12);
  }

  private _renderHealthOrb(ctx: CanvasRenderingContext2D, camera: CameraShape, item: HealthOrbPickupItem, screenX: number, screenY: number): void {
    const pulseSize = 1.0 + Math.sin(item.pulsePhase) * 0.2;
    const radius = item.radius * camera.zoom * pulseSize;
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius * 2);
    gradient.addColorStop(0, 'rgba(255, 50, 50, 0.6)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 100, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 150, 150, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6666';
    ctx.beginPath();
    ctx.arc(screenX - radius * 0.3, screenY - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  clear(): void {
    this.items = [];
  }
}
