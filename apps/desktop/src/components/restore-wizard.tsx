import { useState } from "react";
import {
    Button,
    Input,
    Label,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@zorviz/ui";
import { CloudDownload, ArrowLeft, CheckCircle2 } from "lucide-react";
import { PinInput } from "./pin-input";
import { useAppConfigStore } from "../stores/app-config";

// Cloud Restore wizard (protocol v2 §10, BACK-4-016 Part 1). Fetches the snapshot from the
// cloud in the webview (same CORS path the sync push uses) and hands it to the local restore
// endpoint. Every failure is a clear message + a clean way back — the local DB is untouched
// until the transactional restore succeeds.

type Phase = "form" | "confirm" | "restoring" | "claim" | "done";

interface TenantInfo {
    tenant_id: string;
    shop_name: string;
    has_data: boolean;
}

interface AdminRow {
    id: string;
    name: string;
    username: string;
    role: string;
}

const TIMEOUT = 20_000;

async function cloudGet<T>(base: string, path: string, token: string): Promise<T> {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
        const res = await fetch(`${base}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
        });
        if (res.status === 402) throw new Error("This shop's subscription is inactive. Reactivate to recover — your data is safe.");
        if (res.status === 401 || res.status === 403) throw new Error("The device token was rejected. Double-check it, or ask for a replacement token.");
        if (res.status === 404) throw new Error("This cloud doesn't support restore yet.");
        if (!res.ok) throw new Error(`Cloud error (${res.status}).`);
        return (await res.json()) as T;
    } finally {
        clearTimeout(to);
    }
}

export function RestoreWizard({ onBack }: { onBack: () => void }) {
    const fetchConfig = useAppConfigStore((s) => s.fetchConfig);
    const [phase, setPhase] = useState<Phase>("form");
    const [url, setUrl] = useState("");
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState<TenantInfo | null>(null);
    const [admins, setAdmins] = useState<AdminRow[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [claimId, setClaimId] = useState("");
    const [pin, setPin] = useState("");
    const [claimedUsername, setClaimedUsername] = useState("");

    const base = url.trim().replace(/\/+$/, "");

    const connect = async () => {
        setBusy(true);
        setError("");
        try {
            const t = await cloudGet<TenantInfo>(base, "/sync/tenant-info", token.trim());
            if (!t.has_data) {
                setError("This shop has no cloud data to restore yet — set up as a new shop instead.");
                return;
            }
            setInfo(t);
            setPhase("confirm");
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "Can't reach the cloud. Check the URL and your connection.");
        } finally {
            setBusy(false);
        }
    };

    const restore = async () => {
        if (!info) return;
        setBusy(true);
        setError("");
        setPhase("restoring");
        try {
            const snap = await cloudGet<{ snapshot_at: number; tables: Record<string, unknown[]> }>(
                base,
                "/sync/snapshot",
                token.trim()
            );
            const res = await fetch("/api/setup/restore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cloud_url: base,
                    device_token: token.trim(),
                    tenant_id: info.tenant_id,
                    shop_name: info.shop_name,
                    snapshot_at: snap.snapshot_at,
                    tables: snap.tables,
                }),
            });
            const body = (await res.json().catch(() => ({}))) as {
                admins?: AdminRow[];
                counts?: Record<string, number>;
            };
            if (!res.ok) {
                throw new Error((body as { error?: string }).error || (typeof body === "string" ? body : "The restore failed — nothing was written."));
            }
            setAdmins(body.admins ?? []);
            setCounts(body.counts ?? {});
            if ((body.admins ?? []).length === 1) setClaimId(body.admins![0].id);
            setPhase("claim");
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "The restore failed — nothing was written. You can retry safely.");
            setPhase("confirm");
        } finally {
            setBusy(false);
        }
    };

    const claim = async () => {
        setBusy(true);
        setError("");
        try {
            const res = await fetch("/api/setup/restore-claim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: claimId, pin }),
            });
            const body = (await res.json().catch(() => ({}))) as { username?: string; error?: string };
            if (!res.ok) throw new Error(body.error || "Couldn't set the PIN.");
            setClaimedUsername(body.username ?? "");
            setPhase("done");
        } catch (e) {
            setError(e instanceof Error && e.message ? e.message : "Couldn't set the PIN.");
        } finally {
            setBusy(false);
        }
    };

    const finish = async () => {
        await fetchConfig(); // config now exists → the app flips to the login screen
    };

    const restoredRows = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
        <Card className="w-full max-w-lg">
            <CardHeader>
                <div className="flex justify-center mb-2">
                    <div className="p-3 bg-primary/10 rounded-full">
                        <CloudDownload className="w-7 h-7 text-primary" />
                    </div>
                </div>
                <CardTitle className="text-2xl text-center">Restore from Wurkz Cloud</CardTitle>
                <CardDescription className="text-center">
                    {phase === "form" && "Enter the cloud address and the device token you received."}
                    {phase === "confirm" && "Confirm this is your shop."}
                    {phase === "restoring" && "Bringing your shop back…"}
                    {phase === "claim" && "Pick your account and set a new PIN."}
                    {phase === "done" && "Your shop is back."}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                {phase === "form" && (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="rw-url">Cloud address</Label>
                            <Input id="rw-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://cloud.example.com/api" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rw-token">Device token</Label>
                            <Input id="rw-token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="issued by Wurkz support" />
                            <p className="text-xs text-muted-foreground">
                                Lost your PC? Contact us for a replacement token — it also shuts out the old machine.
                            </p>
                        </div>
                    </>
                )}

                {phase === "confirm" && info && (
                    <div className="rounded-lg border p-4 space-y-1 text-center">
                        <div className="text-sm text-muted-foreground">Found your shop on the cloud:</div>
                        <div className="text-xl font-semibold">{info.shop_name}</div>
                        <p className="text-xs text-muted-foreground pt-2">
                            Everything synced to the cloud comes back: customers, jobs, inventory, money records, bookings, staff.
                        </p>
                    </div>
                )}

                {phase === "restoring" && (
                    <p className="text-center text-muted-foreground py-8">Downloading and writing your shop data…</p>
                )}

                {phase === "claim" && (
                    <>
                        <div className="space-y-2">
                            <Label>Who are you?</Label>
                            <div className="space-y-1.5">
                                {admins.map((a) => (
                                    <button
                                        key={a.id}
                                        onClick={() => setClaimId(a.id)}
                                        className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${claimId === a.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                                    >
                                        <span className="font-medium">{a.name}</span>{" "}
                                        <span className="text-muted-foreground">· {a.username} · {a.role}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="block text-center">New PIN (6 digits)</Label>
                            <PinInput length={6} value={pin} onChange={setPin} />
                        </div>
                    </>
                )}

                {phase === "done" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-center gap-2 text-green-600">
                            <CheckCircle2 className="w-6 h-6" />
                            <span className="font-medium">{restoredRows} records restored</span>
                        </div>
                        <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1.5">
                            <p className="font-medium text-foreground">A few things don't travel — quick fixes:</p>
                            <p>• <span className="text-foreground">Staff PINs</span> — you just set yours{claimedUsername ? ` (${claimedUsername})` : ""}; set the others from Staff.</p>
                            <p>• <span className="text-foreground">Shop logo</span> — re-upload it in Settings.</p>
                            <p>• <span className="text-foreground">License</span> — contact us for a free re-issue; the shop runs on trial meanwhile, nothing is blocked.</p>
                            <p>• <span className="text-foreground">Job photos & phone pairings</span> — photos stay on the old machine's backups; re-pair phones from the login screen QR.</p>
                        </div>
                    </div>
                )}

                {error && <p className="text-sm text-destructive text-center">{error}</p>}
            </CardContent>

            <CardFooter className="flex justify-between">
                {phase === "form" && (
                    <>
                        <Button variant="outline" onClick={onBack} disabled={busy}>
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <Button onClick={connect} disabled={busy || !base || !token.trim()}>
                            {busy ? "Connecting…" : "Connect"}
                        </Button>
                    </>
                )}
                {phase === "confirm" && (
                    <>
                        <Button variant="outline" onClick={() => { setPhase("form"); setError(""); }} disabled={busy}>
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <Button onClick={restore} disabled={busy}>Restore this shop</Button>
                    </>
                )}
                {phase === "claim" && (
                    <Button className="w-full" onClick={claim} disabled={busy || !claimId || pin.length !== 6}>
                        {busy ? "Saving…" : "Set PIN & finish"}
                    </Button>
                )}
                {phase === "done" && (
                    <Button className="w-full" onClick={finish}>Go to sign in</Button>
                )}
            </CardFooter>
        </Card>
    );
}
