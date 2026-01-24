
import { AssetRepository } from './dal/asset.repo';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

export * from './types';
export * from './dal/asset.repo';

export class RepairModule {
    public assets: AssetRepository;

    constructor(private db: SqliteRemoteDatabase<any>) {
        this.assets = new AssetRepository(db);
    }
}
