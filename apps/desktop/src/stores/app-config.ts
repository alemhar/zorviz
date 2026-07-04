import { create } from "zustand";
import { db } from "../lib/db";
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
            const config = await db
                .selectFrom("app_config")
                .selectAll()
                .where("id", "=", "default")
                .executeTakeFirst();

            set({
                config: config ?? null,
                isSetup: !!config,
                isChecked: true,
                isLoading: false,
            });
        } catch (e) {
            console.error("Failed to fetch app config:", e);
            // A query failure (e.g. DB not ready) is treated as "not checked yet"
            set({ isChecked: true, isLoading: false });
        }
    },
}));
