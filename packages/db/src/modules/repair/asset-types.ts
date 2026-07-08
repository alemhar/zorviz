import type { Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from '../../core/column-types';

// BACK-1-006: data-driven shop asset types. `fields` is a JSON string:
// [{ key, label, kind: 'text' | 'number', required: boolean }]. `key` is the stable
// slug stored in assets.type. Access is via the HTTP API (single path), not Kysely —
// this interface is kept in sync per convention.
export interface AssetTypesTable {
    id: string;
    tenant_id: string;
    key: string;
    name: string;
    icon: Nullable<string>;
    fields: string; // JSON array of field defs
    show_on_create: number; // 0 | 1
    sort_order: number;
    created_at: number;
    updated_at: number;
}

export type AssetType = Selectable<AssetTypesTable>;
export type NewAssetType = Insertable<AssetTypesTable>;
export type AssetTypeUpdate = Updateable<AssetTypesTable>;
