-- BACK-1-006: data-driven shop asset types. Each shop defines one or more asset
-- types; each type carries an ordered list of field definitions (stored as JSON).
-- assets.type stores the type's stable `key` (existing rows use vehicle/gadget/
-- appliance, which the seeded templates reuse, so nothing breaks).
CREATE TABLE asset_types (
    id             TEXT PRIMARY KEY NOT NULL,
    tenant_id      TEXT NOT NULL,
    key            TEXT NOT NULL,            -- stable slug stored in assets.type
    name           TEXT NOT NULL,            -- display name (e.g. "Vehicle")
    icon           TEXT,                     -- lucide icon key (car/smartphone/package/wrench...)
    fields         TEXT NOT NULL,            -- JSON: [{ "key","label","kind","required" }]
    show_on_create INTEGER NOT NULL DEFAULT 1, -- 1 = offered when creating a new asset/ticket
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL
);

CREATE UNIQUE INDEX asset_types_tenant_key_idx ON asset_types (tenant_id, key);

-- Back-compat for installs that ALREADY have an app_config row (upgrading): seed the
-- three built-in templates tied to the existing tenant. On a fresh install app_config
-- is still empty at migration time, so this inserts nothing — the setup wizard seeds
-- the shop's chosen templates instead.
INSERT INTO asset_types (id, tenant_id, key, name, icon, fields, show_on_create, sort_order, created_at, updated_at)
SELECT
    'seed-vehicle', c.tenant_id, 'vehicle', 'Vehicle', 'car',
    '[{"key":"plateNumber","label":"Plate Number","kind":"text","required":false},{"key":"vin","label":"VIN","kind":"text","required":false},{"key":"make","label":"Make","kind":"text","required":false},{"key":"model","label":"Model","kind":"text","required":false},{"key":"year","label":"Year","kind":"number","required":false},{"key":"color","label":"Color","kind":"text","required":false},{"key":"mileage","label":"Mileage","kind":"number","required":false}]',
    1, 0, c.created_at, c.updated_at
FROM app_config c WHERE c.id = 'default'
UNION ALL
SELECT
    'seed-gadget', c.tenant_id, 'gadget', 'Gadget', 'smartphone',
    '[{"key":"brand","label":"Brand","kind":"text","required":false},{"key":"model","label":"Model","kind":"text","required":false},{"key":"serialNumber","label":"Serial Number","kind":"text","required":false},{"key":"imei","label":"IMEI","kind":"text","required":false},{"key":"color","label":"Color","kind":"text","required":false}]',
    1, 1, c.created_at, c.updated_at
FROM app_config c WHERE c.id = 'default'
UNION ALL
SELECT
    'seed-appliance', c.tenant_id, 'appliance', 'Appliance', 'package',
    '[{"key":"brand","label":"Brand","kind":"text","required":false},{"key":"model","label":"Model","kind":"text","required":false},{"key":"serialNumber","label":"Serial Number","kind":"text","required":false}]',
    1, 2, c.created_at, c.updated_at
FROM app_config c WHERE c.id = 'default';
