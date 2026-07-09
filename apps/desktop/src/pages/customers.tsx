import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@zorviz/ui";
import { ArrowLeft, BookUser, ChevronRight, Search } from "lucide-react";
import { formatMoney } from "@zorviz/core";
import { customerDirectory, type CustomerRow } from "../lib/parties-api";
import { useAppConfigStore } from "../stores/app-config";

// Customer directory: search everyone, spot open balances at a glance, tap → profile.
export default function CustomersPage() {
    const navigate = useNavigate();
    const currency = useAppConfigStore((s) => s.config?.currency_symbol ?? "");
    const [q, setQ] = useState("");
    const [rows, setRows] = useState<CustomerRow[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => {
            customerDirectory(q).then(setRows).catch(() => {}).finally(() => setLoaded(true));
        }, q ? 250 : 0);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <div className="min-h-screen bg-background">
            <header className="px-4 py-3 bg-card shadow-sm flex items-center gap-3">
                <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted" aria-label="Back to dashboard">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <BookUser className="w-5 h-5 text-primary" />
                <h1 className="text-lg font-bold">Customers</h1>
            </header>

            <main className="p-4 max-w-2xl mx-auto space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…" className="pl-9" />
                </div>

                {loaded && rows.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        {q ? "No customers match that search." : "No customers yet — they're created with their first job or booking."}
                    </p>
                )}

                <div className="border rounded-xl bg-card divide-y divide-border/60 overflow-hidden">
                    {rows.map((c) => (
                        <button
                            key={c.id}
                            onClick={() => navigate(`/customers/${c.id}`)}
                            className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{c.name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {c.phone ?? "no phone"} · {c.jobs} job{c.jobs === 1 ? "" : "s"} · {formatMoney(c.lifetime_paid, currency)} lifetime
                                </div>
                            </div>
                            {c.balance > 0 && (
                                <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive tabular-nums">
                                    owes {formatMoney(c.balance, currency)}
                                </span>
                            )}
                            <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                        </button>
                    ))}
                </div>
            </main>
        </div>
    );
}
