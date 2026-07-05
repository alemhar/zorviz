-- BACK-2-011: job-ticket photos + per-photo note threads. Photos are files under
-- {data_dir}/media/orders/{order_id}/; only paths + metadata live in the DB. Each photo
-- has an append-only note thread (author + timestamp), like a comment log.
CREATE TABLE order_photos (
    id         TEXT PRIMARY KEY NOT NULL,
    order_id   TEXT NOT NULL,
    path       TEXT NOT NULL,            -- relative to data_dir, e.g. media/orders/<oid>/<uuid>.jpg
    created_by TEXT,                     -- staff display name who added it
    created_at INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX order_photos_order_idx ON order_photos (order_id, created_at);

CREATE TABLE photo_notes (
    id         TEXT PRIMARY KEY NOT NULL,
    photo_id   TEXT NOT NULL,
    author     TEXT,                     -- staff display name
    note       TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (photo_id) REFERENCES order_photos(id)
);

CREATE INDEX photo_notes_photo_idx ON photo_notes (photo_id, created_at);
