import { Kysely } from 'kysely';
import { AssetRepository } from './dal/asset.repo';
import type { Database } from '@zorviz/db';

export * from './types';
export * from './dal/asset.repo';

export class RepairModule {
    public assets: AssetRepository;

    constructor(db: Kysely<Database>) {
        this.assets = new AssetRepository(db);
    }
}
