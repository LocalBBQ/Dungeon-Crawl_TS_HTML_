// Stamina component
class Stamina {
    constructor(maxStamina, regenRate = 0.1) {
        this.maxStamina = maxStamina;
        this.currentStamina = maxStamina;
        this.regenRate = regenRate;
        this.entity = null;
    }

    update(deltaTime, systems) {
        if (this.currentStamina < this.maxStamina) {
            this.currentStamina = Math.min(this.maxStamina, this.currentStamina + this.regenRate * deltaTime);
        }
    }

    use(amount) {
        if (this.currentStamina >= amount) {
            this.currentStamina -= amount;
            return true;
        }
        return false;
    }

    get percent() {
        return this.currentStamina / this.maxStamina;
    }
}

