import { useState } from "react";
import {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@zorviz/ui";
import { AlertTriangle, KeyRound, Copy, Check } from "lucide-react";
import { api } from "../lib/api";
import { useLicenseStore } from "../stores/license";

// Banner + license dialog. Shown whenever the license isn't a plain valid paid license.
export function LicenseArea() {
    const status = useLicenseStore((s) => s.status);
    const fetchLicense = useLicenseStore((s) => s.fetchLicense);
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState("");
    const [copied, setCopied] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    if (!status || status.state === "valid") return null;

    const readonly = status.access === "readonly";
    const bannerCls = readonly
        ? "bg-destructive text-destructive-foreground"
        : status.state === "grace"
          ? "bg-amber-500 text-white"
          : "bg-blue-600 text-white";

    const install = async () => {
        setBusy(true);
        setError("");
        try {
            await api.post("/api/license", { content });
            await fetchLicense();
            setContent("");
            setOpen(false);
        } catch (e) {
            setError("Could not install that license (invalid or wrong device).");
            console.error(e);
        } finally {
            setBusy(false);
        }
    };

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(status.device_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard may be unavailable */ }
    };

    return (
        <>
            <div className={`px-4 py-2 text-sm flex items-center justify-between gap-3 ${bannerCls}`}>
                <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {status.message ?? "License notice"}
                    {readonly && " — the app is read-only; your data is safe."}
                </span>
                <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setOpen(true)}>
                    <KeyRound className="w-4 h-4 mr-1" /> Enter License
                </Button>
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>License</DialogTitle>
                        <DialogDescription>
                            Send your device code to your vendor, then paste the license they issue.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">This device's code</span>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono">
                                    {status.device_code}
                                </code>
                                <Button variant="outline" size="icon" onClick={copyCode}>
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Paste license file contents</span>
                            <textarea
                                className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder='{ "data": "…", "sig": "…" }'
                            />
                        </div>
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
                            Cancel
                        </Button>
                        <Button onClick={install} disabled={busy || !content.trim()}>
                            {busy ? "Installing…" : "Install License"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
