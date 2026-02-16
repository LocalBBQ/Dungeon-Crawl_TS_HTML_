// Manages floating damage numbers displayed on screen
import type { CameraShape } from '../types/camera.ts';

interface DamageNumberEntry {
    x: number;
    y: number;
    damage: number;
    isPlayerDamage: boolean;
    isBlocked: boolean;
    lifetime: number;
    maxLifetime: number;
    offsetX: number;
    offsetY: number;
    velocityY: number;
    scale: number;
}

export class DamageNumberManager {
    damageNumbers: DamageNumberEntry[] = [];

    createDamageNumber(x: number, y: number, damage: number, isPlayerDamage = false, isBlocked = false): void {
        this.damageNumbers.push({
            x,
            y,
            damage: Math.round(damage),
            isPlayerDamage,
            isBlocked,
            lifetime: 0,
            maxLifetime: 1.0,
            offsetX: (Math.random() - 0.5) * 20,
            offsetY: 0,
            velocityY: -50,
            scale: 1.0
        });
    }

    update(deltaTime: number): void {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const number = this.damageNumbers[i];
            number.lifetime += deltaTime;
            number.offsetY += number.velocityY * deltaTime;
            const progress = number.lifetime / number.maxLifetime;
            number.scale = 1.0 - progress * 0.5;
            if (number.lifetime >= number.maxLifetime) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    render(ctx: CanvasRenderingContext2D, camera: CameraShape): void {
        ctx.save();
        for (const number of this.damageNumbers) {
            const screenX = camera.toScreenX(number.x) + number.offsetX;
            const screenY = camera.toScreenY(number.y) + number.offsetY;
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) continue;
            const progress = number.lifetime / number.maxLifetime;
            const opacity = 1.0 - progress;
            let color: string;
            if (number.isBlocked) color = '#8888ff';
            else if (number.isPlayerDamage) color = '#ff4444';
            else color = '#ff8844';
            const fontSize = 16 * number.scale;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.8})`;
            ctx.fillText(number.damage.toString(), screenX + 1, screenY + 1);
            ctx.fillStyle = color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
            ctx.fillText(number.damage.toString(), screenX, screenY);
        }
        ctx.restore();
    }

    clear(): void {
        this.damageNumbers = [];
    }
}
