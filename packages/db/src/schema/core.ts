import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- Users (Core Kernel) ---
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    role: text('role', { enum: ['admin', 'advisor', 'mechanic', 'customer'] }).notNull(),
    passwordHash: text('password_hash'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// --- Sync Metadata (Core Kernel) ---
export const syncMetadata = sqliteTable('sync_metadata', {
    id: text('id').primaryKey(),
    tableName: text('table_name').notNull(),
    recordId: text('record_id').notNull(),
    lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
    syncHash: text('sync_hash'),
});

// --- App Config (Singleton Identity) ---
export const appConfig = sqliteTable('app_config', {
    id: text('id').primaryKey(), // Usually just 'default' or single row
    tenantId: text('tenant_id').notNull(),
    branchId: text('branch_id').notNull(),
    deviceName: text('device_name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
