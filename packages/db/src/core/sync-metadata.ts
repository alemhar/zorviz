import type { Insertable, Selectable, Updateable } from 'kysely';
import type { Nullable } from './column-types';

export interface SyncMetadataTable {
    id: string;
    table_name: string;
    record_id: string;
    last_synced_at: Nullable<number>;
    sync_hash: Nullable<string>;
}

export type SyncMetadata = Selectable<SyncMetadataTable>;
export type NewSyncMetadata = Insertable<SyncMetadataTable>;
export type SyncMetadataUpdate = Updateable<SyncMetadataTable>;
