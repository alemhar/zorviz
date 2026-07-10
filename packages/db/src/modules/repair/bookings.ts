import type { Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// BACK-2-010: lightweight bookings. Contact + note + time; asset/customer are linked
// only on convert (both nullable).
export interface BookingsTable {
    id: string;
    customer_name: Nullable<string>;
    customer_phone: Nullable<string>;
    note: Nullable<string>;
    scheduled_time: number;
    status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
    asset_id: Nullable<string>;
    customer_id: Nullable<string>; // references customers(id)
    request_id: Nullable<string>; // cloud booking_requests id (online booking dedupe/link, v2.1)
    created_at: number;
    updated_at: number;
}

export type Booking = Selectable<BookingsTable>;
export type NewBooking = Insertable<BookingsTable>;
export type BookingUpdate = Updateable<BookingsTable>;
