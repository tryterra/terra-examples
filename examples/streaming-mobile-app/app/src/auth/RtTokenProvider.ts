/**
 * TokenProvider backed by the reusable `rt.` token: the same token string
 * serves SDK registration and every producer IDENTIFY for its lifetime —
 * no minting, no network, no re-scans on reconnect.
 *
 * How producer/developer tokens work (production integrations mint short-lived
 * tokens from a backend; this demo reuses one from the dashboard QR):
 * https://docs.tryterra.co/streaming-api/getting-started#before-you-begin
 */

import { isSessionValid, PairingSession } from './session';
import { TokenProvider } from './TokenProvider';

export class SessionExpiredError extends Error {
  constructor() {
    super('Pairing session expired — scan a new QR from the Terra dashboard');
    this.name = 'SessionExpiredError';
  }
}

export class RtTokenProvider implements TokenProvider {
  constructor(private readonly getSession: () => PairingSession | null) {}

  private token(label: string): string {
    const session = this.getSession();
    if (!session || !isSessionValid(session)) {
      throw new SessionExpiredError();
    }
    console.log(`[auth] ${label}: using reusable rt. token (no mint needed)`);
    return session.rtToken;
  }

  async fetchSdkToken(): Promise<string> {
    return this.token('SDK registration');
  }

  async fetchStreamingToken(): Promise<string> {
    return this.token('producer');
  }

  async mapUser(): Promise<void> {
    // Identity ships with the token (born-bound user + reference_id).
  }
}
