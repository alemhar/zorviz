import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { DEV_TENANT_ID } from '@zorviz/core';

// PORTABLE MODE: Database is in 'apps/desktop/data/zorviz.db'. Run from 'packages/db'.
// This is a DEV shortcut that bypasses the first-run setup wizard. Run the app once
// first so the DB + schema exist, then `npm run seed`.
const DB_PATH = path.resolve(process.cwd(), '../../apps/desktop/data/zorviz.db');

// PBKDF2 params must match apps/desktop/src/lib/crypto.ts so the app can verify the PIN.
const PBKDF2_ITERATIONS = 150_000;
const KEY_LEN_BYTES = 32;

function hashPin(pin: string): { hash: string; salt: string } {
    const saltBytes = crypto.randomBytes(16);
    const salt = saltBytes.toString('hex');
    const hash = crypto.pbkdf2Sync(pin, saltBytes, PBKDF2_ITERATIONS, KEY_LEN_BYTES, 'sha256').toString('hex');
    return { hash, salt };
}

const dbPath = process.env.DB_PATH || DB_PATH;
if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}. Run the app once to initialize the DB, then seed.`);
    process.exit(1);
}

const db = new Database(dbPath);
console.log('Connected to SQLite:', dbPath);

const now = Date.now();

// 1. App Config
const existingConfig = db.prepare('SELECT id FROM app_config WHERE id = ?').get('default');
if (!existingConfig) {
    console.log('Seeding App Config...');
    db.prepare(`
        INSERT INTO app_config (id, tenant_id, branch_id, shop_name, device_name, currency_symbol, locale, tax_rate, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('default', DEV_TENANT_ID, 'main', 'Dev Shop', 'Dev PC', '₱', 'en-PH', 0.12, now, now);
} else {
    console.log('App Config already exists.');
}

// 2. Dev users (username + PIN). Default PIN: 1234
const seedUser = (name: string, username: string, role: string) => {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        console.log(`User '${username}' already exists.`);
        return;
    }
    console.log(`Seeding user: ${username} (PIN 1234)`);
    const { hash, salt } = hashPin('1234');
    db.prepare(`
        INSERT INTO users (id, name, username, pin_hash, pin_salt, role, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(uuidv4(), name, username, hash, salt, role, now, now);
};

seedUser('Admin', 'admin', 'admin');
seedUser('Mechanic', 'mechanic', 'mechanic');

console.log('Seeding complete. Login with admin / 1234.');
