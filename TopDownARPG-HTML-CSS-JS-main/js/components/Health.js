// Health component
class Health {
    constructor(maxHealth) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.entity = null;
        this.isInvincible = false;
        this.wasJustHit = false; // Flag for animation system
    }

    takeDamage(amount, isBlocked = false) {
        // Don't take damage if invincible
        if (this.isInvincible) {
            return false;
        }
        
        const actualDamage = this.currentHealth - Math.max(0, this.currentHealth - amount);
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        
        // Set flag for animation system
        if (actualDamage > 0) {
            this.wasJustHit = true;
        }
        
        // Create damage number if damage was actually dealt
        if (actualDamage > 0 && this.entity) {
            const transform = this.entity.getComponent(Transform);
            if (transform) {
                // Emit event for damage number creation
                // Try to get systems from entity (set during update)
                const systems = this.entity.systems;
                if (systems && systems.eventBus) {
                    const isPlayer = this.entity.id === 'player';
                    systems.eventBus.emit(EventTypes.DAMAGE_TAKEN, {
                        x: transform.x,
                        y: transform.y - transform.height / 2, // Above entity
                        damage: actualDamage,
                        isPlayerDamage: !isPlayer, // If not player, it's damage dealt by player
                        isBlocked: isBlocked
                    });
                }
            }
        }
        
        if (this.entity && this.entity.onHealthChanged) {
            this.entity.onHealthChanged(this.currentHealth, this.maxHealth);
        }
        return this.currentHealth <= 0;
    }

    heal(amount) {
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        if (this.entity && this.entity.onHealthChanged) {
            this.entity.onHealthChanged(this.currentHealth, this.maxHealth);
        }
    }

    get isDead() {
        return this.currentHealth <= 0;
    }

    get percent() {
        return this.currentHealth / this.maxHealth;
    }
}

