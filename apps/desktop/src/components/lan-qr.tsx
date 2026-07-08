import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import { Button } from "@zorviz/ui";
import { Printer } from "lucide-react";
import { useAppConfigStore } from "../stores/app-config";
import { toast } from "../stores/toast";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// BACK-2-027: QR of the current LAN server URL so a mechanic's phone can scan to connect
// (the desktop's IP changes over time). Fetches the live URL on mount so it never goes stale.
// Optional printable PDF (decision D9: download, the shop prints it).
export function LanQr({ showDownload = false, size = 176 }: { showDownload?: boolean; size?: number }) {
    const shopName = useAppConfigStore((s) => s.config?.shop_name ?? "Zorviz");
    const [url, setUrl] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isTauri) return;
        invoke<string | null>("get_server_url")
            .then((u) => { if (u) setUrl(u); })
            .catch(() => {});
    }, []);

    if (!isTauri) return null; // only meaningful on the desktop (commander) screen
    if (!url) {
        return <p className="text-sm text-muted-foreground">LAN server not available yet.</p>;
    }

    const downloadPdf = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            const doc = new jsPDF();
            const cx = 105; // page center (A4 width 210mm)
            doc.setFont("helvetica", "bold");
            doc.setFontSize(20);
            doc.text(shopName, cx, 32, { align: "center" });
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.text("Scan with your phone camera to connect", cx, 42, { align: "center" });
            const png = canvas.toDataURL("image/png");
            doc.addImage(png, "PNG", cx - 45, 52, 90, 90);
            doc.setFontSize(11);
            doc.text(url, cx, 156, { align: "center" });
            doc.setFontSize(9);
            doc.setTextColor(120);
            doc.text("Connect to the same Wi-Fi as the shop's main computer.", cx, 168, { align: "center" });
            doc.save("connect-qr.pdf");
            toast("Saved to Downloads · connect-qr.pdf", "success");
        } catch (e) {
            console.error(e);
            toast("Couldn't generate the QR PDF.", "error");
        }
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeCanvas ref={canvasRef} value={url} size={size} marginSize={2} />
            </div>
            <code className="text-xs text-muted-foreground break-all text-center">{url}</code>
            {showDownload && (
                <Button variant="outline" size="sm" onClick={downloadPdf}>
                    <Printer className="w-4 h-4 mr-1" /> Download QR (PDF)
                </Button>
            )}
        </div>
    );
}
