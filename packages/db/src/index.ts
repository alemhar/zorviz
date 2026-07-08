// Kysely database types, split into domain-scoped modules (BACK-1-001).
// Everything is re-exported here so consumers keep importing from "@zorviz/db".

// Core
export * from './core/column-types';
export * from './core/users';
export * from './core/customers';
export * from './core/sync-metadata';
export * from './core/app-config';

// Repair module
export * from './modules/repair/assets';
export * from './modules/repair/asset-types';
export * from './modules/repair/bookings';
export * from './modules/repair/orders';
export * from './modules/repair/order-photos';

// Commerce module
export * from './modules/commerce/order-items';
export * from './modules/commerce/inventory';
export * from './modules/commerce/inventory-adjustments';
export * from './modules/commerce/payments';

// Assembled schema
export * from './database';
