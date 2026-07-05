import { useCallback, useEffect, useState } from "react";
import {
    Button,
    Input,
    Label,
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@zorviz/ui";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Shapes } from "lucide-react";
import {
    listAssetTypes,
    createAssetType,
    updateAssetType,
    deleteAssetType,
    type AssetType,
    type FieldDef,
    type FieldKind,
} from "../../../lib/asset-types-api";
import { iconFor, ASSET_ICON_KEYS } from "../../../lib/asset-icons";

type EditorState = { mode: "new" } | { mode: "edit"; type: AssetType } | null;

// Admin-only editor for the shop's asset types (BACK-1-006).
export function AssetTypesSettings({ readOnly }: { readOnly: boolean }) {
    const [types, setTypes] = useState<AssetType[]>([]);
    const [editor, setEditor] = useState<EditorState>(null);
    const [confirmDelete, setConfirmDelete] = useState<AssetType | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(() => {
        listAssetTypes().then(setTypes).catch(() => {});
    }, []);
    useEffect(() => refresh(), [refresh]);

    const toggleShow = async (t: AssetType) => {
        if (readOnly) return;
        try {
            await updateAssetType(t.id, {
                name: t.name,
                icon: t.icon,
                fields: t.fields,
                show_on_create: t.show_on_create === 0, // flip
            });
            refresh();
        } catch { /* ignore */ }
    };

    const doDelete = async () => {
        if (!confirmDelete) return;
        setBusy(true);
        try {
            await deleteAssetType(confirmDelete.id);
            setConfirmDelete(null);
            refresh();
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Shapes className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Asset Types</CardTitle>
                {!readOnly && (
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditor({ mode: "new" })}>
                        <Plus className="w-4 h-4 mr-1" /> Add Type
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                    What this shop services. Types turned off are hidden when creating a ticket, but existing
                    assets and history are never affected.
                </p>
                {types.length === 0 && <p className="text-sm text-muted-foreground">No asset types yet.</p>}
                {types.map((t) => {
                    const Icon = iconFor(t.icon);
                    return (
                        <div key={t.id} className="flex items-center gap-3 rounded-md border p-3">
                            <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">
                                    {t.name}
                                    {t.show_on_create === 0 && (
                                        <span className="ml-2 text-xs text-muted-foreground">(hidden at ticket creation)</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground">{t.fields.length} field(s)</div>
                            </div>
                            {!readOnly && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <label className="flex items-center gap-1 text-xs mr-1 select-none">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={t.show_on_create === 1}
                                            onChange={() => toggleShow(t)}
                                        />
                                        Show
                                    </label>
                                    <Button variant="outline" size="icon" onClick={() => setEditor({ mode: "edit", type: t })}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={() => setConfirmDelete(t)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>

            {editor && (
                <AssetTypeEditor
                    state={editor}
                    onClose={() => setEditor(null)}
                    onSaved={() => { setEditor(null); refresh(); }}
                />
            )}

            <Dialog open={!!confirmDelete} onOpenChange={(o) => { if (!busy && !o) setConfirmDelete(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete "{confirmDelete?.name}"?</DialogTitle>
                        <DialogDescription>
                            New assets can no longer use this type. Existing assets of this type keep their data
                            and stay searchable.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={busy}>Cancel</Button>
                        <Button variant="destructive" onClick={doDelete} disabled={busy}>
                            {busy ? "Deleting…" : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

const KINDS: FieldKind[] = ["text", "number"];

function AssetTypeEditor({
    state,
    onClose,
    onSaved,
}: {
    state: { mode: "new" } | { mode: "edit"; type: AssetType };
    onClose: () => void;
    onSaved: () => void;
}) {
    const existing = state.mode === "edit" ? state.type : null;
    const [name, setName] = useState(existing?.name ?? "");
    const [icon, setIcon] = useState<string>(existing?.icon ?? "wrench");
    const [fields, setFields] = useState<FieldDef[]>(existing?.fields ?? []);
    const [showOnCreate, setShowOnCreate] = useState(existing ? existing.show_on_create === 1 : true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const setField = (i: number, patch: Partial<FieldDef>) =>
        setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    const move = (i: number, dir: -1 | 1) =>
        setFields((prev) => {
            const j = i + dir;
            if (j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });

    const save = async () => {
        if (!name.trim()) return setError("Type name is required.");
        const cleanFields = fields
            .filter((f) => f.label.trim())
            .map((f) => ({ key: f.key, label: f.label.trim(), kind: f.kind, required: f.required }));
        if (cleanFields.length === 0) return setError("Add at least one field.");
        setBusy(true);
        setError("");
        try {
            const payload = { name: name.trim(), icon, fields: cleanFields, show_on_create: showOnCreate };
            if (existing) await updateAssetType(existing.id, payload);
            else await createAssetType(payload);
            onSaved();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{existing ? "Edit Asset Type" : "New Asset Type"}</DialogTitle>
                    <DialogDescription>Define what a {name.trim() || "type"} record looks like.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="space-y-1">
                        <Label htmlFor="at-name">Name</Label>
                        <Input id="at-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vehicle" />
                    </div>

                    <div className="space-y-1">
                        <Label>Icon</Label>
                        <div className="flex flex-wrap gap-2">
                            {ASSET_ICON_KEYS.map((k) => {
                                const I = iconFor(k);
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setIcon(k)}
                                        className={`rounded-md border p-2 transition-colors ${icon === k ? "bg-primary/10 border-primary text-primary" : "hover:bg-muted"}`}
                                        aria-label={k}
                                    >
                                        <I className="w-5 h-5" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Fields</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setFields((p) => [...p, { key: "", label: "", kind: "text", required: false }])}
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add Field
                            </Button>
                        </div>
                        {fields.length === 0 && <p className="text-xs text-muted-foreground">No fields yet.</p>}
                        {fields.map((f, i) => (
                            <div key={i} className="rounded-md border p-2 space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        className="flex-1"
                                        value={f.label}
                                        placeholder="Field label (e.g. Plate Number)"
                                        onChange={(e) => setField(i, { label: e.target.value })}
                                    />
                                    <select
                                        className="rounded-md border bg-background px-2 text-sm"
                                        value={f.kind}
                                        onChange={(e) => setField(i, { kind: e.target.value as FieldKind })}
                                    >
                                        {KINDS.map((k) => (
                                            <option key={k} value={k}>{k}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1 text-xs select-none">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={f.required}
                                            onChange={(e) => setField(i, { required: e.target.checked })}
                                        />
                                        Required
                                    </label>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
                                            <ArrowUp className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === fields.length - 1}>
                                            <ArrowDown className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setFields((p) => p.filter((_, idx) => idx !== i))}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <label className="flex items-center gap-2 text-sm select-none">
                        <input type="checkbox" className="h-4 w-4" checked={showOnCreate} onChange={(e) => setShowOnCreate(e.target.checked)} />
                        Show when creating a ticket
                    </label>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
                    <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
