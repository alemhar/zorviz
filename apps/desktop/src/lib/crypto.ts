// PIN hashing for local auth. PINs are low-entropy, so we use PBKDF2 with a
// per-user random salt and a high iteration count rather than a bare hash.
// Runs in the Tauri webview (secure context → crypto.subtle available).

const PBKDF2_ITERATIONS = 150_000;
const KEY_LEN_BITS = 256;

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

/** Generate a random 16-byte salt as a hex string. */
export function generateSalt(): string {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return toHex(salt);
}

/** Derive a PBKDF2 hash of `pin` with the given hex `salt`. Returns a hex string. */
export async function hashPin(pin: string, salt: string): Promise<string> {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(pin),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: fromHex(salt),
            iterations: PBKDF2_ITERATIONS,
            hash: "SHA-256",
        },
        keyMaterial,
        KEY_LEN_BITS
    );
    return toHex(new Uint8Array(bits));
}

/** Constant-ish time comparison of a candidate pin against a stored hash+salt. */
export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
    const candidate = await hashPin(pin, salt);
    if (candidate.length !== hash.length) return false;
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) {
        diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    return diff === 0;
}
