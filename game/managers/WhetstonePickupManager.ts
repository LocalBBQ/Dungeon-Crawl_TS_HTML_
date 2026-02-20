// Whetstone pickup manager: whetstones dropped by enemies, repair equipped weapons on collect.
import { Transform } from '../components/Transform.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import type { CameraShape } from '../types/camera.ts';
import type { EntityShape } from '../types/entity.ts';

export interface WhetstonePickup {
  id: string;
  x: number;
  y: number;
  radius: number;
  lifetime: number;
  age: number;
  pulsePhase: number;
}

/** Return false to leave the pickup in the world (e.g. inventory full). */
export type OnWhetstoneCollected = () => boolean | void;

export class WhetstonePickupManager {
  pickups: WhetstonePickup[] = [];
  onCollected: OnWhetstoneCollected | null = null;

  spawn(x: number, y: number): WhetstonePickup {
    const pickup: WhetstonePickup = {
      id: `whetstone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      radius: 6,
      lifetime: 90,
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
        const consumed = this.onCollected ? this.onCollected() : true;
        if (consumed !== false) this.pickups.splice(i, 1);
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
      pickup.pulsePhase += 0.06;
      const pulse = 1 + Math.sin(pickup.pulsePhase) * 0.12;
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
  }

  clear(): void {
    this.pickups = [];
  }
}
