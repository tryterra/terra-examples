/**
 * grip.tryterra.co — universal/app link endpoint for Terra Grip.
 *
 * Routes:
 *   /.well-known/apple-app-site-association  iOS domain-trust file
 *   /.well-known/assetlinks.json             Android domain-trust file
 *   /pair?p=<payload>                        store redirect (see below)
 *   everything else                          -> tryterra.co
 *
 * When Terra Grip is INSTALLED, the OS intercepts /pair links and opens
 * the app directly — this Worker never sees them. It only serves the
 * miss cases: no app installed (redirect to the right store) and the
 * OS trust-file fetches.
 *
 * Deploy: Cloudflare dashboard -> Workers -> create -> paste ->
 * Settings -> Domains & Routes -> add custom domain grip.tryterra.co.
 */

const TEAM_ID = '8HP4B6QYR7';
const IOS_BUNDLE_ID = 'co.tryterra.streamingdemo';
const ANDROID_PACKAGE = 'co.tryterra.streamingdemo';

// Play Console -> Setup -> App integrity -> App signing key certificate
// (SHA-256, colon-separated uppercase hex).
const ANDROID_SHA256_FINGERPRINTS = [
  // Play App Signing key (Google-held; signs store installs)
  'BB:11:41:88:77:5E:A0:71:AD:D2:52:90:93:C1:D4:C9:11:D0:C2:D3:68:CB:F4:BC:84:AB:01:C7:CB:EF:93:54',
];

// Swap in the real listing URLs once both are live.
const APP_STORE_URL = 'https://apps.apple.com/app/id0000000000';
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=' + ANDROID_PACKAGE;
const FALLBACK_URL = 'https://tryterra.co';

const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: [`${TEAM_ID}.${IOS_BUNDLE_ID}`],
        components: [{ '/': '/pair*' }],
      },
    ],
  },
};

const ASSETLINKS = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
      sha256_cert_fingerprints: ANDROID_SHA256_FINGERPRINTS,
    },
  },
];

function json(body) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/.well-known/apple-app-site-association') {
      return json(AASA);
    }
    if (url.pathname === '/.well-known/assetlinks.json') {
      return json(ASSETLINKS);
    }

    if (url.pathname.startsWith('/pair')) {
      const ua = request.headers.get('user-agent') ?? '';
      const store = /iphone|ipad|ipod/i.test(ua)
        ? APP_STORE_URL
        : /android/i.test(ua)
          ? PLAY_STORE_URL
          : FALLBACK_URL;
      return Response.redirect(store, 302);
    }

    return Response.redirect(FALLBACK_URL, 302);
  },
};
