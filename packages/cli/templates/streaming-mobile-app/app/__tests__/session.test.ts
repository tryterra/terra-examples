/**
 * Pairing session parsing/validity + RtTokenProvider.
 * expo-secure-store is native — virtual-mocked so these run in plain Node.
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}), { virtual: true });

import {
  isSessionValid,
  PairingSession,
  parsePairingPayload,
} from '../src/auth/session';
import {
  RtTokenProvider,
  SessionExpiredError,
} from '../src/auth/RtTokenProvider';

const NOW = 1_800_000_000_000;

describe('parsePairingPayload', () => {
  test('full dashboard QR payload (snake_case)', () => {
    const s = parsePairingPayload(
      JSON.stringify({
        rt_token: 'rt.abc123',
        dev_id: 'my-dev-id',
        user_id: 'uuid-1',
        reference_id: 'adrian',
        expires_at: NOW + 1000,
      }),
    );
    expect(s).toEqual({
      rtToken: 'rt.abc123',
      devId: 'my-dev-id',
      userId: 'uuid-1',
      referenceId: 'adrian',
      expiresAt: NOW + 1000,
    });
  });

  test('unknown extra fields are ignored (older QRs stay scannable)', () => {
    const s = parsePairingPayload(
      JSON.stringify({
        rt_token: 'rt.a',
        developer_token: 'legacy-one-shot',
        users: { 'uuid-1': 'adrian' },
      }),
    );
    expect(s?.rtToken).toBe('rt.a');
    expect(s).not.toHaveProperty('developerToken');
    expect(s).not.toHaveProperty('users');
  });

  test('tolerates camelCase and ISO expiry strings', () => {
    const s = parsePairingPayload(
      JSON.stringify({
        rtToken: 'rt.xyz',
        devId: 'd',
        expiresAt: '2026-07-08T18:00:00.000Z',
      }),
    );
    expect(s?.rtToken).toBe('rt.xyz');
    expect(s?.devId).toBe('d');
    expect(s?.expiresAt).toBe(Date.parse('2026-07-08T18:00:00.000Z'));
  });

  test('deep-link form unwraps ?p= (native-camera scans and layer-2 URLs)', () => {
    const payload = { rt_token: 'rt.deep', reference_id: 'adrián' }; // unicode-safe
    const link = `terrastreaming://pair?p=${encodeURIComponent(JSON.stringify(payload))}`;
    const s = parsePairingPayload(link);
    expect(s?.rtToken).toBe('rt.deep');
    expect(s?.referenceId).toBe('adrián');

    // Universal-link form — same param, https scheme.
    const https = `https://tryterra.co/pair?p=${encodeURIComponent(JSON.stringify(payload))}#frag`;
    expect(parsePairingPayload(https)?.rtToken).toBe('rt.deep');

    // URLs without a payload param are rejected, not JSON.parse'd.
    expect(parsePairingPayload('https://example.com/nothing')).toBeNull();
  });

  test('bare rt. token string is accepted; junk is not', () => {
    expect(parsePairingPayload('  rt.solo-token ')?.rtToken).toBe('rt.solo-token');
    expect(parsePairingPayload('hello world')).toBeNull();
    expect(parsePairingPayload('')).toBeNull();
    expect(parsePairingPayload('{"no_token": true}')).toBeNull();
    expect(parsePairingPayload('{"rt_token": 42}')).toBeNull();
  });
});

describe('isSessionValid', () => {
  const base: PairingSession = {
    rtToken: 'rt.t',
    devId: null,
    userId: null,
    referenceId: null,
    expiresAt: null,
  };

  test('null session is invalid; no expiry means valid', () => {
    expect(isSessionValid(null)).toBe(false);
    expect(isSessionValid(base, NOW)).toBe(true);
  });

  test('expiry boundary', () => {
    expect(isSessionValid({ ...base, expiresAt: NOW + 1 }, NOW)).toBe(true);
    expect(isSessionValid({ ...base, expiresAt: NOW }, NOW)).toBe(false);
    expect(isSessionValid({ ...base, expiresAt: NOW - 1 }, NOW)).toBe(false);
  });
});

describe('RtTokenProvider', () => {
  const session: PairingSession = {
    rtToken: 'rt.reusable',
    devId: 'd',
    userId: 'u',
    referenceId: 'adrian',
    expiresAt: null,
  };

  test('the SAME rt. token serves both roles — that is the feature', async () => {
    const p = new RtTokenProvider(() => session);
    expect(await p.fetchSdkToken()).toBe('rt.reusable');
    expect(await p.fetchStreamingToken()).toBe('rt.reusable');
    await expect(p.mapUser()).resolves.toBeUndefined(); // identity is in the QR
  });

  test('throws SessionExpiredError with no session or a stale one', async () => {
    const none = new RtTokenProvider(() => null);
    await expect(none.fetchSdkToken()).rejects.toThrow(SessionExpiredError);

    const stale = new RtTokenProvider(() => ({
      ...session,
      expiresAt: Date.now() - 1000,
    }));
    await expect(stale.fetchStreamingToken()).rejects.toThrow(SessionExpiredError);
    await expect(stale.fetchSdkToken()).rejects.toThrow(/scan a new QR/i);
  });
});
