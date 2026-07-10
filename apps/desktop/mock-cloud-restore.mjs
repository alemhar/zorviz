// Mock cloud for the restore drill: tenant-info + snapshot from the captured file.
import http from "node:http";
import fs from "node:fs";
const snap = JSON.parse(fs.readFileSync("snapshot-drill.json", "utf8"));
const server = http.createServer((req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
    res.end(JSON.stringify(obj));
  };
  if (req.method === "OPTIONS") return json(200, {});
  const url = req.url ?? "";
  if (url.endsWith("/health")) return json(200, { ok: true });
  if (url.endsWith("/sync/tenant-info"))
    return json(200, { protocol_version: 2, tenant_id: snap.tenant_id, shop_name: snap.shop_name, has_data: true });
  if (url.endsWith("/sync/snapshot"))
    return json(200, { protocol_version: 2, snapshot_at: snap.snapshot_at, tables: snap.tables });
  if (url.endsWith("/sync/push")) return json(200, { ok: true, watermark: Date.now(), accepted: {} });
  if (url.endsWith("/sync/booking-inbox")) return json(200, { protocol_version: 2, requests: [] });
  json(404, { error: "not found" });
});
server.listen(8200, () => console.log("restore mock on :8200"));
