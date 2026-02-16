// All enemy configs and type exports. Single module replacing Goblin, Skeleton, etc. files.
import { EnemyType } from './EnemyType.';
import { EnemyWeapons } from '../weapons/EnemyWeaponsRegistry.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';
import type { ChieftainClubWeaponType } from '../weapons/ChieftainClubWeapon.js';

// Goblin: stats derived from goblinDagger weapon. Uses weapon dash attack (leap), not config lunge.
const goblinWeapon = EnemyWeapons.getGoblinWeapon?.() ?? EnemyWeapons.resolveWeapon?.('goblinDagger') ?? null;
let goblinAttackRange = 40, goblinAttackDamage = 5, goblinAttackCooldown = 1.2;
if (goblinWeapon) {
  const first = (goblinWeapon as { getComboStageProperties?(n: number): { range: number; damage: number } }).getComboStageProperties?.(1);
  if (first) {
    goblinAttackRange = first.range;
    goblinAttackDamage = first.damage;
  }
  if ((goblinWeapon as { cooldown?: number }).cooldown != null) goblinAttackCooldown = (goblinWeapon as { cooldown: number }).cooldown;
}

const goblinConfig = {
  maxHealth: 30,
  moveSpeed: 25,
  weaponId: 'goblinDagger',
  attackRange: goblinAttackRange,
  attackDamage: goblinAttackDamage,
  detectionRange: 200,
  color: '#44aa44',
  attackCooldown: goblinAttackCooldown,
  windUpTime: 0,
  attackCooldownMultiplier: 1,
  damageMultiplier: 1,
  stunThreshold: 60,
  stunBuildupPerHit: 18,
  knockbackResist: 0,
  knockback: { force: 160, decay: 0.88 },
  maxStamina: 30,
  staminaRegen: 4,
  attackStaminaCost: 12
};

// Skeleton: ranged projectile, no melee
const skeletonConfig = {
  maxHealth: 50,
  moveSpeed: 20,
  attackRange: 50,
  attackDamage: 8,
  color: '#cccccc',
  attackCooldown: 1.5,
  windUpTime: 0.7,
  stunBuildupPerHit: 15,
  knockbackResist: 0,
  knockback: { force: 190, decay: 0.87 },
  projectile: {
    enabled: true,
    speed: 200,
    damage: 6,
    range: 280,
    cooldown: 3.5,
    stunBuildup: 15
  }
};

// Lesser demon: claw + lunge
const lesserDemonConfig = {
  maxHealth: 45,
  moveSpeed: 32,
  attackRange: 45,
  attackDamage: 7,
  detectionRange: 220,
  color: '#884444',
  attackCooldown: 0.85,
  windUpTime: 0.5,
  stunBuildupPerHit: 18,
  knockbackResist: 0.1,
  knockback: { force: 180, decay: 0.87 },
  lunge: {
    enabled: true,
    chargeRange: 160,
    chargeTime: 0.7,
    lungeSpeed: 220,
    lungeDistance: 130,
    lungeDamage: 10,
    knockback: { force: 260 }
  }
};

// Greater demon: pillar flame
const greaterDemonConfig = {
  maxHealth: 80,
  moveSpeed: 30,
  attackRange: 60,
  attackDamage: 12,
  detectionRange: 300,
  color: '#aa4444',
  attackCooldown: 0.67,
  windUpTime: 0.5,
  stunBuildupPerHit: 22,
  knockbackResist: 0.2,
  knockback: { force: 230, decay: 0.86 },
  pillarFlame: {
    castDelay: 2.0,
    activeDuration: 2.0,
    radius: 45,
    damage: 8,
    damageInterval: 0.4,
    cooldown: 18.0,
    pillarRange: 220
  }
};

// Goblin chieftain: stats from ChieftainClub heavySmash
const chieftainWeapon = EnemyWeapons.chieftainClub as ChieftainClubWeaponType | undefined;
const heavySmash = chieftainWeapon?.heavySmash ?? {
  chargeTime: 1.15,
  releaseDuration: 0.22,
  damage: 16,
  knockbackForce: 280,
  aoeInFront: true,
  aoeOffset: 55,
  aoeRadius: 42
};
const chieftainAttackRange = heavySmash.aoeInFront
  ? (heavySmash.aoeOffset ?? 55) + (heavySmash.aoeRadius ?? 42)
  : (heavySmash as { range?: number }).range ?? 97;

const goblinChieftainConfig = {
  maxHealth: 60,
  moveSpeed: 50,
  weaponId: 'chieftainClub',
  attackRange: chieftainAttackRange,
  attackDamage: heavySmash.damage,
  detectionRange: 220,
  color: '#2d5a2d',
  attackCooldown: 1.2,
  windUpTime: 0.5,
  stunThreshold: 70,
  stunBuildupPerHit: 24,
  knockbackResist: 0.5,
  knockback: { force: 200, decay: 0.86 },
  heavySmash,
  warCry: {
    enabled: true,
    radius: 180,
    cooldown: 12.0,
    buffDuration: 5.0,
    speedMultiplier: 1.2,
    damageMultiplier: 1.2
  }
};

// Bandit: mace — stats from Weapons.mace
const banditWeapon = Weapons.mace as { getComboStageProperties?(n: number): { range: number; damage: number }; cooldown?: number } | undefined;
let banditAttackRange = 95, banditAttackDamage = 22, banditAttackCooldown = 0.35;
if (banditWeapon) {
  const first = banditWeapon.getComboStageProperties?.(1);
  if (first) {
    banditAttackRange = first.range;
    banditAttackDamage = first.damage;
  }
  if (banditWeapon.cooldown != null) banditAttackCooldown = banditWeapon.cooldown;
}

const banditConfig = {
  maxHealth: 55,
  moveSpeed: 82,
  weaponId: 'mace',
  attackRange: banditAttackRange,
  attackDamage: banditAttackDamage,
  detectionRange: 220,
  color: '#5c4a3a',
  attackCooldown: banditAttackCooldown,
  windUpTime: 0,
  attackCooldownMultiplier: 2.5,
  attackDurationMultiplier: 2.5,
  damageMultiplier: 1,
  stunThreshold: 90,
  stunBuildupPerHit: 35,
  knockbackResist: 0,
  knockback: { force: 180, decay: 0.88 },
  lunge: { enabled: false },
  maxStamina: 50,
  staminaRegen: 3,
  attackStaminaCost: 25
};

// Bandit dagger: stats from Weapons.dagger
const banditDaggerWeapon = Weapons.dagger as {
  getComboStageProperties?(n: number): { range: number; damage: number };
  getDashAttackProperties?(): { damage?: number; knockbackForce?: number };
  cooldown?: number;
} | undefined;
let banditDaggerAttackRange = 40, banditDaggerAttackDamage = 5, banditDaggerAttackCooldown = 0.25, banditDaggerLungeDamage = 8, banditDaggerLungeKnockbackForce = 240;
if (banditDaggerWeapon) {
  const first = banditDaggerWeapon.getComboStageProperties?.(1);
  const dash = banditDaggerWeapon.getDashAttackProperties?.();
  if (first) {
    banditDaggerAttackRange = first.range;
    banditDaggerAttackDamage = first.damage;
  }
  if (banditDaggerWeapon.cooldown != null) banditDaggerAttackCooldown = banditDaggerWeapon.cooldown;
  if (dash) {
    banditDaggerLungeDamage = dash.damage ?? banditDaggerLungeDamage;
    if (dash.knockbackForce != null) banditDaggerLungeKnockbackForce = dash.knockbackForce;
  }
}

const banditDaggerConfig = {
  maxHealth: 42,
  moveSpeed: 88,
  weaponId: 'dagger',
  attackRange: banditDaggerAttackRange,
  attackDamage: banditDaggerAttackDamage,
  detectionRange: 220,
  color: '#5c4a3a',
  attackCooldown: banditDaggerAttackCooldown,
  windUpTime: 2.0,
  attackCooldownMultiplier: 2.5,
  damageMultiplier: 1,
  stunThreshold: 75,
  stunBuildupPerHit: 20,
  knockbackResist: 0,
  knockback: { force: 150, decay: 0.88 },
  lunge: {
    enabled: true,
    chargeRange: 155,
    chargeTime: 1.0,
    lungeSpeed: 250,
    lungeDistance: 120,
    lungeDamage: banditDaggerLungeDamage,
    hitRadiusBonus: 0,
    knockback: { force: banditDaggerLungeKnockbackForce },
    hopBackChance: 0.4,
    hopBackDelay: 0.6,
    hopBackDistance: 48,
    hopBackSpeed: 150
  },
  packModifier: 'swift',
  maxStamina: 45,
  staminaRegen: 3,
  attackStaminaCost: 10
};

export const EnemyGoblin = EnemyType.fromConfig(goblinConfig);
export const EnemySkeleton = EnemyType.fromConfig(skeletonConfig);
export const EnemyLesserDemon = EnemyType.fromConfig(lesserDemonConfig);
export const EnemyGreaterDemon = EnemyType.fromConfig(greaterDemonConfig);
export const EnemyGoblinChieftain = EnemyType.fromConfig(goblinChieftainConfig);
export const EnemyBandit = EnemyType.fromConfig(banditConfig);
export const EnemyBanditDagger = EnemyType.fromConfig(banditDaggerConfig);
