-- Status-transition log: every job-ticket movement (incl. creation, from_status NULL), written
-- automatically by the status-changing handlers — nobody types anything. Append-only; powers the
-- cloud funnel/dwell/bottleneck analytics. History can't be backfilled, so it ships pre-deployment.
CREATE TABLE order_status_history (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    from_status TEXT,               -- NULL = ticket created
    to_status TEXT NOT NULL,
    actor TEXT,                     -- who moved it (display name)
    created_at INTEGER NOT NULL     -- epoch ms; append-only change marker
);
CREATE INDEX idx_osh_order ON order_status_history(order_id);
CREATE INDEX idx_osh_created ON order_status_history(created_at);
