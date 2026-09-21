# Terra Grip

Reference app for [Terra's Streaming API](https://docs.tryterra.co): real-time wearable data in React Native, built on the [`terra-rt`](https://www.npmjs.com/package/terra-rt) SDK.

Scan a QR code from your Terra dashboard and the app streams live sensor data to Terra for the next several hours. No backend, no accounts, no API keys on the device.

## Quickstart

Prereqs: Node 18+, Xcode or Android Studio, and access to the [Terra dashboard](https://dashboard.tryterra.co) streaming page.

```bash
cd app
npm install
npx expo run:ios
```

or `npx expo run:android`. The Terra RT SDK is a native module, so the app needs a development build. Expo Go is not supported.

In the app, open the Pair tab and scan the pairing QR from the Terra dashboard (streaming page, **+ Test User**). Readings show up live on the Live tab and on your dashboard.

Scanning the QR and pairing a wearable both need a physical phone: the iOS Simulator and Android emulator have no Bluetooth or camera. To try it on a simulator (or without dashboard access), tap "Try the demo" on first launch and the full producer flow runs on synthetic local data.

## How it works

- **Pairing** (`app/src/auth/`): the dashboard QR carries a reusable `rt.` token plus identity. The same token covers SDK registration and every reconnect until it expires. It lives in the device keychain and no credentials are ever typed into the app.
- **Streaming** (`app/src/producer/`): pick a BLE sensor, the phone's own sensors, or a watch on the Connect tab. Pairing a device starts the stream and requests every data type the device can provide. `terraSdk.ts` is the integration surface, a near 1:1 mapping onto `terra-rt`. Start reading there.
- **Background**: the SDK keeps the stream alive with the screen locked (foreground service and reconnection on Android, `bluetooth-central` on iOS). No app code needed.
- **Live tab**: readings render straight from the local SDK feed, with honest states for the unhappy paths: device connected but silent, Terra link reconnecting, session expired.
- **Demo mode** (`app/src/producer/demoSdkAdapter.ts`): a synthetic implementation of the same SDK interface. The whole producer flow with no hardware, account, or network.

## Watch apps

- **Apple Watch**: `app/targets/watch/` holds a small watchOS app generated into the build at prebuild. See [docs/WATCHOS-SETUP.md](docs/WATCHOS-SETUP.md).
- **Wear OS**: `wearos/` is a standalone companion app over Terra's `terra-wearos` SDK. See [docs/WEAROS-SETUP.md](docs/WEAROS-SETUP.md).

## Project tour

```
app/src/producer/terraSdk.ts       the terra-rt integration, start here
app/src/producer/                  producer state machine + demo adapter
app/src/auth/                      pairing session (rt. token) + token provider
app/src/datatypes/                 every streaming data type; add one = one entry
app/src/components/                scalar/vector/waveform renderers
infra/grip-link-worker/            universal link endpoint (Cloudflare Worker)
```

## Extending

- **New data type**: one entry in `app/src/datatypes/index.ts`, or a file for custom rendering. Unknown types already render via a generic fallback.
- **New connection type**: extend `ConnectionType`, add a strategy in `ProducerController.ts` and a source chip on the Connect tab.

## Tests

```bash
cd app
npm test
npm run typecheck
```

## License

MIT
