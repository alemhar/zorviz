import { useCallback, useEffect, useRef, useState } from "react";
import {
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@zorviz/ui";
import { Camera, Trash2, MessageSquare, Send } from "lucide-react";
import { useAuthStore } from "../../../stores/auth";
import {
    listPhotos,
    uploadPhoto,
    addPhotoNote,
    deletePhoto,
    downscaleImage,
    photoUrl,
    type Photo,
} from "../../../lib/photos-api";

function fmt(ms: number): string {
    return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// BACK-2-011: photos + append-only note thread on a job ticket. Add photo/note = any
// staff (incl. mechanics); delete photo = advisor/admin only.
export function TicketPhotos({ orderId }: { orderId: string }) {
    const role = useAuthStore((s) => s.user?.role);
    const canDelete = role === "owner" || role === "admin" || role === "advisor";

    const [photos, setPhotos] = useState<Photo[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [noteText, setNoteText] = useState("");
    const [busy, setBusy] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);

    const refresh = useCallback(() => {
        listPhotos(orderId).then(setPhotos).catch(() => {});
    }, [orderId]);
    useEffect(() => refresh(), [refresh]);

    const open = openId ? photos.find((p) => p.id === openId) ?? null : null;

    const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setUploading(true);
        try {
            const dataUrl = await downscaleImage(file);
            await uploadPhoto(orderId, dataUrl, "jpg");
            refresh();
        } catch {
            /* ignore */
        } finally {
            setUploading(false);
        }
    };

    const submitNote = async () => {
        if (!open || !noteText.trim()) return;
        setBusy(true);
        try {
            await addPhotoNote(open.id, noteText.trim());
            setNoteText("");
            const fresh = await listPhotos(orderId);
            setPhotos(fresh);
        } finally {
            setBusy(false);
        }
    };

    const removePhoto = async () => {
        if (!open) return;
        setBusy(true);
        try {
            await deletePhoto(open.id);
            setOpenId(null);
            refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Camera className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Photos</CardTitle>
                <div className="ml-auto">
                    <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
                    <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                        <Camera className="w-4 h-4 mr-1" /> {uploading ? "Adding…" : "Add Photo"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {photos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No photos yet. Snap the asset's condition or the finished work.</p>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {photos.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => { setOpenId(p.id); setNoteText(""); }}
                                className="relative aspect-square rounded-md overflow-hidden border hover:opacity-90"
                            >
                                <img src={photoUrl(p.id)} alt="" className="w-full h-full object-cover" />
                                {p.notes.length > 0 && (
                                    <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-black/60 text-white text-xs px-1.5 py-0.5">
                                        <MessageSquare className="w-3 h-3" /> {p.notes.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={open !== null} onOpenChange={(o) => { if (!o) setOpenId(null); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Photo</DialogTitle>
                    </DialogHeader>
                    {open && (
                        <div className="space-y-3">
                            <img src={photoUrl(open.id)} alt="" className="w-full max-h-[45vh] object-contain rounded-md border bg-muted/30" />
                            <div className="text-xs text-muted-foreground">
                                Added by {open.created_by || "—"} · {fmt(open.created_at)}
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-medium">Notes</div>
                                {open.notes.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No notes yet.</p>
                                ) : (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {open.notes.map((n) => (
                                            <div key={n.id} className="rounded-md border p-2">
                                                <div className="text-xs text-muted-foreground">
                                                    {n.author || "—"} · {fmt(n.created_at)}
                                                </div>
                                                <div className="text-sm whitespace-pre-wrap">{n.note}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        placeholder="Add a note…"
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNote(); } }}
                                    />
                                    <Button size="icon" disabled={busy || !noteText.trim()} onClick={submitNote}>
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {canDelete && (
                                <div className="pt-1 border-t">
                                    <Button variant="outline" size="sm" disabled={busy} onClick={removePhoto} className="mt-2">
                                        <Trash2 className="w-4 h-4 mr-1 text-destructive" /> Delete Photo
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
