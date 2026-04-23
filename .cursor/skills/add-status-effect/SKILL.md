---
name: add-status-effect
description: Add a new status effect end-to-end with shared status state, apply/decay rules, enemy infliction hooks, player delivery paths (weapon/projectile/skill), UI feedback, and config balancing checks. Use when implementing effects similar to stun (poison, burn, slow, bleed, freeze, weaken, etc.).
---

# Add Status Effect

## Scope

Use this skill when introducing a new combat status effect that can affect enemies and/or the player, and should be applied from one or more sources:

- enemy melee hit
- enemy projectile
- player weapon attack
- player projectile or active skill

Primary source-of-truth files:

- `game/components/StatusEffects.ts` (status state + timers + core apply/update logic)
- `game/components/Combat.ts` (melee hit resolution where status payloads are applied)
- `game/managers/ProjectileManager.ts` (projectile-on-hit status application)
- `game/config/GameConfig.ts` and `game/config/enemyConfigs.ts` (tuning + per-enemy infliction values)
- `game/weapons/weaponConfigs.ts` and `game/weapons/weaponBehavior.ts` (player delivery values)

## Required Workflow

### 1) Define the status model in `StatusEffects`

In `game/components/StatusEffects.ts`:

- Add explicit fields for the new effect (for example `poisonUntil`, `poisonDps`, `poisonStacks`).
- Add clear methods for lifecycle:
  - `apply<Effect>(...)`
  - optional `add<Effect>Buildup(...)` if threshold-based like stun
  - reset/consume helpers if needed
- Extend `update(deltaTime, systems)` to handle:
  - duration expiry
  - periodic ticks
  - decay/stack rules
- Keep naming parallel to existing stun logic for readability and consistency.

### 2) Add deterministic config knobs

In `game/config/GameConfig.ts`:

- Add global defaults for the effect for both player and enemies when applicable:
  - threshold/duration/decay or tick rate
  - caps (max stacks, max slow percent, etc.)
- Keep defaults safe and conservative first; tune later.

If per-enemy tuning is needed, add effect infliction values in `game/config/enemyConfigs.ts` and ensure the type shape supports them.

### 3) Wire enemy infliction paths

For enemy melee:

- Ensure melee result payload from attack handlers can carry effect data (similar to `stunBuildup`).
- In hit resolution (`Combat` flow), apply the new effect to player `StatusEffects`.

For enemy projectiles:

- Add effect payload fields to projectile creation/instance shape if needed.
- In `game/managers/ProjectileManager.ts`, apply effect on projectile hit to the appropriate target.

### 4) Wire player delivery paths

Choose at least one player delivery route:

- weapon combo/charged stage metadata in `game/weapons/weaponConfigs.ts`
- projectile configs (bow/staff/other) in player input/combat pipeline
- skill-specific apply path (if effect is not tied to weapon attacks)

Then ensure the hit resolver converts that payload into `StatusEffects.apply<Effect>(...)` on enemies.

### 5) Add gameplay behavior gates

Where gameplay is blocked or modified by effects, update behavior checks:

- movement or action lock (if freeze/root/stun-like)
- damage-over-time or stat multipliers (if poison/bleed/weaken)
- AI/combat cancellation logic for hard CC (see existing stun behavior patterns)

Do not mix rendering-only state with gameplay authority. `StatusEffects` remains the gameplay source of truth.

### 6) Add player-facing feedback

Update relevant UI/rendering paths so the effect is visible:

- HUD indicators for player debuffs/buildup where applicable
- enemy visual cues (tint, icon, particles, overlay) for affected targets
- help/tooltip text if this is a new player-usable mechanic

### 7) Validate balance and edge cases

Playtest and verify:

- effect can be inflicted by intended enemies only
- player can apply via intended weapon/skill path
- duration/decay/stack behavior is deterministic
- no permanent stuck states after save/load or death/respawn
- effect removal works (expiry/cleanse/consume paths)

## Acceptance Checklist

- [ ] New effect fields + methods are implemented in `StatusEffects` with clear lifecycle.
- [ ] Config defaults exist and per-enemy/per-weapon tuning is wired.
- [ ] Enemy melee and/or projectile paths can inflict the effect as intended.
- [ ] Player has at least one reliable way to apply the effect (weapon/projectile/skill).
- [ ] Combat/hit resolution applies the effect to correct targets only.
- [ ] UI feedback exists for affected entities.
- [ ] No TypeScript errors.

## Guardrails

- Do not hardcode effect numbers in multiple places; route through config where possible.
- Do not apply status in render code; gameplay state must live in `StatusEffects` and hit systems.
- Do not add a new payload field without propagating it through creation -> hit -> apply path.
- Do not make crowd-control effects infinite unless explicitly intended and counterbalanced.
