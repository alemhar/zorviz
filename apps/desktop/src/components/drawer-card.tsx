import { useCallback, useEffect, useState } from "react";
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
import { Banknote } from "lucide-react";
import { formatMoney, toCentavos } from "@zorviz/core";
import { drawerStatus, openDrawer, closeDrawer, type DrawerSession } from "../lib/financials-api";
import { useAppConfigStore } from "../stores/app-config";
import { useConfirm } from "../components/confirm";
import { toast } from "../stores/toast";

// BACK-3-011: cash-drawer card (staff dashboard). Manual open/close — no nagging prompts;
// skipped days simply show unreconciled. Close computes expected = float + cash payments −
// drawer-paid expenses (server-side) and records the over/short.
export function DrawerCard() {
    const currency = useAppConfigStore((s) => s.config?.currency_symbol ?? "");
    const confirm = useConfirm();

    const [open, setOpen] = useState<DrawerSession | null>(null);
    const [lastClosed, setLastClosed] = useState<DrawerSession | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [dialog, setDialog] = useState<"open" | "close" | null>(null);
    const [amountStr, setAmountStr] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const refresh = useCallback(() => {
        drawerStatus()
            .then((s) => { setOpen(s.open); setLastClosed(s.last_closed); })
            .catch(() => {})
            .finally(() => setLoaded(true));
    }, []);
    useEffect(() => refresh(), [refresh]);

    const amountC = toCentavos(parseFloat(amountStr) || 0);

    const showDialog = (kind: "open" | "close") => {
        setAmountStr("");
        setError("");
        setDialog(kind);
    };

    const submit = async () => {
        const opening = dialog === "open";
        const title = opening ? "Open the day with this float?" : "Close the day with this count?";
        if (!(await confirm({ title, verb: opening ? "Slide to open" : "Slide to close" }))) return;
        setBusy(true);
        setError("");
        try {
            if (opening) {
                await openDrawer(amountC);
                toast("Day opened", "success");
            } else {
                const s = await closeDrawer(amountC);
                const diff = s.over_short ?? 0;
                toast(
                    diff === 0
                        ? "Day closed — drawer balanced exactly. 👍"
                        : diff > 0
                          ? `Day closed — over by ${formatMoney(diff, currency)}`
                          : `Day closed — SHORT by ${formatMoney(-diff, currency)}`,
                    diff < 0 ? "error" : "success"
                );
            }
            setDialog(null);
            refresh();
        } catch {
            setError(opening ? "Could not open the day." : "Could not close the day.");
        } finally {
            setBusy(false);
        }
    };

    if (!loaded) return null;

    return (
        <div className="border rounded-xl p-6 bg-card max-w-sm">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Banknote className="w-4 h-4 text-primary" /> Cash Drawer
            </h3>
            {open ? (
                <>
                    <p className="text-sm text-muted-foreground mb-1">
                        Open since {new Date(open.opened_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        {open.opened_by ? ` by ${open.opened_by}` : ""} · float {formatMoney(open.opening_float, currency)}
                    </p>
                    <Button variant="outline" className="mt-2" onClick={() => showDialog("close")}>
                        Close Day
                    </Button>
                </>
            ) : (
                <>
                    <p className="text-sm text-muted-foreground mb-1">
                        {lastClosed
                            ? `Last closed ${new Date(lastClosed.closed_at ?? 0).toLocaleDateString()} — ${
                                  (lastClosed.over_short ?? 0) === 0
                                      ? "balanced"
                                      : (lastClosed.over_short ?? 0) > 0
                                        ? `over ${formatMoney(lastClosed.over_short ?? 0, currency)}`
                                        : `short ${formatMoney(-(lastClosed.over_short ?? 0), currency)}`
                              }`
                            : "Track the till: open the day with a float, close it with a count."}
                    </p>
                    <Button variant="outline" className="mt-2" onClick={() => showDialog("open")}>
                        Open Day
                    </Button>
                </>
            )}

            <Dialog open={dialog !== null} onOpenChange={(o) => { if (!busy && !o) setDialog(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{dialog === "open" ? "Open the day" : "Close the day"}</DialogTitle>
                        <DialogDescription>
                            {dialog === "open"
                                ? "How much cash is in the drawer right now (the float)?"
                                : "Count the drawer and enter the total cash in it."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1">
                        <Label htmlFor="drawer-amt">{dialog === "open" ? "Opening float" : "Counted cash"}</Label>
                        <Input id="drawer-amt" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>Cancel</Button>
                        <Button onClick={submit} disabled={busy || amountStr.trim() === ""}>
                            {busy ? "Saving…" : dialog === "open" ? "Open Day" : "Close Day"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
