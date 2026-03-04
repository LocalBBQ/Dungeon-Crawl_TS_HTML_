/**
 * Resolves an effective weapon (or offhand) from registry key + optional effect ids.
 * Returns a wrapper with overridden baseDamage, baseRange, cooldown; offhand also gets modified getBlockConfig.
 */
import { Weapons } from './WeaponsRegistry.js';
import { applyEffectsToWeapon, applyEffectsToBlock } from '../config/enchantmentConfig.js';

export function getEffectiveWeapon(
  key: string | undefined,
  effectIds: (string | null)[] | undefined
): unknown {
  if (!key || key === 'none') return null;
  const base = Weapons[key];
  if (!base || typeof base !== 'object') return null;
  const ids = effectIds ?? [];
  const hasEffects = ids.some((id) => !!id);
  if (!hasEffects) return base;

  const baseObj = base as {
    baseDamage?: number;
    baseRange?: number;
    baseCooldown?: number;
    cooldown?: number;
    speed?: number;
    baseStunBuildup?: number;
    getBlockConfig?(): { damageReduction?: number; staminaCost?: number; arcRad?: number; [k: string]: unknown } | null;
  };
  const effective = applyEffectsToWeapon(
    {
      baseDamage: baseObj.baseDamage ?? 0,
      baseRange: baseObj.baseRange ?? 0,
      cooldown: baseObj.cooldown ?? 0.1,
      baseStunBuildup: baseObj.baseStunBuildup ?? 25
    },
    ids
  ) as { baseDamage: number; baseRange: number; cooldown: number; baseStunBuildup?: number };

  const wrapper = Object.create(base);
  wrapper.baseDamage = effective.baseDamage;
  wrapper.baseRange = effective.baseRange;
  if (typeof effective.cooldown === 'number' && typeof baseObj.cooldown === 'number' && baseObj.cooldown > 0) {
    wrapper.baseCooldown = (baseObj.baseCooldown ?? 0) * (effective.cooldown / baseObj.cooldown);
  }
  if (effective.baseStunBuildup != null) wrapper.baseStunBuildup = effective.baseStunBuildup;

  const isOffhand = key.startsWith('shield_') || key.startsWith('defender_');
  if (isOffhand && typeof baseObj.getBlockConfig === 'function') {
    const origGetBlockConfig = baseObj.getBlockConfig.bind(base);
    wrapper.getBlockConfig = function (): unknown {
      const block = origGetBlockConfig();
      if (!block || typeof block !== 'object') return block;
      return applyEffectsToBlock(block as Record<string, unknown>, ids);
    };
  }
  return wrapper;
}
