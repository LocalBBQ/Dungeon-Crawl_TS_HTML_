/**
 * Unified pickup manager: gold, weapon, whetstone.
 * Heal charges are restored via gathering only.
 */
import { Transform } from '../components/Transform.js';
import type { SystemManager } from '../core/SystemManager.js';
import type { CameraShape } from '../types/camera.js';
import type { EntityShape } from '../types/entity.js';
import type { WeaponInstance } from '../state/PlayingState.js';
import { drawWeaponIcon, getWeaponDisplayName } from '../ui/InventoryChestCanvas.js';
import { drawHoneyIcon, drawPageIcon } from '../graphics/herbMushroomIcons.js';

export type PickupType = 'gold' | 'weapon' | 'whetstone' | 'honey' | 'page';

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
  /** Collection range (radius); visual size uses BasePickup.radius. */
  pickupRadius: number;
}

export interface WeaponPickupItem extends BasePickup {
  type: 'weapon';
  instance: WeaponInstance;
}

export interface WhetstonePickupItem extends BasePickup {
  type: 'whetstone';
}

export interface HoneyPickupItem extends BasePickup {
  type: 'honey';
}

export interface PagePickupItem extends BasePickup {
  type: 'page';
}

export type PickupItem = GoldPickupItem | WeaponPickupItem | WhetstonePickupItem | HoneyPickupItem | PagePickupItem;

export type OnGoldCollected = (amount: number) => void;
export type OnWeaponCollected = (instance: WeaponInstance) => void;
/** Return false to leave the pickup in the world (e.g. inventory full). */
export type OnWhetstoneCollected = () => boolean | void;
export type OnHoneyCollected = () => void;
export type OnPageCollected = () => void;

export class PickupManager {
  items: PickupItem[] = [];
  onGoldCollected: OnGoldCollected | null = null;
  onWeaponCollected: OnWeaponCollected | null = null;
  onWhetstoneCollected: OnWhetstoneCollected | null = null;
  onHoneyCollected: OnHoneyCollected | null = null;
  onPageCollected: OnPageCollected | null = null;

  spawnGold(x: number, y: number, amount: number): GoldPickupItem {
    const item: GoldPickupItem = {
      id: `gold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'gold',
      x, y, amount,
      radius: 4,
      pickupRadius: 20,
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

  spawnHoney(x: number, y: number): HoneyPickupItem {
    const item: HoneyPickupItem = {
      id: `honey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'honey',
      x, y,
      radius: 6,
      lifetime: 90,
      age: 0,
      pulsePhase: 0
    };
    this.items.push(item);
    return item;
  }

  spawnPage(x: number, y: number): PagePickupItem {
    const item: PagePickupItem = {
      id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'page',
      x, y,
      radius: 6,
      lifetime: 90,
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
      if (item.age >= item.lifetime) {
        this.items.splice(i, 1);
        continue;
      }
      const dx = playerTransform.x - item.x;
      const dy = playerTransform.y - item.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const effectiveRadius = item.type === 'gold' ? item.pickupRadius : item.radius;
      const pickupRadius = effectiveRadius + playerTransform.width / 2;
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
        case 'honey':
          if (this.onHoneyCollected) this.onHoneyCollected();
          break;
        case 'page':
          if (this.onPageCollected) this.onPageCollected();
          break;
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
        case 'honey':
          this._renderHoney(ctx, camera, item, screenX, screenY);
          break;
        case 'page':
          this._renderPage(ctx, camera, item, screenX, screenY);
          break;
      }
    }
  }

  private _renderGold(ctx: CanvasRenderingContext2D, camera: CameraShape, item: GoldPickupItem, screenX: number, screenY: number): void {
    const radius = item.radius * camera.zoom;
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
    const iconSize = Math.max(14, radius * 2.4);
    drawWeaponIcon(ctx, screenX, screenY, iconSize, item.instance.key);
    const name = getWeaponDisplayName(item.instance.key, item.instance);
    const textY = screenY + Math.max(radius, iconSize) + 14;
    ctx.fillStyle = '#e0c8a0';
    ctx.font = '600 11px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, screenX, textY);
  }

  private _renderWhetstone(ctx: CanvasRenderingContext2D, camera: CameraShape, item: WhetstonePickupItem, screenX: number, screenY: number): void {
    const radius = item.radius * camera.zoom;
    ctx.fillStyle = '#c4b8a8';
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 170, 160, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c4b8a8';
    ctx.font = '600 10px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Whetstone', screenX, screenY + radius + 12);
  }

  private _renderHoney(ctx: CanvasRenderingContext2D, camera: CameraShape, item: HoneyPickupItem, screenX: number, screenY: number): void {
    const radius = item.radius * camera.zoom;
    const iconSize = Math.max(14, radius * 2.2);
    drawHoneyIcon(ctx, screenX, screenY, iconSize);
    ctx.fillStyle = '#e0c8a0';
    ctx.font = '600 10px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Honey', screenX, screenY + iconSize + 12);
  }

  private _renderPage(ctx: CanvasRenderingContext2D, camera: CameraShape, item: PagePickupItem, screenX: number, screenY: number): void {
    const radius = item.radius * camera.zoom;
    const iconSize = Math.max(14, radius * 2.2);
    drawPageIcon(ctx, screenX, screenY, iconSize);
    ctx.fillStyle = '#e0c8a0';
    ctx.font = '600 10px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Page', screenX, screenY + iconSize + 12);
  }

  clear(): void {
    this.items = [];
  }
}
