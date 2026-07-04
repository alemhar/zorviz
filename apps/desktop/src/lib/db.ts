import { Kysely } from 'kysely';
import { TauriSqliteDialect } from './tauri-dialect';
import type { Database } from '@zorviz/db';

// Kysely over the Tauri `invoke` bridge. Used only by the desktop-only setup wizard
// (BACK-0-003). Feature data access has moved to the shared HTTP API (D23, single path);
// this and `execute_sql` are retired once the wizard migrates (Increment 4).
export const db = new Kysely<Database>({
    dialect: new TauriSqliteDialect(),
});
