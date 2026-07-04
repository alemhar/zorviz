import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, ApiError, setAuthToken, setUnauthorizedHandler } from "../lib/api";
import type { UserRole } from "@zorviz/db";

interface User {
    id: string;
    name: string;
    username: string;
    role: UserRole;
}

interface LoginResponse {
    token: string;
    user: User;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (username: string, pin: string) => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            login: async (username, pin) => {
                try {
                    const res = await api.post<LoginResponse>("/api/login", {
                        username: username.trim(),
                        pin,
                    });
                    setAuthToken(res.token);
                    set({ user: res.user, token: res.token, isAuthenticated: true });
                } catch (e) {
                    if (e instanceof ApiError) {
                        throw new Error(e.message || "Login failed.");
                    }
                    throw new Error("Could not reach the server.");
                }
            },
            logout: () => {
                // Best-effort server-side session teardown; ignore failures.
                api.post("/api/logout").catch(() => {});
                setAuthToken(null);
                set({ user: null, token: null, isAuthenticated: false });
            },
        }),
        {
            name: "auth-storage",
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                isAuthenticated: state.isAuthenticated,
            }),
            onRehydrateStorage: () => (state) => {
                // Re-arm the API client with the persisted token after a reload.
                if (state?.token) setAuthToken(state.token);
            },
        }
    )
);

// A 401 from any API call (expired/lost session) forces a clean logout.
setUnauthorizedHandler(() => {
    useAuthStore.getState().logout();
});
