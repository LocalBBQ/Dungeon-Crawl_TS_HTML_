/**
 * Shared melee hit application: damage, stun buildup, knockback, and optional event.
 * Used by EnemyManager for both player→enemy and enemy→player hits.
 */

import { Health } from '../components/Health.ts';
import { StatusEffects } from '../components/StatusEffects.ts';
import { Movement } from '../components/Movement.ts';
import { Transform } from '../components/Transform.ts';
import { Utils } from '../utils/Utils.ts';

export interface MeleeHitOptions {
  blocked?: boolean;
  eventBus?: { emit(name: string, payload: unknown): void };
  eventName?: string;
  eventPayload?: unknown;
}

/** Entity with getComponent for Health, StatusEffects, Movement, Transform. */
interface EntityWithComponents {
  getComponent<T>(ctor: new (...args: unknown[]) => T): T | null;
}

/**
 * Apply a single melee hit: damage, stun buildup, knockback (unless blocked), and optional event.
 * Caller is responsible for hit detection and block check; pass blocked: true and reduced damage if blocked.
 */
export function applyMeleeHit(
  attacker: EntityWithComponents,
  target: EntityWithComponents,
  damage: number,
  stunBuildup: number,
  knockbackForce: number,
  options: MeleeHitOptions = {}
): boolean {
  const { blocked = false, eventBus, eventName, eventPayload } = options;
  const targetHealth = target.getComponent(Health);
  const targetStatus = target.getComponent(StatusEffects);
  const targetMovement = target.getComponent(Movement);
  const attackerTransform = attacker.getComponent(Transform);
  const targetTransform = target.getComponent(Transform);

  if (!targetHealth) return false;

  const died = targetHealth.takeDamage(damage, blocked);
  if (targetStatus && stunBuildup > 0) {
    targetStatus.addStunBuildup(stunBuildup);
  }
  if (targetMovement && !blocked && knockbackForce > 0 && attackerTransform && targetTransform) {
    const dx = targetTransform.x - attackerTransform.x;
    const dy = targetTransform.y - attackerTransform.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      targetMovement.applyKnockback(dx, dy, knockbackForce);
    }
  }
  if (eventBus && eventName) {
    eventBus.emit(eventName, eventPayload ?? { killed: died });
  }
  return died;
}
