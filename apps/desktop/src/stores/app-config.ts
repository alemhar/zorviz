import { create } from "zustand";
import { db } from "../lib/db";
import type { AppConfig } from "@zorviz/db";

interface AppConfigState {
    config: AppConfig | null;
    isLoading: boolean;
    fetchConfig: () => Promise<void>;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
    config: null,
    isLoading: false,
    fetchConfig: async () => {
        set({ isLoading: true });
        try {
            const config = await db
                .selectFrom('app_config')
                .selectAll()
                .where('id', '=', 'default')
                .executeTakeFirst();

            set({ config: config || null, isLoading: false });
        } catch (e) {
            console.error("Failed to fetch app config:", e);
            set({ isLoading: false });
        }
    },
}));
