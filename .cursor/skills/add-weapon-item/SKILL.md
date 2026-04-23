---
name: add-weapon-item
description: Add a new weapon item end-to-end with inventory/chest movement, equip logic, rarity effects, hover tooltip, and icon support. Use when adding a new weapon key or weapon-class item.
---

# Add Weapon Item

## Scope

Use this skill for weapon instances (`key`, `durability`, optional `rarity`, optional `effectIds`) that can be moved between inventory and chest, equipped to mainhand/offhand, and shown with weapon hover tooltip and durability.

## Required Workflow

### 1) Register weapon definition

- Add/update weapon config in `game/weapons/WeaponsRegistry.ts` (or the corresponding weapon config module).
- Ensure equip compatibility in `game/weapons/weaponSlot.ts` (`getEquipSlotForWeapon`, `canEquipWeaponInSlot`).
- Verify icon rendering via existing `drawWeaponIcon(...)` path in `game/ui/InventoryChestCanvas.ts`.

### 2) Keep state shape compatible

- Weapon instance shape already exists in `game/state/PlayingState.ts` as `WeaponInstance`.
- If adding metadata, keep backward compatibility and update `normalizeWeaponInstance(...)`.

### 3) Support movement and equipment actions

Verify the new key behaves correctly through existing actions in `game/state/InventoryActions.ts`:

- `equipFromInventory`
- `unequipToInventory`
- `equipFromChestToHand`
- `putInChestFromInventory`
- `swapEquipmentWithInventory`
- `swapChestSlots`

When moving containers, preserve `durability`, `rarity`, and `effectIds`.

### 4) Drag/drop behavior

In `game/controllers/InventoryChestUIController.ts`:

- Pointer down should pick weapon from inventory/chest/equipment.
- Pointer up should allow valid targets (inventory, chest, equipment, reroll slot).
- Respect slot constraints (offhand-only, two-handed rules, broken durability checks).

### 5) Hover and tooltip

- Hover payload type is `'weapon'` in `game/types/tooltip.ts`.
- `updateTooltipHover(...)` should emit `weaponKey`, pointer `x/y`, and optional `durability`, `rarity`, `effectIds`.
- Tooltip rendering uses `renderWeaponTooltip(...)` and lines from `getWeaponTooltipLines(...)` in `game/ui/InventoryChestCanvas.ts`.

### 6) Acquisition hooks

- If dropped by enemies, update `game/config/lootConfig.ts` pool membership.
- If sold in shop, update shop config and purchase flow.
- If repair/reroll should apply, confirm compatibility with durability and reroll paths.

## Acceptance Checklist

- [ ] Weapon appears in inventory with correct icon.
- [ ] Can move inventory <-> chest.
- [ ] Can equip/unequip according to slot rules.
- [ ] Two-handed and offhand constraints behave correctly.
- [ ] Hover tooltip shows name, stats/effects, durability.
- [ ] Rarity/effects persist across move/equip/chest operations.
- [ ] No TypeScript errors.

## Guardrails

- Do not treat stackable consumables as weapons.
- Do not lose `rarity` or `effectIds` during swaps/transfers.
- Do not bypass `canEquipWeaponInSlot`.
