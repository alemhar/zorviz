// Typed client for the repair data endpoints (single path — data lives in the Rust API).
import { api } from "./api";
import type { AssetWithHistory, CreateAssetInput } from "@zorviz/feature-repair";

export function searchAssets(query: string): Promise<AssetWithHistory[]> {
    return api.get<AssetWithHistory[]>(`/api/assets?q=${encodeURIComponent(query)}`);
}

export function createAsset(input: CreateAssetInput): Promise<AssetWithHistory> {
    return api.post<AssetWithHistory>("/api/assets", {
        type: input.type,
        specs: input.specs,
        owner_id: input.ownerId ?? null,
    });
}
