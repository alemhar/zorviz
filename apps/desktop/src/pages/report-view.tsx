import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@zorviz/ui";
import { ArrowLeft, Download } from "lucide-react";
import { formatMoney } from "@zorviz/core";
import {
    financialSummary,
    seniorPwdReport,
    mechanicReport,
    type FinancialSummary,
    type SeniorPwdRow,
    type MechanicRow,
} from "../lib/reports-api";
import { listPayables, type Payable } from "../lib/inventory-api";
import {
    pnlPdf,
    vatSummaryPdf,
    seniorPwdPdf,
    mechanicsPdf,
    payablesPdf,
    methodLabel,
} from "../lib/report-pdf";
import { useAppConfigStore } from "../stores/app-config";
import { useAuthStore } from "../stores/auth";
import { toast } from "../stores/toast";

// BACK-3-018: on-screen (read-only) report previews. The screen is the canonical view;
// the PDF is an export of the same endpoint payload, so the two can't disagree.

export type ReportKey = "pnl" | "vat" | "senior" | "mechanics" | "payables";

export const REPORT_META: Record<ReportKey, { title: string; desc: string; periodless?: boolean }> = {
    pnl: { title: "Profit & Loss Summary", desc: "Collections, expenses by category, gross margin, and the net result." },
    vat: { title: "VAT Summary", desc: "VAT collected (pro-rata per payment), VAT-exempt collections — the BIR set-aside." },
    senior: { title: "Senior / PWD Discount Record", desc: "BIR-style record of Senior/PWD-discounted sales with ID numbers and discounts." },
    mechanics: { title: "Mechanic Productivity", desc: "Jobs completed, average and total wrench time, and job value per mechanic." },
    payables: { title: "Supplier Payables", desc: "Outstanding on-account stock receives — what the shop currently owes suppliers.", periodless: true },
};

type Preset = "today" | "week" | "month" | "all" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" },
    { key: "all", label: "All time" },
    { key: "custom", label: "Custom" },
];

function startOfDay(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function resolveRange(preset: Preset, fromStr: string, toStr: string): [number, number] {
    const now = new Date();
    const dayMs = 86400000;
    switch (preset) {
        case "today":
            return [startOfDay(now), Date.now()];
        case "week": {
            const dow = (now.getDay() + 6) % 7; // Monday-based
            return [startOfDay(now) - dow * dayMs, Date.now()];
        }
        case "month":
            return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), Date.now()];
        case "all":
            return [0, Date.now()];
        case "custom": {
            const f = fromStr ? new Date(fromStr).getTime() : 0;
            const t = toStr ? new Date(toStr).getTime() + dayMs - 1 : Date.now();
            return [f, t];
        }
    }
}

const fmtDur = (ms: number) => {
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m`;
};
const fmtD = (ts: number) => new Date(ts).toLocaleDateString();

// ---- Shared preview building blocks (read-only, mirror the PDF sections) ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-1">
            <h3 className="text-sm font-semibold border-b pb-1">{title}</h3>
            {children}
        </section>
    );
}

function Table({ head, rows, aligns }: { head: string[]; rows: (string | number)[][]; aligns?: ("l" | "r")[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-xs text-muted-foreground">
                        {head.map((h, i) => (
                            <th key={h} className={`py-1 font-medium ${(aligns?.[i] ?? "l") === "r" ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, ri) => (
                        <tr key={ri} className="border-t border-border/50">
                            {r.map((c, ci) => (
                                <td key={ci} className={`py-1.5 ${(aligns?.[ci] ?? "l") === "r" ? "text-right tabular-nums" : ""}`}>{c}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function KV({ label, value, strong, negative }: { label: string; value: string; strong?: boolean; negative?: boolean }) {
    return (
        <div className={`flex justify-between gap-4 py-0.5 text-sm ${strong ? "font-semibold border-t mt-1 pt-1.5" : ""}`}>
            <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
            <span className={`tabular-nums ${negative ? "text-destructive" : ""}`}>{value}</span>
        </div>
    );
}

function Note({ children }: { children: React.ReactNode }) {
    return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-muted-foreground italic py-2">{children}</p>;
}

// ---- Per-report previews ----

function PnlPreview({ data, cur }: { data: FinancialSummary; cur: string }) {
    const net = data.revenue - data.expenses_total;
    return (
        <div className="space-y-5">
            <Section title="Income (collections)">
                {data.payments_by_method.length ? (
                    <Table
                        head={["Method", "Count", "Amount"]}
                        aligns={["l", "r", "r"]}
                        rows={data.payments_by_method.map((m) => [methodLabel(m.method), `${m.n}×`, formatMoney(m.total, cur)])}
                    />
                ) : (
                    <Empty>No collections in this period.</Empty>
                )}
                <KV label="Revenue" value={formatMoney(data.revenue, cur)} strong />
            </Section>
            <Section title="Expenses">
                {data.expenses_by_category.length ? (
                    <Table
                        head={["Category", "Amount"]}
                        aligns={["l", "r"]}
                        rows={data.expenses_by_category.map((e) => [e.category, formatMoney(e.total, cur)])}
                    />
                ) : (
                    <Empty>No expenses recorded in this period.</Empty>
                )}
                <KV label="Total expenses" value={formatMoney(data.expenses_total, cur)} strong />
            </Section>
            <Section title="Result">
                <KV label="Revenue" value={formatMoney(data.revenue, cur)} />
                <KV label="− Parts cost of sales (pro-rata)" value={formatMoney(data.cogs, cur)} />
                <KV label="Gross margin" value={formatMoney(data.revenue - data.cogs, cur)} />
                <KV label="− Total expenses" value={formatMoney(data.expenses_total, cur)} />
                <KV label="NET (revenue − expenses)" value={formatMoney(net, cur)} strong negative={net < 0} />
            </Section>
            <Note>Cash-basis summary from collections and the expense log. A planning gauge, not the books of account.</Note>
        </div>
    );
}

function VatPreview({ data, cur }: { data: FinancialSummary; cur: string }) {
    return (
        <div className="space-y-4">
            <div>
                <KV label="Total collections" value={formatMoney(data.revenue, cur)} />
                <KV label="VAT-exempt collections (Senior/PWD)" value={formatMoney(data.exempt_collections, cur)} />
                <KV label="VATable collections" value={formatMoney(data.revenue - data.exempt_collections, cur)} />
                <KV label="Discounts given (pro-rata)" value={formatMoney(data.discounts_given, cur)} />
                <KV label="VAT collected — set aside for BIR" value={formatMoney(data.vat_collected, cur)} strong />
            </div>
            <Note>
                VAT is apportioned pro-rata per payment (payment share × the order's VAT), consistent with collection-basis
                service VAT. This is a set-aside planning gauge — your accountant's books govern the actual return.
            </Note>
        </div>
    );
}

function SeniorPreview({ rows, cur }: { rows: SeniorPwdRow[]; cur: string }) {
    return (
        <div className="space-y-4">
            {rows.length ? (
                <>
                    <Table
                        head={["Date paid", "Ref", "Name / ID No.", "Net sale", "Discount", "Total"]}
                        aligns={["l", "l", "l", "r", "r", "r"]}
                        rows={rows.map((s) => [
                            fmtD(s.paid_at),
                            s.receipt_number ?? s.id.slice(0, 6),
                            `${s.senior_pwd_name ?? "—"} / ${s.senior_pwd_id ?? "—"}`,
                            formatMoney(s.subtotal, cur),
                            formatMoney(s.senior_discount, cur),
                            formatMoney(s.total, cur),
                        ])}
                    />
                    <div>
                        <KV label="Total discounts granted" value={formatMoney(rows.reduce((a, s) => a + s.senior_discount, 0), cur)} strong />
                        <KV label="Total VAT-exempt sales" value={formatMoney(rows.reduce((a, s) => a + s.total, 0), cur)} />
                    </div>
                </>
            ) : (
                <Empty>No Senior/PWD-discounted sales collected in this period.</Empty>
            )}
            <Note>Statutory 20% discount on the VAT-exclusive amount; sales are VAT-exempt (RA 9994 / RA 10754). Collection-basis listing.</Note>
        </div>
    );
}

function MechanicsPreview({ rows, cur }: { rows: MechanicRow[]; cur: string }) {
    return (
        <div className="space-y-4">
            {rows.length ? (
                <Table
                    head={["Mechanic", "Jobs done", "Avg time", "Total time", "Job value"]}
                    aligns={["l", "r", "r", "r", "r"]}
                    rows={rows.map((m) => [
                        m.name ?? m.assigned_mechanic_id.slice(0, 8),
                        m.jobs,
                        fmtDur(m.avg_ms),
                        fmtDur(m.total_ms),
                        formatMoney(m.revenue, cur),
                    ])}
                />
            ) : (
                <Empty>No completed, assigned jobs with timing in this period.</Empty>
            )}
            <Note>Wrench time = Start Job to Mark as Done. Job value = totals of jobs completed in the period (not collections).</Note>
        </div>
    );
}

function PayablesPreview({ items, cur }: { items: Payable[]; cur: string }) {
    return (
        <div className="space-y-4">
            {items.length ? (
                <>
                    <Table
                        head={["Date", "Item received", "Qty", "Note", "Owed"]}
                        aligns={["l", "l", "r", "l", "r"]}
                        rows={items.map((p) => [
                            fmtD(p.created_at),
                            `${p.item_name} (${p.sku})`,
                            p.delta,
                            p.note ?? "",
                            formatMoney(p.total_cost, cur),
                        ])}
                    />
                    <KV label="Total owed to suppliers" value={formatMoney(items.reduce((a, p) => a + p.total_cost, 0), cur)} strong />
                </>
            ) : (
                <Empty>No outstanding on-account receives.</Empty>
            )}
            <Note>Settle a payable by recording the paying parts expense (it links to the receive automatically).</Note>
        </div>
    );
}

// ---- Page ----

type ReportData =
    | { kind: "summary"; data: FinancialSummary }
    | { kind: "senior"; rows: SeniorPwdRow[] }
    | { kind: "mechanics"; rows: MechanicRow[] }
    | { kind: "payables"; items: Payable[] };

export default function ReportViewPage() {
    const navigate = useNavigate();
    const { key } = useParams<{ key: string }>();
    const config = useAppConfigStore((s) => s.config);
    const userName = useAuthStore((s) => s.user?.name ?? null);
    const cur = config?.currency_symbol ?? "";

    const reportKey = (key ?? "") as ReportKey;
    const meta = REPORT_META[reportKey];

    const [preset, setPreset] = useState<Preset>("month");
    const [fromStr, setFromStr] = useState("");
    const [toStr, setToStr] = useState("");
    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const periodLabel = useCallback(() => {
        if (meta?.periodless) return `As of ${new Date().toLocaleDateString()}`;
        const [f, t] = resolveRange(preset, fromStr, toStr);
        return `${f === 0 ? "All time" : new Date(f).toLocaleDateString()} — ${new Date(t).toLocaleDateString()}`;
    }, [meta, preset, fromStr, toStr]);

    useEffect(() => {
        if (!meta) return;
        let cancelled = false;
        setLoading(true);
        const [f, t] = resolveRange(preset, fromStr, toStr);
        const load = async (): Promise<ReportData> => {
            switch (reportKey) {
                case "pnl":
                case "vat":
                    return { kind: "summary", data: await financialSummary(f, t) };
                case "senior":
                    return { kind: "senior", rows: await seniorPwdReport(f, t) };
                case "mechanics":
                    return { kind: "mechanics", rows: await mechanicReport(f, t) };
                case "payables":
                    return { kind: "payables", items: await listPayables() };
            }
        };
        load()
            .then((r) => { if (!cancelled) setReport(r); })
            .catch(() => { if (!cancelled) toast("Couldn't load the report.", "error"); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [reportKey, meta, preset, fromStr, toStr]);

    if (!meta) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Button variant="outline" onClick={() => navigate("/reports")}>Back to Reports</Button>
            </div>
        );
    }

    const downloadPdf = async () => {
        setBusy(true);
        try {
            const p = periodLabel();
            const [f, t] = resolveRange(preset, fromStr, toStr);
            let file: string;
            switch (reportKey) {
                case "pnl":
                    file = pnlPdf(await financialSummary(f, t), p, config, userName);
                    break;
                case "vat":
                    file = vatSummaryPdf(await financialSummary(f, t), p, config, userName);
                    break;
                case "senior":
                    file = seniorPwdPdf(await seniorPwdReport(f, t), p, config, userName);
                    break;
                case "mechanics":
                    file = mechanicsPdf(await mechanicReport(f, t), p, config, userName);
                    break;
                case "payables":
                    file = payablesPdf(await listPayables(), config, userName);
                    break;
            }
            toast(`Saved to Downloads · ${file}`, "success");
        } catch (e) {
            console.error(e);
            toast("Couldn't generate the PDF.", "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <header className="px-4 py-3 bg-card shadow-sm flex items-center gap-3">
                <button onClick={() => navigate("/reports")} className="p-2 -ml-2 rounded-lg hover:bg-muted" aria-label="Back to Reports">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold flex-1 min-w-0 truncate">{meta.title}</h1>
                <Button size="sm" onClick={() => void downloadPdf()} disabled={busy || loading}>
                    <Download className="w-4 h-4 mr-1" /> {busy ? "…" : "PDF"}
                </Button>
            </header>

            <main className="p-4 max-w-2xl mx-auto space-y-4">
                {!meta.periodless && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.key}
                                    onClick={() => setPreset(p.key)}
                                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                        preset === p.key ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {preset === "custom" && (
                            <div className="flex items-center gap-2 text-xs">
                                <input type="date" value={fromStr} max={toStr || undefined} onChange={(e) => setFromStr(e.target.value)} className="flex-1 rounded-md border px-2 py-1 bg-background" aria-label="From date" />
                                <span className="text-muted-foreground">to</span>
                                <input type="date" value={toStr} min={fromStr || undefined} onChange={(e) => setToStr(e.target.value)} className="flex-1 rounded-md border px-2 py-1 bg-background" aria-label="To date" />
                            </div>
                        )}
                    </div>
                )}

                <div className="border rounded-xl bg-card p-4 sm:p-6 space-y-4">
                    <div className="flex items-baseline justify-between gap-3 border-b pb-2">
                        <div className="font-semibold">{config?.shop_name || "Zorviz"}</div>
                        <div className="text-xs text-muted-foreground">{periodLabel()}</div>
                    </div>
                    {loading || !report ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
                    ) : report.kind === "summary" && reportKey === "pnl" ? (
                        <PnlPreview data={report.data} cur={cur} />
                    ) : report.kind === "summary" ? (
                        <VatPreview data={report.data} cur={cur} />
                    ) : report.kind === "senior" ? (
                        <SeniorPreview rows={report.rows} cur={cur} />
                    ) : report.kind === "mechanics" ? (
                        <MechanicsPreview rows={report.rows} cur={cur} />
                    ) : (
                        <PayablesPreview items={report.items} cur={cur} />
                    )}
                </div>
            </main>
        </div>
    );
}
