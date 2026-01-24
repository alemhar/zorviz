import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { assets, bookings } from './repair';

// --- Orders (Module: Commerce / Shared) ---
// Note: Orders currently reference 'bookings' and 'assets' which are in Repair.
// In a truly modular system, these foreign keys would be generic or mixed-in.
// For now, we import them, but acknowledge the coupling.
export const orders = sqliteTable('orders', {
    id: text('id').primaryKey(),
    bookingId: text('booking_id').references(() => bookings.id),
    assetId: text('asset_id').references(() => assets.id).notNull(),
    status: text('status', { enum: ['estimate', 'approved', 'in_progress', 'completed', 'billed'] }).notNull().default('estimate'),
    approvalProof: text('approval_proof'), // URI or JSON

    // Financials
    subtotal: real('subtotal').notNull().default(0),
    tax: real('tax').notNull().default(0),
    discount: real('discount').notNull().default(0),
    total: real('total').notNull().default(0),

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// --- Order Items ---
export const orderItems = sqliteTable('order_items', {
    id: text('id').primaryKey(),
    orderId: text('order_id').references(() => orders.id).notNull(),
    type: text('type', { enum: ['service', 'part'] }).notNull(),
    description: text('description').notNull(),
    quantity: real('quantity').notNull().default(1),
    unitPrice: real('unit_price').notNull().default(0),
    total: real('total').notNull().default(0),
});

// --- Inventory (Module: Commerce) ---
export const inventory = sqliteTable('inventory', {
    id: text('id').primaryKey(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    stockOnHand: real('stock_on_hand').notNull().default(0),
    reorderPoint: real('reorder_point').notNull().default(5),
    unitCost: real('unit_cost').notNull().default(0),
    unitPrice: real('unit_price').notNull().default(0),
});
