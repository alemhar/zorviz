import type { Selectable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// BACK-2-011: job-ticket photos + append-only per-photo note threads. Files live under
// {data_dir}/media/orders/{order_id}/; the DB holds only paths + metadata.
export interface OrderPhotosTable {
    id: string;
    order_id: string;
    path: string;
    created_by: Nullable<string>;
    created_at: number;
}

export interface PhotoNotesTable {
    id: string;
    photo_id: string;
    author: Nullable<string>;
    note: string;
    created_at: number;
}

export type OrderPhoto = Selectable<OrderPhotosTable>;
export type PhotoNote = Selectable<PhotoNotesTable>;
