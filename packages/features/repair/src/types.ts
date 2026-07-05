import type { Asset as DbAsset, Booking, Order } from '@zorviz/db';

export type Asset = DbAsset;
export type { Booking, Order };

// Extend for UI (Mobile Cards). `specs` is parsed from its JSON string form
// into an object for consumption in the UI / repository layer.
export interface AssetWithHistory extends Omit<DbAsset, 'specs'> {
    specs: Record<string, any>;
    lastVisit?: Date;
    pendingBookings?: Booking[];
}

export type CreateAssetInput = {
    ownerId?: string; // Optional (Draft/Quick Create)
    tenantId?: string; // Optional (Injected by Repo or passed explicitly)
    // Stable asset-type key (from the shop's configured asset_types, BACK-1-006).
    // Data-driven, so any configured key is valid — not limited to the former built-ins.
    type: string;
    specs: Record<string, any>; // { plateNumber: "ABC-1234", mileage: 50000 }
};

export type JobTicketInput = {
    assetId: string;
    description: string;
    images?: string[]; // URIs
};
