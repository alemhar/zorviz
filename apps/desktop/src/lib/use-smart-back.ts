import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

// Back navigation that returns to wherever the user actually came from (browser history),
// with a role-appropriate fallback when there's no history to pop — e.g. a deep-linked page
// opened right after login. React Router sets location.key === "default" on a fresh entry.
// (BACK-2-017)
export function useSmartBack(fallback?: string): () => void {
    const navigate = useNavigate();
    const location = useLocation();
    const role = useAuthStore((s) => s.user?.role);
    return () => {
        if (location.key !== "default") {
            navigate(-1);
            return;
        }
        if (fallback) {
            navigate(fallback);
            return;
        }
        // No explicit fallback: mechanics live in My Jobs; staff go to the dashboard.
        navigate(role === "mechanic" ? "/jobs" : "/");
    };
}
