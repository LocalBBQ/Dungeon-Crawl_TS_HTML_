// Manages floating damage numbers displayed on screen
class DamageNumberManager {
    constructor() {
        this.damageNumbers = [];
    }

    // Create a new damage number at a world position
    createDamageNumber(x, y, damage, isPlayerDamage = false, isBlocked = false) {
        const damageNumber = {
            x: x,
            y: y,
            damage: Math.round(damage),
            isPlayerDamage: isPlayerDamage, // true = damage dealt by player, false = damage taken by player
            isBlocked: isBlocked,
            lifetime: 0,
            maxLifetime: 1.0, // seconds
            offsetX: (Math.random() - 0.5) * 20, // Random horizontal spread
            offsetY: 0,
            velocityY: -50, // Pixels per second upward
            scale: 1.0
        };
        
        this.damageNumbers.push(damageNumber);
    }

    update(deltaTime) {
        for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
            const number = this.damageNumbers[i];
            
            // Update lifetime
            number.lifetime += deltaTime;
            
            // Update position (float upward)
            number.offsetY += number.velocityY * deltaTime;
            
            // Fade out and scale down over time
            const progress = number.lifetime / number.maxLifetime;
            number.scale = 1.0 - progress * 0.5; // Scale down to 50%
            
            // Remove expired numbers
            if (number.lifetime >= number.maxLifetime) {
                this.damageNumbers.splice(i, 1);
            }
        }
    }

    render(ctx, camera) {
        ctx.save();
        
        for (const number of this.damageNumbers) {
            // Calculate screen position
            const screenX = camera.toScreenX(number.x) + number.offsetX;
            const screenY = camera.toScreenY(number.y) + number.offsetY;
            
            // Skip if off screen
            if (screenX < -50 || screenX > ctx.canvas.width + 50 ||
                screenY < -50 || screenY > ctx.canvas.height + 50) {
                continue;
            }
            
            // Calculate opacity (fade out)
            const progress = number.lifetime / number.maxLifetime;
            const opacity = 1.0 - progress;
            
            // Determine color based on damage type
            let color;
            if (number.isBlocked) {
                color = '#8888ff'; // Blue for blocked damage
            } else if (number.isPlayerDamage) {
                color = '#ff4444'; // Red for damage dealt to enemies
            } else {
                color = '#ff8844'; // Orange for damage taken by player
            }
            
            // Set font
            const fontSize = 16 * number.scale;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Draw text shadow for visibility
            ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.8})`;
            ctx.fillText(number.damage.toString(), screenX + 1, screenY + 1);
            
            // Draw main text
            ctx.fillStyle = color.replace(')', `, ${opacity})`).replace('rgb', 'rgba');
            ctx.fillText(number.damage.toString(), screenX, screenY);
        }
        
        ctx.restore();
    }

    clear() {
        this.damageNumbers = [];
    }
}

