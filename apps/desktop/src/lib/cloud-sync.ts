import { api } from "./api";
import { useCloudSyncStore } from "../stores/cloud-sync";
import { useAppConfigStore } from "../stores/app-config";
import { toast } from "../stores/toast";

const PUSH_TIMEOUT = 15_000;

interface ChangeBatch {
    tenant_id: string;
    since: number;
    count: number;
    tables: Record<string, unknown[]>;
}

// Push-only cloud sync (docs/cloud-sync-protocol.md): collect local changes since the watermark,
// POST them to the cloud, advance the watermark on success. Reads fresh config from the store so
// the watermark is never stale. Fail-safe — never throws; updates the status store and returns a
// result. Can't succeed until the backend implements /sync/push, and that's fine (fails to "error").
export async function runSync(): Promise<{ ok: boolean; pushed: number; error?: string }> {
    const setStatus = useCloudSyncStore.getState().set;
    const config = useAppConfigStore.getState().config;
    const base = (config?.cloud_url ?? "").replace(/\/+$/, "");
    const token = config?.device_token ?? "";
    if (!config || config.sync_enabled !== 1 || !base || !token) {
        return { ok: false, pushed: 0, error: "not configured" };
    }

    const since = config.last_synced_at ?? 0;

    // Booking inbox (protocol v2.1, BACK-4-017 Part 1): drain confirmed online bookings.
    // Runs every cycle regardless of push outcome; ALWAYS fails silent — an older cloud
    // (404), inactive subscription (402/403), or network blip must never affect anything.
    void drainBookingInbox(base, token);

    // 1. Collect the local change batch (never leaves the device on failure).
    let batch: ChangeBatch;
    try {
        batch = await api.get<ChangeBatch>(`/api/sync/changes?since=${since}`);
    } catch {
        setStatus("error", "Couldn't read local changes");
        return { ok: false, pushed: 0, error: "collect" };
    }
    if (batch.count === 0) {
        setStatus("connected", "Up to date");
        return { ok: true, pushed: 0 };
    }

    // 2. Push to the cloud.
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), PUSH_TIMEOUT);
    try {
        const res = await fetch(`${base}/sync/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                protocol_version: 1,
                tenant_id: batch.tenant_id,
                device_name: config.device_name,
                since,
                sent_at: Date.now(),
                changes: batch.tables,
            }),
            signal: ctrl.signal,
        });
        if (!res.ok) {
            setStatus("error", res.status === 401 || res.status === 403 ? "Device token rejected" : `Push failed (${res.status})`);
            return { ok: false, pushed: 0, error: `http ${res.status}` };
        }
        // 3. Advance the watermark to the backend's clock (or now as a fallback).
        const body = (await res.json().catch(() => ({}))) as { watermark?: number };
        const watermark = typeof body.watermark === "number" ? body.watermark : Date.now();
        await api.post("/api/sync/watermark", { ts: watermark });
        await useAppConfigStore.getState().fetchConfig();
        setStatus("connected", `Synced ${batch.count} · just now`);
        return { ok: true, pushed: batch.count };
    } catch {
        setStatus("error", "Can't reach cloud backend");
        return { ok: false, pushed: 0, error: "network" };
    } finally {
        clearTimeout(to);
    }
}

interface InboxRequest {
    id: string;
    customer_name: string | null;
    customer_phone: string | null;
    customer_email: string | null;
    asset_description: string | null;
    concern: string | null;
    confirmed_time: number;
}

// Delivered-exactly-once: materialize locally FIRST (dedupes by request_id), then ACK.
// A lost ACK just means the same requests come back next cycle and dedupe to no-ops.
async function drainBookingInbox(base: string, token: string): Promise<void> {
    try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), PUSH_TIMEOUT);
        const res = await fetch(`${base}/sync/booking-inbox`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
        });
        clearTimeout(to);
        if (!res.ok) return; // 404 old cloud, 402 unsubscribed, anything — silent
        const body = (await res.json().catch(() => null)) as { requests?: InboxRequest[] } | null;
        const requests = body?.requests ?? [];
        if (!requests.length) return;

        const result = await api.post<{ created: number; skipped: number }>(
            "/api/sync/materialize-bookings",
            { requests }
        );

        // ACK everything delivered (created or deduped) — best-effort.
        const ackCtrl = new AbortController();
        const ackTo = setTimeout(() => ackCtrl.abort(), PUSH_TIMEOUT);
        await fetch(`${base}/sync/booking-ack`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: requests.map((r) => r.id) }),
            signal: ackCtrl.signal,
        }).catch(() => {});
        clearTimeout(ackTo);

        if (result.created > 0) {
            toast(
                result.created === 1
                    ? "New online booking received"
                    : `${result.created} new online bookings received`,
                "success"
            );
        }
    } catch {
        // silent by design — local operation is never affected by the inbox
    }
}