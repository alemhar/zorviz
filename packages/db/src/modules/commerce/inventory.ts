import type { Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from '../../core/column-types';

export interface InventoryTable {
    id: string;
    sku: string;
    name: string;
    description: Nullable<string>;
    stock_on_hand: number;
    reorder_point: number;
    unit_cost: number; // centavos
    unit_price: number; // centavos
    created_at: number; // added 0020 (sync change-tracking)
    updated_at: number; // touched on every write
}

export type InventoryItem = Selectable<InventoryTable>;
export type NewInventoryItem = Insertable<InventoryTable>;
export type InventoryItemUpdate = Updateable<InventoryTable>;
