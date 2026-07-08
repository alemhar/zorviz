import type { Selectable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// BACK-3-011: cash-drawer sessions (open day → close day). closed_at NULL = the open session;
// at close, expected_cash = opening_float + cash payments − drawer-paid expenses (session window),
// and over_short = counted_cash − expected_cash (negative = short).
export interface DrawerSessionsTable {
    id: string;
    opening_float: number; // centavos
    expected_cash: Nullable<number>;
    counted_cash: Nullable<number>;
    over_short: Nullable<number>;
    opened_by: Nullable<string>;
    closed_by: Nullable<string>;
    opened_at: number;
    closed_at: Nullable<number>;
    created_at: number;
    updated_at: number;
}

export type DrawerSession = Selectable<DrawerSessionsTable>;
