// Player healing: charge-based, 2s drink then rapid regen; 50% move speed while active
import type { Component } from '../types/component.js';
import { GameConfig } from '../config/GameConfig.js';
import { Health } from './Health.js';

type HealingPhase = 'idle' | 'drinking' | 'regening';

interface PlayerHealingEntity {
  getComponent<T>(ctor: new (...args: unknown[]) => T): T | null;
}

export class PlayerHealing implements Component {
  maxCharges: number;
  charges: number;
  drinkTime: number;
  regenRate: number;
  regenDuration: number;
  phase: HealingPhase;
  phaseTimer: number;
  entity: PlayerHealingEntity | null;

  constructor() {
    const cfg = (GameConfig as { player?: { heal?: { maxCharges?: number; initialCharges?: number; drinkTime?: number; regenRate?: number; regenDuration?: number } } }).player?.heal ?? {};
    this.maxCharges = cfg.maxCharges ?? 3;
    this.charges = cfg.initialCharges ?? 0;
    this.drinkTime = cfg.drinkTime ?? 2;
    this.regenRate = cfg.regenRate ?? 20;
    this.regenDuration = cfg.regenDuration ?? 2;
    this.phase = 'idle';
    this.phaseTimer = 0;
    this.entity = null;
  }

  get isDrinking(): boolean {
    return this.phase === 'drinking';
  }

  get isRegening(): boolean {
    return this.phase === 'regening';
  }

  get isHealing(): boolean {
    return this.isDrinking || this.isRegening;
  }

  startDrinking(): boolean {
    if (this.phase !== 'idle' || this.charges <= 0) return false;
    const health = this.entity?.getComponent(Health) ?? null;
    if (health && health.currentHealth >= health.maxHealth) return false;
    this.phase = 'drinking';
    this.phaseTimer = 0;
    return true;
  }

  cancelDrinking(): void {
    if (this.phase === 'drinking') {
      this.phase = 'idle';
      this.phaseTimer = 0;
    }
  }

  update(deltaTime: number): void {
    const health = this.entity?.getComponent(Health) ?? null;

    if (this.phase === 'drinking') {
      this.phaseTimer += deltaTime;
      if (this.phaseTimer >= this.drinkTime) {
        this.phase = 'regening';
        this.phaseTimer = 0;
        this.charges = Math.max(0, this.charges - 1);
      }
      return;
    }

    if (this.phase === 'regening') {
      if (health) {
        const amount = Math.min(
          this.regenRate * deltaTime,
          health.maxHealth - health.currentHealth
        );
        if (amount > 0) health.heal(amount);
      }
      this.phaseTimer += deltaTime;
      if (
        this.phaseTimer >= this.regenDuration ||
        (health && health.currentHealth >= health.maxHealth)
      ) {
        this.phase = 'idle';
        this.phaseTimer = 0;
      }
      return;
    }
  }
}
