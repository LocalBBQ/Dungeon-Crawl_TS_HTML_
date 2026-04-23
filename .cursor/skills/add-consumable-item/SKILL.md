---
name: add-consumable-item
description: Add a new stackable inventory consumable with type count shape, drag drop behavior, hover tooltip, and icon support. Use when adding items like mushroom herb potion gold page or enchantScroll.
---

# Add Consumable Item

## Scope

Use this skill for stackable inventory items shaped like `{ type: '<itemType>', count: number }`, such as mushroom, herb, honey, potion, gold, page, and enchant scroll.

Consumables are inventory-first items. They may support toolbelt integration depending on item behavior.

## Required Workflow

### 1) Add consumable type to state

In `game/state/PlayingState.ts`:

- Add `type <Item>Consumable = { type: '<itemType>'; count: number }`.
- Extend `InventorySlot` union with the new type.
- Add `is<Item>Slot(...)` type guard.

### 2) Add inventory actions

In `game/state/InventoryActions.ts`:

- Add `add<Item>ToInventory(ps)` using stack-or-empty-slot behavior.
- If item is spendable, add consume helper(s) and optional count helper(s).
- Ensure interactions with existing flows do not drop or corrupt stack counts.

### 3) Extend inventory hit typing and classification

In `game/ui/InventoryChestCanvas.ts`:

- Extend `InventoryHit` `itemType` union with the new item type.
- Extend the `itemType` detection chain in `hitTestInventory(...)`.

### 4) Render slot icon and stack count

In `game/ui/InventoryChestCanvas.ts`:

- If needed, extend `drawSlot(...)` `itemIcon` union with the new icon id.
- Add icon draw branch or choose symbol fallback.
- Ensure stack count overlay is visible and consistent with existing consumables.

### 5) Add hover type and tooltip

In `game/types/tooltip.ts`:

- Add tooltip variant `{ type: '<itemType>'; x: number; y: number; count: number }`.

In `game/controllers/InventoryChestUIController.ts`:

- Update `updateTooltipHover(...)` to emit the new hover payload from inventory hits.

In `game/ui/InventoryChestCanvas.ts`:

- Add `render<Item>Tooltip(...)`.
- Wire it into the tooltip render section in `renderInventory(...)`.
- Keep tooltip copy concise: item name + one clear gameplay purpose line.

### 6) Drag/drop behavior

In `game/controllers/InventoryChestUIController.ts`:

- Pointer down: mark this consumable as draggable from inventory (and toolbelt if applicable).
- Pointer up: define valid destinations and transfer logic.
- Keep behavior deterministic for invalid targets (no silent data loss).

### 7) Gameplay acquisition and use hooks

- Add drop/pickup/crafting/shop hooks where relevant.
- Confirm any quick-use or station-use behavior (for example toolbelt, crafting panes, reroll station, vendor).

## Acceptance Checklist

- [ ] Item can be added to inventory and stacks correctly.
- [ ] Slot icon/symbol appears correctly.
- [ ] Stack count updates correctly for add/use/transfer.
- [ ] Hover tooltip appears with correct count and description.
- [ ] Drag/drop behavior works for allowed targets.
- [ ] Invalid drop targets fail safely without item loss.
- [ ] No TypeScript errors.

## Guardrails

- Do not model consumables as weapon instances.
- Do not introduce chest behavior unless storage model explicitly supports this item class.
- Do not duplicate tooltip logic if generic helper can be reused.
