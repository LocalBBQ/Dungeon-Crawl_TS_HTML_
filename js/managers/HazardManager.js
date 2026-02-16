// HazardManager - manages environmental hazards like flame pillars
class HazardManager {
    constructor() {
        this.flamePillars = [];
        this.systems = null;
    }

    init(systems) {
        this.systems = systems;
    }

    createPillar(x, y, config) {
        const cfg = config || {};
        const activeDuration = cfg.activeDuration ?? 2;
        this.flamePillars.push({
            x,
            y,
            radius: cfg.radius ?? 45,
            damage: cfg.damage ?? 8,
            activeDuration,
            activeTimer: activeDuration,
            damageInterval: cfg.damageInterval ?? 0.4,
            lastDamageTime: 0
        });
    }

    updateFlamePillars(deltaTime, systems) {
        const sys = systems || this.systems;
        const entityManager = sys ? sys.get('entities') : null;
        const player = entityManager ? entityManager.get('player') : null;
        const playerTransform = player ? player.getComponent(Transform) : null;
        const playerHealth = player ? player.getComponent(Health) : null;

        for (let i = this.flamePillars.length - 1; i >= 0; i--) {
            const p = this.flamePillars[i];
            p.activeTimer -= deltaTime;
            if (p.activeTimer <= 0) {
                this.flamePillars.splice(i, 1);
                continue;
            }
            if (!playerTransform || !playerHealth || playerHealth.isDead) continue;
            const dist = Utils.distance(p.x, p.y, playerTransform.x, playerTransform.y);
            if (dist > p.radius) continue;
            p.lastDamageTime += deltaTime;
            if (p.lastDamageTime >= p.damageInterval) {
                p.lastDamageTime = 0;
                playerHealth.takeDamage(p.damage);
            }
        }
    }

    renderFlamePillars(ctx, camera) {
        for (const p of this.flamePillars) {
            const screenX = camera.toScreenX(p.x);
            const screenY = camera.toScreenY(p.y);
            const r = p.radius * camera.zoom;
            if (screenX + r < -50 || screenX - r > ctx.canvas.width + 50 ||
                screenY + r < -50 || screenY - r > ctx.canvas.height + 50) continue;

            const progress = 1 - p.activeTimer / (p.activeDuration || 1);
            const pulse = 0.85 + Math.sin(progress * Math.PI * 4) * 0.15;

            ctx.save();
            ctx.translate(screenX, screenY);

            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
            gradient.addColorStop(0, 'rgba(255, 180, 60, 0.5)');
            gradient.addColorStop(0.3, 'rgba(255, 100, 30, 0.4)');
            gradient.addColorStop(0.7, 'rgba(200, 40, 20, 0.25)');
            gradient.addColorStop(1, 'rgba(120, 20, 10, 0.1)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 140, 50, 0.7)';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }
    }

    clearFlamePillars() {
        this.flamePillars = [];
    }
}

