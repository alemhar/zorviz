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

// BACK-3-007: record how a finished job was paid (method + tendered + change), then mark paid.
export function PaymentDialog({ ticket, open, onOpenChange, onPaid }: Props) {
    const currency = useAppConfigStore((s) => s.config?.currency_symbol ?? "");
    const confirm = useConfirm();
    const total = ticket.total;

    const [method, setMethod] = useState<Method>("cash");
    const [tenderedStr, setTenderedStr] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setMethod("cash");
            setTenderedStr("");
            setError("");
        }
    }, [open]);

    // Non-cash tenders are exact; cash uses the entered amount.
    const tenderedC = method === "cash" ? toCentavos(parseFloat(tenderedStr) || 0) : total;
    const changeC = Math.max(0, tenderedC - total);
    const short = method === "cash" && tenderedC < total;

    const submit = async () => {
        if (short) return;
        if (!(await confirm({ title: "Record this payment?", verb: "Slide to record payment" }))) return;
        setSaving(true);
        setError("");
        try {
            const updated = await billOrder(ticket.id, { method, tendered: tenderedC });
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
                    <DialogDescription>Record how the customer paid, then mark the job paid.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-baseline justify-between rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">Amount due</span>
                        <span className="text-xl font-bold">{formatMoney(total, currency)}</span>
                    </div>

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
                                autoFocus
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
                    <Button onClick={submit} disabled={saving || short}>
                        {saving ? "Recording…" : "Record Payment"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
