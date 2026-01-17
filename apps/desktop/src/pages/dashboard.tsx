import { useAuthStore } from "../stores/auth";
import { Button, ThemeSwitcher } from "@zorviz/ui";
import { useNavigate } from "react-router-dom";
import { ServerStatus } from "../components/server-status";

export default function DashboardPage() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b p-4 flex items-center justify-between bg-card/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <h1 className="font-bold text-xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Zorviz</h1>
                    <ServerStatus />
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{user?.email} ({user?.role})</span>
                    <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
                </div>
            </header>
            <main className="p-8 space-y-8">
                <h2 className="text-3xl font-bold">Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 border rounded-lg bg-card shadow-sm">
                        <h3 className="font-semibold text-lg mb-2">Active Jobs</h3>
                        <p className="text-3xl font-bold">12</p>
                    </div>
                    <div className="p-6 border rounded-lg bg-card shadow-sm">
                        <h3 className="font-semibold text-lg mb-2">Pending Estimates</h3>
                        <p className="text-3xl font-bold">5</p>
                    </div>
                    <div className="p-6 border rounded-lg bg-card shadow-sm">
                        <h3 className="font-semibold text-lg mb-2">Parts Low Stock</h3>
                        <p className="text-3xl font-bold text-destructive">3</p>
                    </div>
                </div>

                <div className="border rounded-lg p-6 bg-card max-w-sm">
                    <h3 className="font-semibold mb-4">Appearance</h3>
                    <ThemeSwitcher />
                </div>
            </main>
        </div>
    );
}
