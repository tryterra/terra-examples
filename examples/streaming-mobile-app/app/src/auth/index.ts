/**
 * Auth for the serverless demo: one dashboard QR scan yields a reusable
 * `rt.` token held in the keychain; RtTokenProvider serves it for every
 * token need until expiry or revocation.
 */

import { getSession } from './session';
import { RtTokenProvider } from './RtTokenProvider';
import { TokenProvider } from './TokenProvider';

const provider = new RtTokenProvider(getSession);

export function getTokenProvider(): TokenProvider {
  return provider;
}

export * from './session';
export * from './RtTokenProvider';
export * from './TokenProvider';
