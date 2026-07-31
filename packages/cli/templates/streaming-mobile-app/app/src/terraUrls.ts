/** Terra endpoints — pure module (no react-native imports) so the
 * protocol/auth layers stay unit-testable in plain Node. */
export const TERRA_WS_URL = 'wss://ws.tryterra.co/connect';
export const TERRA_WS_API_URL = 'https://ws.tryterra.co';

/** Terra's main API (current major version). */
export const TERRA_API_BASE = 'https://access.tryterra.co/api/v2';

/** Privacy policy shown in-app (App Store guideline 5.1.1(i)). */
export const PRIVACY_POLICY_URL = 'https://tryterra.co/privacy';
