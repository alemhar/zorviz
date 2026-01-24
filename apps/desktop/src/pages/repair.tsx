
import { AssetDiscovery } from "../features/repair/components/AssetDiscovery";

function RepairPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <header className="px-4 py-3 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between">
                <h1 className="text-lg font-bold">Repair</h1>
                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Online</div>
            </header>
            <main>
                <AssetDiscovery />
            </main>
        </div>
    );
}

export default RepairPage;
