# Troubleshooting

## "Pairing needs a refresh" / closed 4001

Terra rejected the pairing token. Most commonly the interim single-use consumer token is spent (each QR carries exactly one live-view connection until reusable consumer tokens ship) - scan a fresh QR from the dashboard. Also possible: the rt. token expired (~8h) or was revoked in the dashboard.

## "Pair with Terra first" everywhere

The app has no pairing session. Everything starts at the Pair tab: scan the QR from the Terra dashboard's streaming page (or generate one with `scripts/make_pairing_qr.py` if the dashboard is unavailable).

## Closed 4002: consumer session limit

Terra caps concurrent consumer sessions per developer ID. Each running app instance is one consumer - too many simultaneous viewers (or another tool holding a session under the same dev-id) hits the cap. Close other sessions and reconnect.

## Live tab is empty

Data only flows while a producer is streaming. Two options:

1. **Terra dashboard streaming tester** - generates live data, no hardware needed.
2. A real producer: this phone via the Connect tab, or any device running the RT SDK under your dev ID.

## BLE device doesn't appear in the scanner

- **Already connected elsewhere**: BLE peripherals accept one central at a time - close the vendor's companion app / other phones' Bluetooth.
- **Watches need broadcast mode**: Garmin/Polar/etc. only advertise the standard HR profile when "Broadcast Heart Rate" is enabled on the watch.
- **Apple Watch never appears in the BLE scan**: it isn't a BLE HR peripheral - it needs a native watch companion app (out of scope for this demo; groundwork in watchos/ and docs/WATCHOS-SETUP.md).
- **ANT+-only sensors** aren't covered by the BLE scan.
- Sanity check with the free **nRF Connect** app: if it can't see the device either, the device isn't advertising.

## Producer setup (phone → Terra)

The Connect tab implements this end to end (`app/src/producer/`), but it needs a dev build - `react-native-terra-rt-react` is a **native module** and will not load in Expo Go (the tab shows "requires a dev build" there and everything else keeps working).

```bash
cd app
npx expo prebuild            # generates ios/ and android/ (iOS permission strings come from app.json)
npx expo run:ios             # or run:android (dev build)
```

Notes:
- **iOS real-time streaming requires Apple Developer Program membership.**
- Under the hood: `initTerra(devId, referenceId)` → `initConnection(rt_token)` → `getUserId()` → scan/pair → `startRealtime(connection, dataTypes, rt_token)`. The same reusable rt. token from the QR covers every step - no per-step minting.
- Full guide: [Terra docs - Wearable → Your app](https://docs.tryterra.co/streaming-api/connect-wearable-to-sdk/react-native).

## Does streaming survive backgrounding / a locked screen?

Partially, iOS only. The app declares the `bluetooth-central` background mode, so iOS keeps delivering data from an **already-connected** BLE device while the app is backgrounded or the phone is locked - the producer stream generally continues, and the consumer socket is left alone (it survives while the BLE mode keeps the process alive; if iOS suspends the app anyway, the reconnect path recovers on return). Not covered: scanning for new devices in the background, phone-sensor streaming (motion delivery stops on suspend), and Android (which needs a foreground service - deliberately out of scope for this demo). None of these are Terra API limitations - they're standard mobile app-lifecycle engineering.

## `pod install` fails: "Unable to find a specification for RCT-Folly"

Expo SDK 54+ ships React Native as precompiled XCFrameworks on iOS, so `RCT-Folly` no longer exists as a standalone pod - but `react-native-terra-rt-react`'s podspec (older library template) depends on it directly. Fix: build RN from source via `expo-build-properties` (already configured in this repo's `app.json`). Trade-off: slower iOS builds. Remove once the Terra SDK ships a podspec compatible with precompiled RN.

## iOS build fails in `Pods/fmt` with consteval errors

Follow-on from building RN from source: Xcode 26.4+ (Apple Clang 21) rejects the `fmt` 11.0.2 bundled by RN < 0.83.9. Fixed by the `expo-fmt-consteval-fix` config plugin (already in `app.json`). Remove it on Expo SDK 56+, which bundles a fixed fmt.

## Expo dependency version warnings

`npx expo install --fix` aligns package versions with your installed Expo SDK.
