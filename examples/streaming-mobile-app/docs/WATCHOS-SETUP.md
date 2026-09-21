# Apple Watch Setup

The Apple Watch doesn't expose heart rate over standard BLE to third-party
apps - data reaches the phone via WatchConnectivity, which requires the
small native watch app in `app/targets/watch/`.

The watch target is **generated at prebuild** by `@bacons/apple-targets`
(configured in app.json), so it survives `expo prebuild --clean` and is
included in EAS builds automatically. No manual Xcode target setup.

## Pieces

- `app/targets/watch/expo-target.config.js` - target definition (name,
  bundle ID `co.tryterra.streamingdemo.watchkitapp`, HealthKit
  entitlement, workout background mode, privacy strings)
- `app/targets/watch/TerraGripWatchApp.swift` - the watch app: a thin
  shell over TerraRTiOS (Terra's watchOS SDK); connect → start a workout
  session → stream heart rate + steps to the phone
- `app/plugins/withWatchTerraPod.js` - adds the TerraRTiOS pod to the
  watch target's Podfile block at prebuild
- `patches/@bacons+apple-targets*.patch` - compatibility patch for
  Expo SDK 54 (applied by patch-package on postinstall)

## Build + run

```bash
cd app
npx expo prebuild -p ios
npx expo run:ios --device
```

Xcode builds both targets; the watch app deploys to the watch paired with
the selected iPhone (first watch deploy is famously slow - keep the watch
on its charger).

## The flow

1. Watch: open Terra Grip → **Start streaming** (starts a workout session
   for full-frequency heart rate; grant HealthKit prompts on first run)
2. Phone: Connect tab → source **Apple Watch** → Continue
3. Data flows watch → phone → Terra; readings on the Live tab

## Troubleshooting

- **"Couldn't reach your Apple Watch"** - the watch app must be installed
  *and open*; WatchConnectivity needs both sides alive.
- **No heart rate** - HealthKit permission not granted on the watch, or
  no workout session running.
- **Watch target missing after prebuild** - check `npx expo config
  --type prebuild` runs clean; the apple-targets patch must be applied
  (`npm install` runs it via postinstall).
