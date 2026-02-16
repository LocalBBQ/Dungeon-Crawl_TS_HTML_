// Health Orb Manager - manages health orbs dropped by enemies
import { Transform } from '../components/Transform.ts';
import { Health } from '../components/Health.ts';
import { PlayerHealing } from '../components/PlayerHealing.ts';
import type { SystemManager } from '../core/SystemManager.ts';
import type { CameraShape } from '../types/camera.ts';
import type { EntityShape } from '../types/entity.ts';

interface HealthOrb {
    id: string;
    x: number;
    y: number;
    healthAmount: number;
    radius: number;
    lifetime: number;
    age: number;
    active: boolean;
    pulsePhase: number;
}

export class HealthOrbManager {
    orbs: HealthOrb[] = [];

    createOrb(x: number, y: number, healthAmount = 20): HealthOrb {
        const orb: HealthOrb = {
            id: `orb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x,
            y,
            healthAmount,
            radius: 8,
            lifetime: 10.0,
            age: 0,
            active: true,
            pulsePhase: 0
        };
        this.orbs.push(orb);
        return orb;
    }

    update(deltaTime: number, systems: SystemManager | null): void {
        const entityManager = systems ? systems.get<{ get(id: string): EntityShape | undefined }>('entities') : null;
        const player = entityManager ? entityManager.get('player') : null;
        if (!player) return;
        const playerTransform = player.getComponent(Transform);
        const playerHealth = player.getComponent(Health);
        if (!playerTransform || !playerHealth) return;

        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const orb = this.orbs[i];
            if (!orb.active) {
                this.orbs.splice(i, 1);
                continue;
            }
            orb.age += deltaTime;
            orb.pulsePhase += deltaTime * 3;
            if (orb.age >= orb.lifetime) {
                this.orbs.splice(i, 1);
                continue;
            }
            const dx = playerTransform.x - orb.x;
            const dy = playerTransform.y - orb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const pickupRadius = orb.radius + playerTransform.width / 2;
            if (distance < pickupRadius) {
                const playerHealing = player.getComponent(PlayerHealing);
                if (playerHealing) {
                    playerHealing.charges = Math.min(playerHealing.maxCharges, playerHealing.charges + 1);
                }
                this.orbs.splice(i, 1);
            }
        }
    }

    render(ctx: CanvasRenderingContext2D, camera: CameraShape): void {
        for (const orb of this.orbs) {
            const screenX = camera.toScreenX(orb.x);
            const screenY = camera.toScreenY(orb.y);
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) continue;
            const pulseSize = 1.0 + Math.sin(orb.pulsePhase) * 0.2;
            const radius = orb.radius * camera.zoom * pulseSize;
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
    }

    clear(): void {
        this.orbs = [];
    }
}
