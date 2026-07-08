import type { Selectable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// Append-only job-ticket movement log (0022): one row per status transition, written
// automatically by the server. from_status NULL = ticket created. Powers funnel/dwell analytics.
export interface OrderStatusHistoryTable {
    id: string;
    order_id: string;
    from_status: Nullable<string>;
    to_status: string;
    actor: Nullable<string>;
    created_at: number;
}

export type OrderStatusTransition = Selectable<OrderStatusHistoryTable>;
