import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@zorviz/ui";
import { ArrowLeft, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { getOrder, type JobTicket, type InspectionItem } from "../lib/orders-api";
import { StatusBadge } from "../components/status-badge";

function assetTitle(asset?: JobTicket["asset"]): string {
    if (!asset) return "Unknown asset";
    const s = asset.specs as Record<string, string>;
    return s.plateNumber || s.serialNumber || s.imei || [s.make, s.model].filter(Boolean).join(" ") || "Asset";
}

const INSPECTION_ICON: Record<InspectionItem["status"], typeof CheckCircle2> = {
    ok: CheckCircle2,
    issue: AlertTriangle,
    na: MinusCircle,
};

export default function JobTicketPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState<JobTicket | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        getOrder(id)
            .then(setTicket)
            .catch(() => setError("Could not load this job ticket."));
    }, [id]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            <header className="px-4 py-3 bg-white dark:bg-slate-800 shadow-sm flex items-center gap-3">
                <button onClick={() => navigate("/repair")} className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold">Job Ticket</h1>
                {ticket && <StatusBadge status={ticket.status} />}
            </header>

            <main className="p-4 max-w-md mx-auto space-y-4">
                {error && <p className="text-sm text-destructive">{error}</p>}
                {!ticket && !error && <p className="text-muted-foreground">Loading…</p>}

                {ticket && (
                    <>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">{assetTitle(ticket.asset)}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground space-y-1">
                                <div className="capitalize">{ticket.asset?.type}</div>
                                {ticket.customer && (
                                    <div>
                                        {ticket.customer.name}
                                        {ticket.customer.phone ? ` · ${ticket.customer.phone}` : ""}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Customer Complaint</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                {ticket.customer_complaint || <span className="text-muted-foreground">None recorded</span>}
                            </CardContent>
                        </Card>

                        {ticket.inspection && ticket.inspection.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Initial Inspection</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {ticket.inspection.map((it) => {
                                        const Icon = INSPECTION_ICON[it.status];
                                        const color =
                                            it.status === "ok" ? "text-green-600" : it.status === "issue" ? "text-red-600" : "text-muted-foreground";
                                        return (
                                            <div key={it.item} className="flex items-start gap-2 text-sm">
                                                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                                                <div>
                                                    <span>{it.item}</span>
                                                    {it.status === "issue" && it.note && (
                                                        <span className="text-muted-foreground"> — {it.note}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
