// All enemy configs and type exports. Single module replacing Goblin, Skeleton, etc. files.
import { EnemyType } from './EnemyType.js';
import { EnemyWeapons } from '../weapons/EnemyWeaponsRegistry.js';
import { Weapons } from '../weapons/WeaponsRegistry.js';

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
  moveSpeed: 80,
  weaponId: 'goblinDagger',
  attackRange: goblinAttackRange,
  attackDamage: goblinAttackDamage,
  detectionRange: 400,
  color: '#44aa44',
  attackCooldown: goblinAttackCooldown / 2,
  windUpTime: 0,
  attackCooldownMultiplier: 1,
  damageMultiplier: 1,
  stunThreshold: 60,
  stunBuildupPerHit: 18,
  knockbackResist: 0,
  knockback: { force: 320, decay: 0.88 },
  maxStamina: 30,
  staminaRegen: 8,
  attackStaminaCost: 12
};

// Skeleton: ranged projectile, no melee
const skeletonConfig = {
  maxHealth: 50,
  moveSpeed: 40,
  attackRange: 50,
  attackDamage: 8,
  color: '#cccccc',
  attackCooldown: 0.75,
  windUpTime: 0.35,
  stunBuildupPerHit: 15,
  knockbackResist: 0,
  knockback: { force: 380, decay: 0.87 },
  projectile: {
    enabled: true,
    speed: 400,
    damage: 6,
    range: 280,
    cooldown: 1.75,
    stunBuildup: 15
  }
};

// Lesser demon: claw + lunge
const lesserDemonConfig = {
  maxHealth: 45,
  moveSpeed: 64,
  attackRange: 45,
  attackDamage: 7,
  detectionRange: 220,
  color: '#884444',
  attackCooldown: 0.425,
  windUpTime: 0.25,
  stunBuildupPerHit: 18,
  knockbackResist: 0.1,
  knockback: { force: 360, decay: 0.87 },
  lunge: {
    enabled: true,
    chargeRange: 160,
    chargeTime: 0.35,
    lungeSpeed: 440,
    lungeDistance: 130,
    lungeDamage: 10,
    knockback: { force: 520 }
  }
};

// Greater demon: pillar flame
const greaterDemonConfig = {
  maxHealth: 80,
  moveSpeed: 60,
  attackRange: 60,
  attackDamage: 12,
  detectionRange: 300,
  color: '#aa4444',
  attackCooldown: 0.335,
  windUpTime: 0.25,
  stunBuildupPerHit: 22,
  knockbackResist: 0.2,
  knockback: { force: 460, decay: 0.86 },
  pillarFlame: {
    castDelay: 1.0,
    activeDuration: 1.0,
    radius: 45,
    damage: 8,
    damageInterval: 0.2,
    cooldown: 9.0,
    pillarRange: 220
  }
};

// Goblin chieftain: stats from ChieftainClub (weapon chargeRelease)
const chieftainWeapon = EnemyWeapons.chieftainClub;
const chieftainHeavySmash = chieftainWeapon?.getHeavySmashProperties?.();
const chieftainAttackRange = chieftainHeavySmash ? chieftainHeavySmash.range : 97;
const chieftainAttackDamage = chieftainHeavySmash ? chieftainHeavySmash.damage : 16;
const chieftainWindUp = chieftainHeavySmash ? chieftainHeavySmash.chargeTime : 1.15;

const goblinChieftainConfig = {
  maxHealth: 60,
  moveSpeed: 100,
  weaponId: 'chieftainClub',
  attackRange: chieftainAttackRange,
  attackDamage: chieftainAttackDamage,
  detectionRange: 220,
  color: '#2d5a2d',
  attackCooldown: 0.6,
  windUpTime: chieftainWindUp / 2,
  stunThreshold: 70,
  stunBuildupPerHit: 24,
  knockbackResist: 0.5,
  knockback: { force: 400, decay: 0.86 },
  warCry: {
    enabled: true,
    radius: 180,
    cooldown: 6.0,
    buffDuration: 2.5,
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
  moveSpeed: 80,
  weaponId: 'mace',
  attackRange: banditAttackRange,
  attackDamage: banditAttackDamage,
  detectionRange: 450,
  color: '#5c4a3a',
  attackCooldown: banditAttackCooldown / 2,
  windUpTime: 0.75,
  attackCooldownMultiplier: 1.5,
  attackDurationMultiplier: 2.5,
  damageMultiplier: 1,
  comboWindow: 2.5,
  stunThreshold: 90,
  stunBuildupPerHit: 35,
  knockbackResist: 0,
  knockback: { force: 360, decay: 0.88 },
  lunge: { enabled: false },
  maxStamina: 50,
  staminaRegen: 6,
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
  moveSpeed: 176,
  weaponId: 'dagger',
  attackRange: banditDaggerAttackRange,
  attackDamage: banditDaggerAttackDamage,
  detectionRange: 220,
  color: '#5c4a3a',
  attackCooldown: banditDaggerAttackCooldown / 2,
  windUpTime: 1.0,
  attackCooldownMultiplier: 2.5,
  damageMultiplier: 1,
  stunThreshold: 75,
  stunBuildupPerHit: 20,
  knockbackResist: 0,
  knockback: { force: 300, decay: 0.88 },
  lunge: {
    enabled: true,
    chargeRange: 155,
    chargeTime: 0.5,
    lungeSpeed: 500,
    lungeDistance: 120,
    lungeDamage: banditDaggerLungeDamage,
    hitRadiusBonus: 0,
    knockback: { force: banditDaggerLungeKnockbackForce },
    hopBackChance: 0.4,
    hopBackDelay: 0.3,
    hopBackDistance: 48,
    hopBackSpeed: 300
  },
  packModifier: 'swift',
  maxStamina: 45,
  staminaRegen: 6,
  attackStaminaCost: 10
};

export const EnemyGoblin = EnemyType.fromConfig(goblinConfig);
export const EnemySkeleton = EnemyType.fromConfig(skeletonConfig);
export const EnemyLesserDemon = EnemyType.fromConfig(lesserDemonConfig);
export const EnemyGreaterDemon = EnemyType.fromConfig(greaterDemonConfig);
export const EnemyGoblinChieftain = EnemyType.fromConfig(goblinChieftainConfig);
export const EnemyBandit = EnemyType.fromConfig(banditConfig);
export const EnemyBanditDagger = EnemyType.fromConfig(banditDaggerConfig);
