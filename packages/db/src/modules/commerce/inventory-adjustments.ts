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
    expense_id: Nullable<string>; // BACK-3-016: linked parts expense (paid now or settled later)
    total_cost: Nullable<number>; // centavos paid/owed for this receive
    on_account: number; // 1 = supplier credit; outstanding payable while expense_id is NULL
    created_at: number;
}

export type InventoryAdjustment = Selectable<InventoryAdjustmentsTable>;
