import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './core';

// --- Assets (Module: Repair) ---
export const assets = sqliteTable('assets', {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(), // Multi-tenancy
    ownerId: text('owner_id').references(() => users.id),
    type: text('type', { enum: ['vehicle', 'gadget', 'appliance'] }).notNull(),
    // Store generic specs as JSON string
    specs: text('specs', { mode: 'json' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
});

// --- Bookings (Module: Repair) ---
export const bookings = sqliteTable('bookings', {
    id: text('id').primaryKey(),
    assetId: text('asset_id').references(() => assets.id).notNull(),
    customerId: text('customer_id').references(() => users.id).notNull(),
    scheduledTime: integer('scheduled_time', { mode: 'timestamp' }).notNull(),
    status: text('status', { enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] }).notNull().default('pending'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
