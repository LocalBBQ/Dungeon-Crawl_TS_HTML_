---
name: add-enemy
description: Add a new enemy type end-to-end with config registration, behavior/weapon mapping, spawning integration, loot pool support, and gameplay balancing checks. Use when adding any new enemy key, variant tier, or boss enemy.
---

# Add Enemy

## Scope

Use this skill when adding a new enemy key (for example `forestWraith`), a tiered variant (`forestWraithVeteran` / `forestWraithElite`), or a boss enemy.

This project's enemy source of truth is:

- `game/config/enemyConfigs.ts` for enemy config objects and `EnemyType.fromConfig(...)` exports.
- `game/enemies/EnemiesRegistry.ts` for registry entries and weapon/behavior mapping.
- `game/managers/EnemyManager.ts` for tier substitution maps and runtime spawn/size logic.

## Required Workflow

### 1) Define enemy config and export type

In `game/config/enemyConfigs.ts`:

- Add `<enemyName>Config` with baseline combat and movement fields:
  - `maxHealth`, `moveSpeed`, `attackRange`, `attackDamage`, `detectionRange`
  - `attackCooldown`, `windUpTime`, `color`
  - stun/knockback/drop fields used by runtime (`stunBuildupPerHit`, `knockbackResist`, `knockback`, `goldDrop`, optional drop chances).
- Add optional ability blocks only when needed: `lunge`, `projectile`, `heavySmash`, `pillarFlame`, `warCry`, `dodge`, `hitboxPoints`.
- Export it as `Enemy<PascalName> = EnemyType.fromConfig(<enemyName>Config)`.

### 2) Register enemy in Enemies registry

In `game/enemies/EnemiesRegistry.ts`:

- Import the new `Enemy<PascalName>` from `enemyConfigs`.
- Add a key entry in `Enemies` object (for example `forestWraith: EnemyForestWraith`).
- Add `weaponAndBehavior` mapping for the same key:
  - choose `weaponId` that exists in `EnemyWeapons.resolveWeapon(...)` path
  - choose a valid `behaviorId` supported by weapon attack handling (`slashOnly`, `slashAndLeap`, `comboAndCharge`, `chargeRelease`, `rangedOnly`, etc.).

Without this step, `GameConfig.enemy.types` auto-population and attack handler creation will be incomplete.

### 3) Ensure weapon/ability dependencies exist

If the enemy uses a new `weaponId`:

- Add it in `game/weapons/EnemyWeaponsRegistry.ts` (or reuse an existing player weapon from `WeaponsRegistry`).
- Ensure `resolveWeapon(...)` can return a valid weapon object for that id.

If using special attacks (charge-release/lunge/ranged):

- Verify the chosen weapon object provides required attack property methods consumed by combat logic.

### 4) Hook enemy into spawn pools and tiering

Update level and tier routing so the enemy can actually appear:

- `game/config/GameConfig.ts`: add key to level `enemyTypes` arrays and/or `bossSpawn`.
- `game/managers/EnemyManager.ts`:
  - add tier links in `TIER2_MAP` / `TIER3_MAP` if adding veteran/elite chain
  - update any type-specific checks when needed (boss culling exclusions, size calculation branches, special-case behavior).

### 5) Configure loot behavior

If the enemy should drop weapons:

- Set `weaponDropChance` and `weaponDropPoolId` in enemy config.
- Add `weaponDropPoolId` entry to `game/config/lootConfig.ts` `LOOT_POOLS`.

If the enemy should drop non-weapon resources:

- Set `whetstoneDropChance` / `pageDropChance` in enemy config.

### 6) Validate runtime behavior

Verify in playtest:

- Enemy spawns in intended levels/packs.
- Attack cadence and range feel fair for target difficulty.
- Lunge/projectile/heavy-smash behavior works and does not soft-lock.
- Death rewards (gold/weapon/material drops) trigger as expected.

## Acceptance Checklist

- [ ] Enemy key is exported from `enemyConfigs` and present in `Enemies` registry.
- [ ] `weaponAndBehavior` mapping exists and resolves to a valid weapon.
- [ ] Enemy appears via level `enemyTypes` or `bossSpawn`.
- [ ] Tier-2/3 substitution works if variant chain was added.
- [ ] Loot drops match configured chances and pool ids.
- [ ] No TypeScript errors.

## Guardrails

- Do not add enemy config only in one file; registry + spawn integration are both required.
- Do not reference a `weaponId` that `resolveWeapon` cannot return.
- Do not add tier map entries without creating the underlying variant configs.
- Do not treat boss-sized enemies as normal mobs without reviewing size/culling/special handling in `EnemyManager`.
