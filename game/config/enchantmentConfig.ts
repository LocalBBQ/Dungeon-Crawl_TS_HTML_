/**
 * Enchantment definitions and roll/apply helpers for weapon and offhand instances.
 */

export type EnchantmentSlot = 'weapon' | 'offhand';
export type EnchantmentRarity = 'common' | 'rare' | 'legendary';

export type EnchantmentEffect =
  | { type: 'cooldownMultiplier'; value: number }
  | { type: 'damageFlat'; value: number }
  | { type: 'damagePercent'; value: number }
  | { type: 'stunBuildupPercent'; value: number }
  | { type: 'knockbackPercent'; value: number }
  | { type: 'rangePercent'; value: number }
  | { type: 'staminaCostPercent'; value: number }
  | { type: 'lifeOnHitPercent'; value: number }
  | { type: 'blockDamageReductionPercent'; value: number }
  | { type: 'blockStaminaCostPercent'; value: number }
  | { type: 'blockArcDegrees'; value: number }
  | { type: 'thornsPercent'; value: number };

export interface EnchantmentDef {
  id: string;
  displayName: string;
  slot: EnchantmentSlot;
  rarity: EnchantmentRarity;
  effect: EnchantmentEffect;
  description?: string;
}

export const ENCHANTMENTS: EnchantmentDef[] = [
  { id: 'quick', displayName: 'Quick', slot: 'weapon', rarity: 'common', effect: { type: 'cooldownMultiplier', value: 0.92 }, description: '8% faster attacks' },
  { id: 'heavy', displayName: 'Heavy', slot: 'weapon', rarity: 'common', effect: { type: 'damageFlat', value: 3 }, description: '+3 base damage' },
  { id: 'crushing', displayName: 'Crushing', slot: 'weapon', rarity: 'common', effect: { type: 'stunBuildupPercent', value: 15 }, description: '+15% stun buildup' },
  { id: 'vicious', displayName: 'Vicious', slot: 'weapon', rarity: 'common', effect: { type: 'damagePercent', value: 10 }, description: '+10% damage' },
  { id: 'reach', displayName: 'Reach', slot: 'weapon', rarity: 'common', effect: { type: 'rangePercent', value: 8 }, description: '+8% range' },
  { id: 'light', displayName: 'Light', slot: 'weapon', rarity: 'common', effect: { type: 'staminaCostPercent', value: -10 }, description: '10% less stamina per attack' },
  { id: 'vampiric', displayName: 'Vampiric', slot: 'weapon', rarity: 'rare', effect: { type: 'lifeOnHitPercent', value: 2 }, description: '2% life on hit' },
  { id: 'brutal', displayName: 'Brutal', slot: 'weapon', rarity: 'rare', effect: { type: 'knockbackPercent', value: 25 }, description: '+25% knockback' },
  { id: 'swift', displayName: 'Swift', slot: 'weapon', rarity: 'rare', effect: { type: 'cooldownMultiplier', value: 0.85 }, description: '15% faster attacks' },
  { id: 'reaper', displayName: "Reaper's", slot: 'weapon', rarity: 'rare', effect: { type: 'stunBuildupPercent', value: 30 }, description: '+30% stun buildup' },
  { id: 'soulLeech', displayName: 'Soul Leech', slot: 'weapon', rarity: 'legendary', effect: { type: 'lifeOnHitPercent', value: 4 }, description: '4% life on hit' },
  { id: 'infernal', displayName: 'Infernal', slot: 'weapon', rarity: 'legendary', effect: { type: 'damagePercent', value: 20 }, description: '+20% damage' },
  { id: 'cursed', displayName: 'Cursed', slot: 'weapon', rarity: 'legendary', effect: { type: 'damagePercent', value: 25 }, description: '+25% damage' },
  { id: 'sturdy', displayName: 'Sturdy', slot: 'offhand', rarity: 'common', effect: { type: 'blockDamageReductionPercent', value: 10 }, description: '10% better block' },
  { id: 'bastion', displayName: 'Bastion', slot: 'offhand', rarity: 'common', effect: { type: 'blockStaminaCostPercent', value: -15 }, description: '15% less block stamina' },
  { id: 'thorns', displayName: 'Thorns', slot: 'offhand', rarity: 'rare', effect: { type: 'thornsPercent', value: 15 }, description: '15% damage reflected on block' },
  { id: 'bulwark', displayName: 'Bulwark', slot: 'offhand', rarity: 'rare', effect: { type: 'blockArcDegrees', value: 15 }, description: '+15° block arc' },
];

export function getEnchantmentById(id: string): EnchantmentDef | undefined {
  return ENCHANTMENTS.find((e) => e.id === id);
}

export const ENCHANTMENTS_BY_SLOT: Record<EnchantmentSlot, EnchantmentDef[]> = {
  weapon: ENCHANTMENTS.filter((e) => e.slot === 'weapon'),
  offhand: ENCHANTMENTS.filter((e) => e.slot === 'offhand'),
};

/**
 * Pick a random enchantment for the given slot. Optional rarity filter.
 */
export function rollEnchantForSlot(slot: EnchantmentSlot, rarity?: EnchantmentRarity): EnchantmentDef | null {
  const pool = rarity
    ? ENCHANTMENTS_BY_SLOT[slot].filter((e) => e.rarity === rarity)
    : ENCHANTMENTS_BY_SLOT[slot];
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Apply enchant effects to a base weapon-like object. Returns a new object with effective stats.
 * Used when resolving equipped weapon for combat (damage, range, cooldown, etc.).
 */
export function applyEnchantEffectsToWeapon(
  base: { baseDamage?: number; baseRange?: number; baseArcDegrees?: number; cooldown?: number; baseStunBuildup?: number; [k: string]: unknown },
  prefixId: string | undefined,
  suffixId: string | undefined
): Record<string, unknown> {
  const result = { ...base };
  let damage = typeof base.baseDamage === 'number' ? base.baseDamage : 0;
  let range = typeof base.baseRange === 'number' ? base.baseRange : 0;
  let cooldown = typeof base.cooldown === 'number' ? base.cooldown : 0.1;
  let stunBuildup = typeof base.baseStunBuildup === 'number' ? base.baseStunBuildup : 25;
  let staminaCostMult = 1;

  for (const id of [prefixId, suffixId]) {
    if (!id) continue;
    const enc = getEnchantmentById(id);
    if (!enc || enc.slot !== 'weapon') continue;
    const e = enc.effect;
    switch (e.type) {
      case 'damageFlat':
        damage += e.value;
        break;
      case 'damagePercent':
        damage = Math.floor(damage * (1 + e.value / 100));
        break;
      case 'rangePercent':
        range = Math.floor(range * (1 + e.value / 100));
        break;
      case 'cooldownMultiplier':
        cooldown *= e.value;
        break;
      case 'stunBuildupPercent':
        stunBuildup = Math.floor(stunBuildup * (1 + e.value / 100));
        break;
      case 'staminaCostPercent':
        staminaCostMult *= 1 + e.value / 100;
        break;
      default:
        break;
    }
  }

  result.baseDamage = damage;
  result.baseRange = range;
  result.cooldown = cooldown;
  result.baseStunBuildup = stunBuildup;
  if (staminaCostMult !== 1) (result as { staminaCostMultiplier?: number }).staminaCostMultiplier = staminaCostMult;
  return result;
}

/**
 * Apply enchant effects to block config (offhand). Block may have arcRad (radians) or arcDegrees.
 * Returns modified block config with arcRad, damageReduction, staminaCost.
 */
export function applyEnchantEffectsToBlock(
  block: { damageReduction?: number; staminaCost?: number; arcRad?: number; arcDegrees?: number; [k: string]: unknown },
  prefixId: string | undefined,
  suffixId: string | undefined
): Record<string, unknown> {
  const result = { ...block };
  let reduction = typeof block.damageReduction === 'number' ? block.damageReduction : 0.5;
  let staminaCost = typeof block.staminaCost === 'number' ? block.staminaCost : 20;
  let arcRad = typeof block.arcRad === 'number' ? block.arcRad : (typeof block.arcDegrees === 'number' ? (block.arcDegrees * Math.PI) / 180 : Math.PI / 2);

  for (const id of [prefixId, suffixId]) {
    if (!id) continue;
    const enc = getEnchantmentById(id);
    if (!enc || enc.slot !== 'offhand') continue;
    const e = enc.effect;
    switch (e.type) {
      case 'blockDamageReductionPercent':
        reduction = Math.min(1, reduction * (1 + e.value / 100));
        break;
      case 'blockStaminaCostPercent':
        staminaCost = Math.max(0, Math.floor(staminaCost * (1 + e.value / 100)));
        break;
      case 'blockArcDegrees':
        arcRad += (e.value * Math.PI) / 180;
        break;
      default:
        break;
    }
  }

  result.damageReduction = reduction;
  result.staminaCost = staminaCost;
  result.arcRad = arcRad;
  return result;
}
