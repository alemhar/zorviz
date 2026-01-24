
import { InferSelectModel } from 'drizzle-orm';
import * as schema from '@zorviz/db';

export type Asset = InferSelectModel<typeof schema.assets>;
export type Booking = InferSelectModel<typeof schema.bookings>;
export type Order = InferSelectModel<typeof schema.orders>;

// Extend for UI (Mobile Cards)
export interface AssetWithHistory extends Asset {
    lastVisit?: Date;
    pendingBookings?: Booking[];
}

export type CreateAssetInput = {
    ownerId?: string; // Optional (Draft/Quick Create)
    tenantId?: string; // Optional (Injected by Repo or passed explicitly)
    type: 'vehicle' | 'gadget' | 'appliance';
    specs: Record<string, any>; // { plateNumber: "ABC-1234", mileage: 50000 }
};

export type JobTicketInput = {
    assetId: string;
    description: string;
    images?: string[]; // URIs
};
