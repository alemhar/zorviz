import { useEffect, useState } from "react";
import {
    Button,
    Input,
    Label,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@zorviz/ui";
import { formatMoney, toCentavos } from "@zorviz/core";
import { billOrder, type JobTicket } from "../../../lib/orders-api";
import { useAppConfigStore } from "../../../stores/app-config";
import { useConfirm } from "../../../components/confirm";

type Method = "cash" | "gcash" | "card";
const METHODS: { key: Method; label: string }[] = [
    { key: "cash", label: "Cash" },
    { key: "gcash", label: "GCash" },
    { key: "card", label: "Card" },
];

interface Props {
    ticket: JobTicket;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPaid: (t: JobTicket) => void;
}

// BACK-3-007/012: record a payment — full (default) or partial. A partial leaves the job `done`
// with a balance due; it flips to `paid` when the balance reaches zero (server-authoritative).
export function PaymentDialog({ ticket, open, onOpenChange, onPaid }: Props) {
    const currency = useAppConfigStore((s) => s.config?.currency_symbol ?? "");
    const confirm = useConfirm();
    const balance = ticket.balance_due ?? ticket.total;
    const partiallyPaid = (ticket.paid_total ?? 0) > 0;

    const [mode, setMode] = useState<"full" | "partial">("full");
    const [method, setMethod] = useState<Method>("cash");
    const [amountStr, setAmountStr] = useState("");
    const [tenderedStr, setTenderedStr] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setMode("full");
            setMethod("cash");
            setAmountStr("");
            setTenderedStr("");
            setError("");
        }
    }, [open]);

    // This payment's amount: the full balance, or the typed partial amount.
    const amountC = mode === "full" ? balance : toCentavos(parseFloat(amountStr) || 0);
    const overBalance = mode === "partial" && amountC > balance;
    const amountInvalid = amountC <= 0 || overBalance;
    // Non-cash tenders are exact; cash uses the entered amount.
    const tenderedC = method === "cash" ? toCentavos(parseFloat(tenderedStr) || 0) : amountC;
    const changeC = Math.max(0, tenderedC - amountC);
    const short = method === "cash" && tenderedC < amountC;

    const submit = async () => {
        if (short || amountInvalid) return;
        const verb = mode === "partial" ? "Slide to record partial payment" : "Slide to record payment";
        if (!(await confirm({ title: "Record this payment?", verb }))) return;
        setSaving(true);
        setError("");
        try {
            const updated = await billOrder(ticket.id, { method, tendered: tenderedC, amount: amountC });
            onPaid(updated);
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            setError("Could not record the payment.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Payment</DialogTitle>
                    <DialogDescription>
                        {partiallyPaid
                            ? "Record another payment toward the remaining balance."
                            : "Record how the customer paid."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-baseline justify-between rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">{partiallyPaid ? "Balance due" : "Amount due"}</span>
                        <span className="text-xl font-bold">{formatMoney(balance, currency)}</span>
                    </div>

                    <div className="space-y-1">
                        <Label>Payment</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {([["full", "Full balance"], ["partial", "Partial"]] as const).map(([k, label]) => (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setMode(k)}
                                    className={`rounded-md border p-2 text-sm font-medium transition-colors ${
                                        mode === k ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === "partial" && (
                        <div className="space-y-1">
                            <Label htmlFor="payamount">Amount to pay now</Label>
                            <Input
                                id="payamount"
                                value={amountStr}
                                onChange={(e) => setAmountStr(e.target.value)}
                                inputMode="decimal"
                                placeholder="0.00"
                                autoFocus
                            />
                            {overBalance && <p className="text-sm text-destructive">More than the remaining balance.</p>}
                            {!overBalance && amountC > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Remaining after this: {formatMoney(balance - amountC, currency)}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>Method</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {METHODS.map((m) => (
                                <button
                                    key={m.key}
                                    type="button"
                                    onClick={() => setMethod(m.key)}
                                    className={`rounded-md border p-2 text-sm font-medium transition-colors ${
                                        method === m.key ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted"
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {method === "cash" ? (
                        <div className="space-y-1">
                            <Label htmlFor="tendered">Amount tendered</Label>
                            <Input
                                id="tendered"
                                value={tenderedStr}
                                onChange={(e) => setTenderedStr(e.target.value)}
                                inputMode="decimal"
                                placeholder="0.00"
                            />
                            <div className="flex items-center justify-between pt-1 text-sm">
                                <span className="text-muted-foreground">Change</span>
                                <span className={`font-semibold ${short ? "text-destructive" : ""}`}>
                                    {short ? "Insufficient" : formatMoney(changeC, currency)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Exact amount charged via {method === "gcash" ? "GCash" : "card"}.
                        </p>
                    )}

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={submit} disabled={saving || short || amountInvalid}>
                        {saving ? "Recording…" : "Record Payment"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
