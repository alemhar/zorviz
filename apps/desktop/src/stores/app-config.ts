import { create } from "zustand";
import { api } from "../lib/api";
import type { AppConfig } from "@zorviz/db";

interface AppConfigState {
    config: AppConfig | null;
    isChecked: boolean; // has the initial setup check completed?
    isSetup: boolean; // does an app_config row exist?
    isLoading: boolean;
    fetchConfig: () => Promise<void>;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
    config: null,
    isChecked: false,
    isSetup: false,
    isLoading: false,
    fetchConfig: async () => {
        set({ isLoading: true });
        try {
            const config = await api.get<AppConfig | null>("/api/config");
            set({
                config: config ?? null,
                isSetup: !!config,
                isChecked: true,
                isLoading: false,
            });
        } catch (e) {
            console.error("Failed to fetch app config:", e);
            // A failure (e.g. server not ready) is treated as "checked, not set up".
            set({ isChecked: true, isLoading: false });
        }
    },
}));
