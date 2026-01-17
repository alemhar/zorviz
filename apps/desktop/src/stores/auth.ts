import { create } from "zustand";
import { persist } from "zustand/middleware";

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
            login: async (email, role) => {
                // Mock login for now
                // TODO: Validate against DB
                set({
                    user: {
                        id: "1",
                        name: "Test User",
                        email,
                        role,
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
