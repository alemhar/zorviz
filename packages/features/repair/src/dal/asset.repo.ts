
import { eq, or, like, desc, sql } from 'drizzle-orm';
import { assets, bookings } from '@zorviz/db';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { AssetWithHistory, CreateAssetInput } from '../types';

export class AssetRepository {
    constructor(private db: SqliteRemoteDatabase<any>) { }

    /**
     * Search assets by a general query string (License Plate, VIN, etc.)
     * Returns assets with their latest booking status.
     */
    async search(query: string): Promise<AssetWithHistory[]> {
        const lowerQuery = `%${query.toLowerCase()}%`;

        // Note: 'specs' is JSON, so we use 'like' on the text representation for now.
        // In a real SQLite JSON1 extension environment, we could use json_extract.
        // For MVP flexibility: LIKE %query% on specs column.

        const results = await this.db.select()
            .from(assets)
            .where(or(
                like(assets.id, lowerQuery),
                like(assets.specs, lowerQuery)
            ))
            .limit(10);

        // Enhance with pending bookings (N+1 query for MVP simplicity, separate later if slow)
        const assetsWithBookings: AssetWithHistory[] = [];

        for (const asset of results) {
            const pending = await this.db.select()
                .from(bookings)
                .where(
                    // bookings.assetId == asset.id AND status != 'completed'
                    // For "Today's", we would filter by date.
                    // For now, let's just get any active booking.
                    sql`${bookings.assetId} = ${asset.id} AND ${bookings.status} IN ('pending', 'confirmed')`
                )
                .limit(1);

            assetsWithBookings.push({
                ...asset,
                specs: typeof asset.specs === 'string' ? JSON.parse(asset.specs) : asset.specs,
                pendingBookings: pending as any
            });
        }

        return assetsWithBookings;
    }

    async create(input: CreateAssetInput): Promise<AssetWithHistory> {
        const id = globalThis.crypto.randomUUID();
        const now = new Date();

        await this.db.insert(assets).values({
            id,
            tenantId: input.tenantId || 'default-tenant', // MVP Fallback
            ownerId: input.ownerId || null, // Allow NULL for draft/quick create
            type: input.type,
            specs: JSON.stringify(input.specs),
            createdAt: now,
            updatedAt: now,
        });

        const newAsset = await this.db.select().from(assets).where(eq(assets.id, id)).get();

        if (!newAsset) throw new Error("Failed to create asset");

        return {
            ...newAsset,
            specs: input.specs,
            pendingBookings: []
        };
    }
}
