/**
 * Serverless demo configuration — the app pairs with the Terra dashboard
 * by scanning a QR code (reusable rt. token; see src/auth/). No backend,
 * no API keys on the device.
 */

export { TERRA_API_BASE, TERRA_WS_API_URL, TERRA_WS_URL } from './terraUrls';

/**
 * Optional fallback dev-id for the producer flow. The dev-id from the
 * scanned QR payload takes precedence; this exists so a development
 * build can pre-fill the (public, username-like) dev-id.
 */
export const TERRA_DEV_ID: string | undefined =
  process.env.EXPO_PUBLIC_TERRA_DEV_ID;
