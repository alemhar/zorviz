import { useEffect, useMemo, useState } from "react";
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
import type { Customer } from "@zorviz/db";
import { updateAsset, type AssetDetail } from "../../../lib/repair-api";
import { searchCustomers, createCustomer } from "../../../lib/customers-api";
import type { AssetType, FieldDef } from "../../../lib/asset-types-api";
import { iconFor } from "../../../lib/asset-icons";
import { EntityPicker } from "../../../components/entity-picker";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    asset: AssetDetail;
    // The matched asset-type definition (null if the type was removed — we then fall
    // back to editing whatever spec keys the asset already has).
    assetType: AssetType | null;
    onUpdated: (asset: AssetDetail) => void;
}

// Edit an existing asset. Type is fixed (a shop's asset kind is fixed); only the spec
// details and the owner can change. Fields are driven by the type definition (BACK-1-006).
export function AssetEditForm({ open, onOpenChange, asset, assetType, onUpdated }: Props) {
    const [specs, setSpecs] = useState<Record<string, string>>({});
    const [owner, setOwner] = useState<Customer | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Fields to render: the type's defs, or (for a removed type) the asset's own keys as text.
    const fields: FieldDef[] = useMemo(() => {
        if (assetType) return assetType.fields;
        return Object.keys(asset.specs ?? {}).map((key) => ({
            key,
            label: key,
            kind: "text" as const,
            required: false,
        }));
    }, [assetType, asset.specs]);

    useEffect(() => {
        if (!open) return;
        const s: Record<string, string> = {};
        for (const [k, v] of Object.entries(asset.specs ?? {})) {
            if (v !== null && v !== undefined) s[k] = String(v);
        }
        setSpecs(s);
        setOwner(asset.owner ? ({ id: asset.owner.id, name: asset.owner.name, phone: asset.owner.phone } as Customer) : null);
        setError("");
    }, [open, asset]);

    const submit = async () => {
        const missing = fields.find((f) => f.required && !(specs[f.key] ?? "").trim());
        if (missing) return setError(`${missing.label} is required.`);
        const badNum = fields.find(
            (f) => f.kind === "number" && (specs[f.key] ?? "").trim() && isNaN(Number(specs[f.key]))
        );
        if (badNum) return setError(`${badNum.label} must be a number.`);
        const filled = Object.fromEntries(Object.entries(specs).filter(([, v]) => v.trim() !== ""));
        if (Object.keys(filled).length === 0) return setError("Enter at least one detail.");

        setSaving(true);
        setError("");
        try {
            const updated = await updateAsset(asset.id, { specs: filled, ownerId: owner?.id ?? null });
            onUpdated(updated);
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            setError("Failed to save changes.");
        } finally {
            setSaving(false);
        }
    };

    const TypeIcon = iconFor(assetType?.icon);
    const typeName = assetType?.name ?? asset.type;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Asset</DialogTitle>
                    <DialogDescription>Correct the details or change the owner.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
                        <TypeIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium capitalize">{typeName}</span>
                        <span className="ml-auto text-xs text-muted-foreground">Type can't be changed</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {fields.map((f) => (
                            <div key={f.key} className="space-y-1">
                                <Label htmlFor={`edit-${f.key}`}>
                                    {f.label}
                                    {f.required && <span className="text-destructive"> *</span>}
                                </Label>
                                <Input
                                    id={`edit-${f.key}`}
                                    inputMode={f.kind === "number" ? "numeric" : undefined}
                                    value={specs[f.key] ?? ""}
                                    onChange={(e) => setSpecs((s) => ({ ...s, [f.key]: e.target.value }))}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="space-y-1">
                        <Label>Owner (optional)</Label>
                        <EntityPicker<Customer>
                            value={owner}
                            onChange={setOwner}
                            search={searchCustomers}
                            onCreate={(name) => createCustomer({ name })}
                            getLabel={(c) => c.name}
                            getSubLabel={(c) => c.phone ?? undefined}
                            placeholder="Search or add a customer…"
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={saving}>
                        {saving ? "Saving…" : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
