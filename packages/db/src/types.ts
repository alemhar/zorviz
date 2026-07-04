import type { Insertable, Selectable, Updateable } from 'kysely';

// ============================================
// Core Tables
// ============================================

export interface UsersTable {
    id: string;
    email: string;
    role: 'admin' | 'advisor' | 'mechanic' | 'customer';
    password_hash: string | null;
    created_at: number;
    updated_at: number;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export interface SyncMetadataTable {
    id: string;
    table_name: string;
    record_id: string;
    last_synced_at: number | null;
    sync_hash: string | null;
}

export type SyncMetadata = Selectable<SyncMetadataTable>;
export type NewSyncMetadata = Insertable<SyncMetadataTable>;
export type SyncMetadataUpdate = Updateable<SyncMetadataTable>;

export interface AppConfigTable {
    id: string;
    tenant_id: string;
    branch_id: string;
    device_name: string;
    currency_symbol: string;
    locale: string;
    created_at: number;
    updated_at: number;
}

export type AppConfig = Selectable<AppConfigTable>;
export type NewAppConfig = Insertable<AppConfigTable>;
export type AppConfigUpdate = Updateable<AppConfigTable>;

// ============================================
// Repair Module Tables
// ============================================

export interface AssetsTable {
    id: string;
    tenant_id: string;
    owner_id: string | null;
    type: 'vehicle' | 'gadget' | 'appliance';
    specs: string; // JSON string
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
}

export type Asset = Selectable<AssetsTable>;
export type NewAsset = Insertable<AssetsTable>;
export type AssetUpdate = Updateable<AssetsTable>;

export interface BookingsTable {
    id: string;
    asset_id: string;
    customer_id: string;
    scheduled_time: number;
    status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
    created_at: number;
    updated_at: number;
}

export type Booking = Selectable<BookingsTable>;
export type NewBooking = Insertable<BookingsTable>;
export type BookingUpdate = Updateable<BookingsTable>;

// ============================================
// Commerce Module Tables
// ============================================

export interface OrdersTable {
    id: string;
    booking_id: string | null;
    asset_id: string;
    status: 'estimate' | 'approved' | 'in_progress' | 'completed' | 'billed';
    approval_proof: string | null;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    created_at: number;
    updated_at: number;
}

export type Order = Selectable<OrdersTable>;
export type NewOrder = Insertable<OrdersTable>;
export type OrderUpdate = Updateable<OrdersTable>;

export interface OrderItemsTable {
    id: string;
    order_id: string;
    type: 'service' | 'part';
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

export type OrderItem = Selectable<OrderItemsTable>;
export type NewOrderItem = Insertable<OrderItemsTable>;
export type OrderItemUpdate = Updateable<OrderItemsTable>;

export interface InventoryTable {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    stock_on_hand: number;
    reorder_point: number;
    unit_cost: number;
    unit_price: number;
}

export type InventoryItem = Selectable<InventoryTable>;
export type NewInventoryItem = Insertable<InventoryTable>;
export type InventoryItemUpdate = Updateable<InventoryTable>;

// ============================================
// Database Schema
// ============================================

export interface Database {
    users: UsersTable;
    sync_metadata: SyncMetadataTable;
    app_config: AppConfigTable;
    assets: AssetsTable;
    bookings: BookingsTable;
    orders: OrdersTable;
    order_items: OrderItemsTable;
    inventory: InventoryTable;
}
