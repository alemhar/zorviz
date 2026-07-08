import type { UsersTable } from './core/users';
import type { CustomersTable } from './core/customers';
import type { SyncMetadataTable } from './core/sync-metadata';
import type { AppConfigTable } from './core/app-config';
import type { AssetsTable } from './modules/repair/assets';
import type { AssetTypesTable } from './modules/repair/asset-types';
import type { BookingsTable } from './modules/repair/bookings';
import type { OrdersTable } from './modules/repair/orders';
import type { OrderPhotosTable, PhotoNotesTable } from './modules/repair/order-photos';
import type { OrderItemsTable } from './modules/commerce/order-items';
import type { InventoryTable } from './modules/commerce/inventory';
import type { InventoryAdjustmentsTable } from './modules/commerce/inventory-adjustments';

// The Kysely database schema: table-name → row type. Assembled from the domain-scoped
// table definitions in ./core and ./modules (BACK-1-001).
export interface Database {
    users: UsersTable;
    customers: CustomersTable;
    sync_metadata: SyncMetadataTable;
    app_config: AppConfigTable;
    assets: AssetsTable;
    asset_types: AssetTypesTable;
    bookings: BookingsTable;
    orders: OrdersTable;
    order_items: OrderItemsTable;
    inventory: InventoryTable;
    inventory_adjustments: InventoryAdjustmentsTable;
    order_photos: OrderPhotosTable;
    photo_notes: PhotoNotesTable;
}
