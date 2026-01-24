import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "../lib/db";
import { users } from "@zorviz/db";
import { eq } from "drizzle-orm";

interface User {
    id: string;
    name: string;
    email: string;
    role: "admin" | "advisor" | "mechanic" | "customer";
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, role: User["role"]) => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            login: async (email, _role) => {
                // Real DB Login
                const found = await db.select().from(users).where(eq(users.email, email)).limit(1);

                if (found.length === 0) {
                    throw new Error("User not found");
                }

                const userRecord = found[0];

                set({
                    user: {
                        id: userRecord.id,
                        name: email.split('@')[0], // Simple name derivation
                        email: userRecord.email,
                        role: userRecord.role as User["role"],
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
