// Health Orb Manager - manages health orbs dropped by enemies
class HealthOrbManager {
    constructor() {
        this.orbs = [];
    }

    createOrb(x, y, healthAmount = 20) {
        const orb = {
            id: `orb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x: x,
            y: y,
            healthAmount: healthAmount,
            radius: 8,
            lifetime: 10.0, // Orbs disappear after 10 seconds
            age: 0,
            active: true,
            pulsePhase: 0 // For pulsing animation
        };
        
        this.orbs.push(orb);
        return orb;
    }

    update(deltaTime, systems) {
        const entityManager = systems ? systems.get('entities') : null;
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
            
            // Update lifetime
            orb.age += deltaTime;
            orb.pulsePhase += deltaTime * 3; // Pulse animation speed
            
            // Remove if expired
            if (orb.age >= orb.lifetime) {
                this.orbs.splice(i, 1);
                continue;
            }
            
            // Check collision with player
            const dx = playerTransform.x - orb.x;
            const dy = playerTransform.y - orb.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const pickupRadius = orb.radius + playerTransform.width / 2;
            
            if (distance < pickupRadius) {
                // Player picked up the orb
                playerHealth.heal(orb.healthAmount);
                this.orbs.splice(i, 1);
                continue;
            }
        }
    }

    render(ctx, camera) {
        for (const orb of this.orbs) {
            const screenX = camera.toScreenX(orb.x);
            const screenY = camera.toScreenY(orb.y);
            
            // Check if in view
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) {
                continue;
            }
            
            // Calculate pulsing size
            const pulseSize = 1.0 + Math.sin(orb.pulsePhase) * 0.2;
            const radius = orb.radius * camera.zoom * pulseSize;
            
            // Draw glow effect
            const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius * 2);
            gradient.addColorStop(0, 'rgba(255, 50, 50, 0.6)');
            gradient.addColorStop(0.5, 'rgba(255, 100, 100, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 150, 150, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius * 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw orb
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw highlight
            ctx.fillStyle = '#ff6666';
            ctx.beginPath();
            ctx.arc(screenX - radius * 0.3, screenY - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    clear() {
        this.orbs = [];
    }
}

