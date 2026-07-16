# grip-link worker

Serves `grip.tryterra.co` - Terra Grip's universal/app link domain:

- `/.well-known/apple-app-site-association` + `/.well-known/assetlinks.json` -
  the files iOS/Android fetch to verify the domain belongs to the app
- `/pair?p=...` - with the app installed the OS opens it directly (this
  worker never sees the request); otherwise redirects to the App Store /
  Play Store by user agent

## Deploy

```bash
cd infra/grip-link-worker
npx wrangler deploy
```

(first run opens a browser login to the Terra Cloudflare account)

## When things change

- App Store listing goes live -> update `APP_STORE_URL`
- App signing key rotates -> update `ANDROID_SHA256_FINGERPRINTS`
- Redeploy after either. OS-side caching: iOS refetches the AASA on app
  install/update; Android re-verifies on install.
