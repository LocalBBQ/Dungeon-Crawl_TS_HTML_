// Gold Pickup Manager - gold piles dropped by enemies, picked up by walking over
import { Transform } from '../components/Transform.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import type { CameraShape } from '../types/camera.ts';
import type { EntityShape } from '../types/entity.ts';

export interface GoldPickup {
    id: string;
    x: number;
    y: number;
    amount: number;
    radius: number;
    lifetime: number;
    age: number;
    pulsePhase: number;
}

export type OnGoldCollected = (amount: number) => void;

export class GoldPickupManager {
    pickups: GoldPickup[] = [];
    onCollected: OnGoldCollected | null = null;

    spawn(x: number, y: number, amount: number): GoldPickup {
        const pickup: GoldPickup = {
            id: `gold_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x,
            y,
            amount,
            radius: 4,
            lifetime: 60,
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
                if (this.onCollected) this.onCollected(pickup.amount);
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
    }

    clear(): void {
        this.pickups = [];
    }
}
