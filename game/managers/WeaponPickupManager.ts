// Weapon pickup manager: weapon drops from enemies, picked up by walking over.
import { Transform } from '../components/Transform.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import type { CameraShape } from '../types/camera.ts';
import type { EntityShape } from '../types/entity.ts';
import type { WeaponInstance } from '../state/PlayingState.js';

export interface WeaponPickup {
  id: string;
  x: number;
  y: number;
  instance: WeaponInstance;
  radius: number;
  lifetime: number;
  age: number;
  pulsePhase: number;
}

export type OnWeaponCollected = (instance: WeaponInstance) => void;

export class WeaponPickupManager {
  pickups: WeaponPickup[] = [];
  onCollected: OnWeaponCollected | null = null;

  spawn(x: number, y: number, instance: WeaponInstance): WeaponPickup {
    const pickup: WeaponPickup = {
      id: `weapon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      instance,
      radius: 8,
      lifetime: 120,
      age: 0,
      pulsePhase: 0
    };
    this.pickups.push(pickup);
    return pickup;
  }

  update(deltaTime: number, systems: SystemManager | null): void {
    const entityManager = systems ? systems.get<{ get(id: string): EntityShape | undefined }>('entities') : null;
    const player = entityManager ? entityManager.get('player') : null;
    if (!player) return;
    const playerTransform = player.getComponent(Transform);
    if (!playerTransform) return;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.age += deltaTime;
      if (pickup.age >= pickup.lifetime) {
        this.pickups.splice(i, 1);
        continue;
      }
      const dx = playerTransform.x - pickup.x;
      const dy = playerTransform.y - pickup.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pickupRadius = pickup.radius + playerTransform.width / 2;
      if (distance < pickupRadius) {
        if (this.onCollected) this.onCollected(pickup.instance);
        this.pickups.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, camera: CameraShape): void {
    for (const pickup of this.pickups) {
      const screenX = camera.toScreenX(pickup.x);
      const screenY = camera.toScreenY(pickup.y);
      if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
          screenY < -50 || screenY > ctx.canvas.height + 50) continue;
      const radius = pickup.radius * camera.zoom;
      pickup.pulsePhase += 0.08;
      const pulse = 1 + Math.sin(pickup.pulsePhase) * 0.15;
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
  }

  clear(): void {
    this.pickups = [];
  }
}
