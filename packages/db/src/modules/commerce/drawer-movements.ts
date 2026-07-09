import type { Selectable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// BACK-3-017: mid-day drawer movements (POS paid-in/paid-out). Not expenses — money changes
// location, not ownership. Close-day expected cash adds cash_in / subtracts cash_drop.
export interface DrawerMovementsTable {
    id: string;
    type: string; // 'cash_in' | 'cash_drop'
    amount: number; // centavos
    note: Nullable<string>;
    author: Nullable<string>;
    created_at: number;
}

export type DrawerMovement = Selectable<DrawerMovementsTable>;
