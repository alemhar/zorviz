import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "../lib/db";

interface User {
    id: string;
    name: string;
    email: string;
    role: "admin" | "advisor" | "mechanic" | "customer";
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

// Simple hash function using Web Crypto API (browser-compatible)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            login: async (email, password) => {
                // Kysely query - type-safe and elegant
                const userRecord = await db
                    .selectFrom('users')
                    .select(['id', 'email', 'role', 'password_hash'])
                    .where('email', '=', email)
                    .limit(1)
                    .executeTakeFirst();

                if (!userRecord) {
                    throw new Error("User not found");
                }

                // Verify password
                const passwordHash = await hashPassword(password);
                if (userRecord.password_hash !== passwordHash) {
                    throw new Error("Invalid password");
                }

                set({
                    user: {
                        id: userRecord.id,
                        name: email.split('@')[0],
                        email: userRecord.email,
                        role: userRecord.role,
                    },
                    isAuthenticated: true,
                });
            },
            logout: () => set({ user: null, isAuthenticated: false }),
        }),
        {
            name: "auth-storage",
        }
    )
);
