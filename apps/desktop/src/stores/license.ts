import { create } from "zustand";
import { api } from "../lib/api";

export interface LicenseStatus {
    state: string; // valid | trial | grace | expired | trial_expired | wrong_device | invalid
    access: "full" | "readonly";
    device_code: string;
    shop_name: string | null;
    modules: string[];
    expires: number | null;
    trial_ends: number | null;
    message: string | null;
}

interface LicenseState {
    status: LicenseStatus | null;
    fetchLicense: () => Promise<void>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
    status: null,
    fetchLicense: async () => {
        try {
            const status = await api.get<LicenseStatus>("/api/license");
            set({ status });
        } catch (e) {
            console.error("Failed to fetch license status:", e);
        }
    },
}));
