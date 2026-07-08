import type { Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// Canonical job-ticket status flow (D19).
export type OrderStatus =
    | 'triage'
    | 'estimate'
    | 'approved'
    | 'in_progress'
    | 'done'
    | 'paid'
    | 'cancelled';

export interface OrdersTable {
    id: string;
    booking_id: Nullable<string>;
    asset_id: string;
    customer_id: Nullable<string>; // references customers(id)
    status: OrderStatus;
    customer_complaint: Nullable<string>;
    assigned_mechanic_id: Nullable<string>; // references users(id)
    receipt_number: Nullable<string>; // set at billing
    approval_proof: Nullable<string>; // who + how approved (D5)
    inspection: Nullable<string>; // JSON: intake inspection checklist
    job_order_no: Nullable<string>; // shop's pre-printed paper serial (BIR job order)
    terms: Nullable<string>; // payment terms (e.g. "COD", "Net 15")
    senior_pwd_type: Nullable<string>; // 'senior' | 'pwd' | null (20% + VAT-exempt)
    senior_pwd_id: Nullable<string>; // OSCA / PWD ID number
    senior_pwd_name: Nullable<string>; // discount holder's name (may differ from customer)
    subtotal: number; // centavos
    tax: number; // centavos
    discount: number; // centavos (manual)
    senior_discount: number; // centavos (computed 20% when senior/PWD)
    total: number; // centavos
    started_at: Nullable<number>; // when work started (approved → in_progress)
    completed_at: Nullable<number>; // when marked done
    cancel_reason: Nullable<string>; // set when status = 'cancelled'
    created_at: number;
    updated_at: number;
}

export type Order = Selectable<OrdersTable>;
export type NewOrder = Insertable<OrdersTable>;
export type OrderUpdate = Updateable<OrdersTable>;
