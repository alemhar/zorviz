import type { Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from '../../core/column-types';

export interface AssetsTable {
    id: string;
    tenant_id: string;
    owner_id: Nullable<string>; // references customers(id)
    type: string; // stable asset-type key from asset_types (data-driven, BACK-1-006)
    specs: string; // JSON string
    created_at: number;
    updated_at: number;
    deleted_at: Nullable<number>;
}

export type Asset = Selectable<AssetsTable>;
export type NewAsset = Insertable<AssetsTable>;
export type AssetUpdate = Updateable<AssetsTable>;
