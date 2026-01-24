
import { invoke } from '@tauri-apps/api/core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { RepairModule } from '@zorviz/feature-repair';

// Bridge Drizzle Proxy to Tauri Command
const driver = async (sql: string, params: any[], _method: 'run' | 'all' | 'values' | 'get') => {
    try {
        const result: any = await invoke('execute_sql', {
            sql,
            params: params ?? []
        });

        // sqliteProxy expects { rows: ... }
        return { rows: result };
    } catch (e) {
        console.error("SQL Error:", e);
        return { rows: [] };
    }
};

// Initialize DB
export const db = drizzle(driver);

// Initialize Repair Module
export const repairModule = new RepairModule(db);
