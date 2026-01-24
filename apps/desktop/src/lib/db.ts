import { Kysely } from 'kysely';
import { TauriSqliteDialect } from './tauri-dialect';
import type { Database } from '@zorviz/db';
import { RepairModule } from '@zorviz/feature-repair';

// Initialize Kysely with Tauri SQLite dialect
export const db = new Kysely<Database>({
    dialect: new TauriSqliteDialect(),
});

// Initialize Repair Module
export const repairModule = new RepairModule(db);
