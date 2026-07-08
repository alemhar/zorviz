import type { Selectable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// BACK-3-005: manual stock adjustments (receive/correction/writeoff), append-only log,
// distinct from the automatic deduction/restock done by job approval/cancel.
export interface InventoryAdjustmentsTable {
    id: string;
    item_id: string;
    type: string; // 'receive' | 'correction' | 'writeoff'
    delta: number; // signed change applied to stock_on_hand
    note: Nullable<string>;
    author: Nullable<string>;
    created_at: number;
}

export type InventoryAdjustment = Selectable<InventoryAdjustmentsTable>;
