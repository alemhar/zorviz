// Client for shop asset-type configuration (BACK-1-006, single-path HTTP API).
import { api } from "./api";

export type FieldKind = "text" | "number";

export interface FieldDef {
    key: string;
    label: string;
    kind: FieldKind;
    required: boolean;
}

// A saved asset type (as returned by the API).
export interface AssetType {
    id: string;
    tenant_id: string;
    key: string;
    name: string;
    icon: string | null;
    fields: FieldDef[];
    show_on_create: number; // 0 | 1
    sort_order: number;
    created_at: number;
    updated_at: number;
}

// A built-in starter template (no id; served pre-login to the setup wizard).
export interface AssetTypeTemplate {
    key: string;
    name: string;
    icon: string | null;
    fields: FieldDef[];
}

// Payload for create/update (and for the wizard's selected types passed to /api/setup).
export interface AssetTypeInput {
    key?: string;
    name: string;
    icon?: string | null;
    fields: FieldDef[];
    show_on_create?: boolean;
}

export function getAssetTypeTemplates(): Promise<AssetTypeTemplate[]> {
    return api.get<AssetTypeTemplate[]>("/api/asset-type-templates");
}

export function listAssetTypes(): Promise<AssetType[]> {
    return api.get<AssetType[]>("/api/asset-types");
}

export function createAssetType(input: AssetTypeInput): Promise<AssetType> {
    return api.post<AssetType>("/api/asset-types", input);
}

export function updateAssetType(id: string, input: AssetTypeInput): Promise<AssetType> {
    return api.put<AssetType>(`/api/asset-types/${id}`, input);
}

export function deleteAssetType(id: string): Promise<{ ok: boolean }> {
    return api.del<{ ok: boolean }>(`/api/asset-types/${id}`);
}
