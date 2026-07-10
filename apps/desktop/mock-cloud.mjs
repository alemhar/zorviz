// Mock Wurkz Cloud for Part 1 verification: serves the v2.1 booking inbox + accepts push.
// Logs everything to mock-cloud.log so the E2E can assert the ACK arrived.
import http from "node:http";
import fs from "node:fs";

const LOG = "mock-cloud.log";
fs.writeFileSync(LOG, "");
const log = (m) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...m }) + "\n");

let inbox = [
  {
    id: "req-e2e-001",
    customer_name: "Maria Santos",
    customer_phone: "0917-888-1234",
    customer_email: "maria@example.com",
    asset_description: "Toyota Vios 2019, ABC-5678",
    concern: "Aircon not cold",
    confirmed_time: Date.now() + 86400000,
  },
  {
    id: "req-e2e-002",
    customer_name: "Jose Rizal Jr",
    customer_phone: "0918-777-4321",
    customer_email: null,
    asset_description: "Mitsubishi L300",
    concern: "Compressor noise",
    confirmed_time: Date.now() + 2 * 86400000,
  },
];

const server = http.createServer((req, res) => {
  const url = req.url ?? "";
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    log({ method: req.method, url, body: body.slice(0, 500) });
    const json = (code, obj) => {
      res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
      res.end(JSON.stringify(obj));
    };
    if (req.method === "OPTIONS") return json(200, {});
    if (url.endsWith("/health")) return json(200, { ok: true });
    if (url.endsWith("/sync/push")) return json(200, { ok: true, watermark: Date.now(), accepted: {} });
    if (url.endsWith("/sync/booking-inbox")) return json(200, { protocol_version: 2, requests: inbox });
    if (url.endsWith("/sync/booking-ack")) {
      const ids = JSON.parse(body || "{}").ids ?? [];
      inbox = inbox.filter((r) => !ids.includes(r.id));
      log({ acked: ids });
      return json(200, { ok: true, acked: ids.length });
    }
    json(404, { error: "not found" });
  });
});
server.listen(8200, () => console.log("mock cloud on :8200"));
