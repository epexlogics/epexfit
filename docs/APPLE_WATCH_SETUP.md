# Apple Watch Companion App — Setup Guide

## Overview
EpexFit's watch app uses a native watchOS target (WatchKit + SwiftUI + HealthKit) to:
- Track workouts natively with HKWorkoutSession
- Display today's steps, streak count, and APS score
- Sync workout summaries back to the phone via WCSession

---

## Prerequisites
- Xcode 15+
- Apple Developer account with active membership
- Expo managed workflow → you must **eject to bare** or use an **EAS custom build** with a custom Xcode workspace

---

## Step 1 — Add watchOS Target in Xcode

1. Open your project's `ios/` folder in Xcode: `open ios/EpexFit.xcworkspace`
2. **File → New → Target → watchOS → App**
3. Product name: `EpexFitWatch`
4. Bundle ID: `com.yourcompany.epexfit.watchkitapp`
5. Ensure **"Include Complication"** is checked (needed for widget later)
6. Click **Finish** — Xcode adds the watch scheme automatically

---

## Step 2 — Copy the Swift files

Copy the files from `watch/` into the new watch target:
```
watch/WatchApp.swift          → EpexFitWatch/WatchApp.swift
watch/WorkoutManager.swift    → EpexFitWatch/WorkoutManager.swift
watch/ConnectivityManager.swift → EpexFitWatch/ConnectivityManager.swift
```

Ensure all three files are added to the **EpexFitWatch** target (check the Target Membership checkbox in File Inspector).

---

## Step 3 — Add HealthKit entitlements (Watch target)

1. Select the `EpexFitWatch` target → **Signing & Capabilities**
2. Click **+ Capability** → **HealthKit**
3. Check **"Background Delivery"** if you want heart rate to update when the app is not in foreground

Add to `EpexFitWatch/Info.plist`:
```xml
<key>NSHealthShareUsageDescription</key>
<string>EpexFit reads your heart rate and distance during workouts.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>EpexFit saves your workouts to Apple Health.</string>
```

---

## Step 4 — Enable WatchConnectivity on the iOS side

In the iOS target (your React Native app), add a native module or use the existing `react-native-watch-connectivity` package:

```bash
yarn add react-native-watch-connectivity
cd ios && pod install
```

Then in your JS code, send stats to the watch:
```typescript
import { sendMessage } from 'react-native-watch-connectivity';

// Call after loading home screen data
sendMessage({
  todaySteps: steps,
  streakCount: streak,
  apsScore: aps,
});
```

Receive workout completions from watch:
```typescript
import { watchEvents } from 'react-native-watch-connectivity';

watchEvents.on('message', (message) => {
  if (message.type === 'workout_completed') {
    // Save to Supabase
  }
});
```

---

## Step 5 — Test on simulator

1. Select the `EpexFitWatch` scheme
2. Choose a paired simulator (iPhone + Apple Watch pair)
3. Build and run — the watch app launches alongside the phone app

---

## Step 6 — EAS Build configuration

Add a custom workflow to `eas.json`:
```json
{
  "build": {
    "production": {
      "ios": {
        "scheme": "EpexFit",
        "buildConfiguration": "Release"
      }
    }
  }
}
```

The watch target is built automatically when you build the iOS app since it's embedded in the same workspace.

---

## Complication (Lock Screen / Watch Face widget)

1. In Xcode, add a **Widget Extension** target named `EpexFitWatchWidget`
2. Use `CLKComplicationDataSource` (WatchKit) or WidgetKit for watchOS 9+
3. Display: today's steps + streak count in a circular or rectangular complication

See Apple's WidgetKit documentation for watchOS:  
https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension

---

## Troubleshooting

| Issue | Fix |
|---|---|
| WCSession not reachable | Ensure phone and watch are both unlocked and on same Wi-Fi |
| HealthKit permissions denied | Re-run the app; check Settings → Privacy → Health on iPhone |
| Watch app not appearing | Re-pair simulator under Xcode → Window → Devices and Simulators |
