import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "../lib/db";
import { verifyPin } from "../lib/crypto";
import type { UserRole } from "@zorviz/db";

interface User {
    id: string;
    name: string;
    username: string;
    role: UserRole;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    failedAttempts: number;
    lockedUntil: number | null;
    login: (username: string, pin: string) => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            failedAttempts: 0,
            lockedUntil: null,
            login: async (username, pin) => {
                const lockedUntil = get().lockedUntil;
                if (lockedUntil && Date.now() < lockedUntil) {
                    const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
                    throw new Error(`Too many attempts. Try again in ${secs}s.`);
                }

                const record = await db
                    .selectFrom("users")
                    .select(["id", "name", "username", "role", "pin_hash", "pin_salt", "is_active"])
                    .where("username", "=", username.trim())
                    .limit(1)
                    .executeTakeFirst();

                const ok =
                    !!record &&
                    record.is_active === 1 &&
                    (await verifyPin(pin, record.pin_hash, record.pin_salt));

                if (!ok) {
                    const attempts = get().failedAttempts + 1;
                    const shouldLock = attempts >= MAX_ATTEMPTS;
                    set({
                        failedAttempts: shouldLock ? 0 : attempts,
                        lockedUntil: shouldLock ? Date.now() + LOCKOUT_MS : get().lockedUntil,
                    });
                    throw new Error("Invalid username or PIN.");
                }

                set({
                    user: {
                        id: record.id,
                        name: record.name,
                        username: record.username,
                        role: record.role,
                    },
                    isAuthenticated: true,
                    failedAttempts: 0,
                    lockedUntil: null,
                });
            },
            logout: () => set({ user: null, isAuthenticated: false }),
        }),
        {
            name: "auth-storage",
            partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
        }
    )
);
