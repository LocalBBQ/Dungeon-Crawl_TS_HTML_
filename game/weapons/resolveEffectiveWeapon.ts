/**
 * Resolves an effective weapon (or offhand) from registry key + optional enchant prefix/suffix.
 * Returns a wrapper with overridden baseDamage, baseRange, cooldown; offhand also gets modified getBlockConfig.
 */
import { Weapons } from './WeaponsRegistry.js';
import { applyEnchantEffectsToWeapon, applyEnchantEffectsToBlock } from '../config/enchantmentConfig.js';

export function getEffectiveWeapon(
  key: string | undefined,
  prefixId: string | undefined,
  suffixId: string | undefined
): unknown {
  if (!key || key === 'none') return null;
  const base = Weapons[key];
  if (!base || typeof base !== 'object') return null;
  const hasEnchants = !!(prefixId || suffixId);
  if (!hasEnchants) return base;

  const baseObj = base as {
    baseDamage?: number;
    baseRange?: number;
    baseCooldown?: number;
    cooldown?: number;
    speed?: number;
    baseStunBuildup?: number;
    getBlockConfig?(): { damageReduction?: number; staminaCost?: number; arcRad?: number; [k: string]: unknown } | null;
  };
  const effective = applyEnchantEffectsToWeapon(
    {
      baseDamage: baseObj.baseDamage ?? 0,
      baseRange: baseObj.baseRange ?? 0,
      cooldown: baseObj.cooldown ?? 0.1,
      baseStunBuildup: baseObj.baseStunBuildup ?? 25
    },
    prefixId,
    suffixId
  ) as { baseDamage: number; baseRange: number; cooldown: number; baseStunBuildup?: number };

  const wrapper = Object.create(base);
  wrapper.baseDamage = effective.baseDamage;
  wrapper.baseRange = effective.baseRange;
  if (typeof effective.cooldown === 'number' && typeof baseObj.cooldown === 'number' && baseObj.cooldown > 0) {
    wrapper.baseCooldown = (baseObj.baseCooldown ?? 0) * (effective.cooldown / baseObj.cooldown);
  }
  if (effective.baseStunBuildup != null) wrapper.baseStunBuildup = effective.baseStunBuildup;

  const isOffhand = key === 'shield' || key.startsWith('defender_');
  if (isOffhand && typeof baseObj.getBlockConfig === 'function') {
    const origGetBlockConfig = baseObj.getBlockConfig.bind(base);
    wrapper.getBlockConfig = function (): unknown {
      const block = origGetBlockConfig();
      if (!block || typeof block !== 'object') return block;
      return applyEnchantEffectsToBlock(block as Record<string, unknown>, prefixId, suffixId);
    };
  }
  return wrapper;
}
