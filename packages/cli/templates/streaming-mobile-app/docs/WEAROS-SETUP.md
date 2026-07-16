# Wear OS Setup

Two ways a Wear OS watch can feed Terra Grip:

1. **Standard BLE broadcast** - watches/apps that advertise the BLE
   heart-rate service appear in the ordinary *BLE device* scan. Nothing
   to set up; heart rate (+ RR) only.
2. **Terra companion app** (`wearos/` in this repo) - a thin shell over
   Terra's `terra-wearos` SDK. Richer: streams over classic Bluetooth to
   the phone's *Wear OS* source, with an exercise API (typed workouts,
   HR, steps, GPS).

## Build the companion (path 2)

`wearos/` is a **standalone Gradle project** (not part of the RN build):

```bash
open -a "Android Studio" wearos
```

Run the `app` configuration on a physical Wear OS 3+ watch (developer
mode + ADB over Wi-Fi or the watch cradle). First compile note: the
`StreamDataTypes` enum member names in `MainActivity.kt` are written
against the docs, not a compiled check - if 0.0.6 names differ, the fix
is local to that one line.

## The flow

1. Watch: open Terra Grip → **Make discoverable** (grant sensor
   permission prompts on first run)
2. Phone: Connect tab → source **Wear OS** → the watch appears in the
   device list → select → Continue
3. Watch: **Start streaming** - data flows watch → phone → Terra

## Distribution

The wear app shares the phone app's package name
(`co.tryterra.streamingdemo`) and is uploaded to the same Play listing
under the Wear OS form factor. It is marked standalone-capable, so watch
users can also install it directly from the watch Play Store.
