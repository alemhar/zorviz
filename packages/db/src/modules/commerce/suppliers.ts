import type { Selectable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// Supplier master data (migration 0026): real records behind the payables flow. Receives
// link via inventory_adjustments.supplier_id; the free-text `supplier` column there stays
// as a denormalized display name kept in sync on write/rename.
export interface SuppliersTable {
    id: string;
    name: string;
    contact_person: Nullable<string>;
    phone: Nullable<string>;
    address: Nullable<string>;
    notes: Nullable<string>;
    created_at: number;
    updated_at: number;
}

export type Supplier = Selectable<SuppliersTable>;
