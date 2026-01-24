
import { useNavigate } from "react-router-dom";
import { AssetDiscovery } from "../features/repair/components/AssetDiscovery";
import { ArrowLeft } from "lucide-react";

function RepairPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <header className="px-4 py-3 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/")}
                        className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold">Repair Shop</h1>
                </div>
                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Online</div>
            </header>
            <main>
                <AssetDiscovery />
            </main>
        </div>
    );
}

export default RepairPage;
