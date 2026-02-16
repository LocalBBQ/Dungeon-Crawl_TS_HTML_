// Health component
import type { Component } from '../types/component.js';
import { Transform } from './Transform.ts';
import { EventTypes } from '../core/EventTypes.ts';

interface HealthEntity {
  id: string;
  systems?: { eventBus?: { emit(event: string, payload: unknown): void } };
  getComponent<T>(c: new (...args: unknown[]) => T): T | null;
  onHealthChanged?(current: number, max: number): void;
}

export class Health implements Component {
  maxHealth: number;
  currentHealth: number;
  entity: HealthEntity | null = null;
  isInvincible = false;
  wasJustHit = false;

  constructor(maxHealth: number) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  takeDamage(amount: number, isBlocked = false): boolean {
    if (this.isInvincible) return false;
    const actualDamage = this.currentHealth - Math.max(0, this.currentHealth - amount);
    this.currentHealth = Math.max(0, this.currentHealth - amount);
    if (actualDamage > 0) this.wasJustHit = true;
    if (actualDamage > 0 && this.entity) {
      const transform = this.entity.getComponent(Transform);
      if (transform) {
        const systems = this.entity.systems;
        if (systems?.eventBus) {
          const isPlayer = this.entity.id === 'player';
          systems.eventBus.emit(EventTypes.DAMAGE_TAKEN, {
            x: transform.x,
            y: transform.y - transform.height / 2,
            damage: actualDamage,
            isPlayerDamage: !isPlayer,
            isBlocked,
            entityId: this.entity.id,
          });
        }
      }
    }
    if (this.entity?.onHealthChanged) this.entity.onHealthChanged(this.currentHealth, this.maxHealth);
    return this.currentHealth <= 0;
  }

  heal(amount: number): void {
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    if (this.entity?.onHealthChanged) this.entity.onHealthChanged(this.currentHealth, this.maxHealth);
  }

  get isDead(): boolean {
    return this.currentHealth <= 0;
  }
  get percent(): number {
    return this.currentHealth / this.maxHealth;
  }
}
