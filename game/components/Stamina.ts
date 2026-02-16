// Stamina component
import type { Component } from '../types/component.js';
import type { SystemsMap } from '../types/systems.js';

export class Stamina implements Component {
  maxStamina: number;
  currentStamina: number;
  regenRate: number;
  entity?: unknown;

  constructor(maxStamina: number, regenRate = 0.1) {
    this.maxStamina = maxStamina;
    this.currentStamina = maxStamina;
    this.regenRate = regenRate;
  }

  update(deltaTime: number, _systems?: SystemsMap): void {
    if (this.currentStamina < this.maxStamina) {
      this.currentStamina = Math.min(
        this.maxStamina,
        this.currentStamina + this.regenRate * deltaTime
      );
    }
  }

  use(amount: number): boolean {
    if (this.currentStamina >= amount) {
      this.currentStamina -= amount;
      return true;
    }
    return false;
  }

  get percent(): number {
    return this.currentStamina / this.maxStamina;
  }
}
