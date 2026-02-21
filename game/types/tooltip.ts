/** Unified tooltip hover: weapon or armor slot; null when none. Used by Game and InventoryChestCanvas. */
export type TooltipHover =
    | { type: 'weapon'; weaponKey: string; x: number; y: number; durability?: number; prefixId?: string; suffixId?: string }
    | { type: 'armor'; armorKey: string; x: number; y: number; durability?: number }
    | null;
