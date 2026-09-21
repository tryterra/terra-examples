/**
 * Pairing session — the reusable `rt.` token scanned from the dashboard QR,
 * plus its metadata, persisted in the device keychain. One scan covers SDK
 * registration and every producer IDENTIFY for the token's lifetime.
 */

import * as SecureStore from 'expo-secure-store';

export interface PairingSession {
  rtToken: string;
  devId: string | null;
  userId: string | null; // the user this token is born-bound to
  referenceId: string | null;
  expiresAt: number | null; // epoch ms
  /** Demo mode — synthetic local data via the fake SDK adapter; no network. */
  demo?: boolean;
}

/** A ready-made demo session — "Try the demo" on first launch. */
export function createDemoSession(): PairingSession {
  return {
    rtToken: 'rt.demo-mode-synthetic',
    devId: 'demo',
    userId: 'demo-uid-you',
    referenceId: 'demo',
    expiresAt: null, // demo never expires; Unpair exits it
    demo: true,
  };
}

const KEY = 'terra_pairing_session';

let cached: PairingSession | null | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

/**
 * Parses the dashboard QR payload (tolerant field naming). Accepts raw
 * JSON, a bare rt. token string, or a deep link carrying `p=<url-encoded
 * JSON>` (terrastreaming:// or any https URL).
 */
export function parsePairingPayload(data: string): PairingSession | null {
  let trimmed = data.trim();
  if (!trimmed) return null;
  // Deep link → unwrap the payload param and fall through to JSON parsing.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const match = trimmed.match(/[?&]p=([^&#]+)/);
    if (!match) return null;
    try {
      trimmed = decodeURIComponent(match[1]);
    } catch {
      return null;
    }
  }
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Bare rt. token string is acceptable.
    if (!/\s/.test(trimmed) && trimmed.startsWith('rt.')) {
      return {
        rtToken: trimmed,
        devId: null,
        userId: null,
        referenceId: null,
        expiresAt: null,
      };
    }
    return null;
  }
  const token = json.rt_token ?? json.rtToken ?? json.token;
  if (typeof token !== 'string' || !token) return null;
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  let expiresAt: number | null = null;
  const exp = json.expires_at ?? json.expiresAt;
  if (typeof exp === 'number') expiresAt = exp;
  else if (typeof exp === 'string') {
    const parsed = Date.parse(exp);
    expiresAt = Number.isNaN(parsed) ? null : parsed;
  }
  return {
    rtToken: token,
    devId: str(json.dev_id ?? json.devId ?? json['dev-id']),
    userId: str(json.user_id ?? json.userId),
    referenceId: str(json.reference_id ?? json.referenceId),
    expiresAt,
  };
}

export function isSessionValid(
  session: PairingSession | null,
  now: number = Date.now(),
): boolean {
  if (!session) return false;
  return session.expiresAt === null || session.expiresAt > now;
}

export async function loadSession(): Promise<PairingSession | null> {
  if (cached !== undefined) return cached;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cached = raw ? (JSON.parse(raw) as PairingSession) : null;
  } catch {
    cached = null;
  }
  if (cached) notify();
  return cached;
}

export async function saveSession(session: PairingSession): Promise<void> {
  cached = session;
  notify();
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
  } catch {
    // keychain hiccup: session still works in-memory for this run
  }
}

/** Drop the session (expiry, revocation-401, or user-initiated re-pair). */
export async function clearSession(): Promise<void> {
  cached = null;
  notify();
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}

export function getSession(): PairingSession | null {
  return cached ?? null;
}

export function hasValidSession(): boolean {
  return isSessionValid(getSession());
}

export function onSessionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
