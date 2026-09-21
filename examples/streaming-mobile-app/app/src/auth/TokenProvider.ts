/**
 * Strategy interface for obtaining Terra streaming credentials. The shipped
 * implementation is RtTokenProvider; alternatives — BYO API keys, a backend
 * token-mint service — can swap in without touching consumers.
 */
export interface TokenProvider {
  /** SDK registration token (initConnection). */
  fetchSdkToken(): Promise<string>;
  /** Producer (type-0 IDENTIFY) token for streaming a user's data up. */
  fetchStreamingToken(userId: string): Promise<string>;
  /** Best-effort user → reference_id mapping (may be a no-op). */
  mapUser(userId: string, referenceId: string): Promise<void>;
}
