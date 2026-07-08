import type { Insertable, Selectable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// BACK-3-007: recorded payment for a billed job. `change_due` is 0 for exact / non-cash tenders.
export interface PaymentsTable {
    id: string;
    order_id: string;
    method: string; // 'cash' | 'gcash' | 'card'
    amount: number; // centavos (order total at payment)
    tendered: number; // centavos
    change_due: number; // centavos returned
    processed_by: Nullable<string>;
    created_at: number;
}

export type Payment = Selectable<PaymentsTable>;
export type NewPayment = Insertable<PaymentsTable>;
