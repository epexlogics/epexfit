# Home Screen Widget — Setup Guide

The EpexFit widget shows:
- **Today's steps** with progress ring
- **Streak count** 🔥
- **APS score**
- **Quick Log** deep-link button

---

## Android Widget (Jetpack Glance / App Widget)

### Option A — `expo-community-widgets` (recommended for Expo)

```bash
yarn add expo-community-widgets
# or
npx expo install expo-community-widgets
```

Create `widget/android/EpexFitWidget.kt`:
```kotlin
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class EpexFitWidget : GlanceAppWidget() {
    // See full implementation in widget/android/
}

class EpexFitWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = EpexFitWidget()
}
```

Register in `android/app/src/main/AndroidManifest.xml`:
```xml
<receiver
  android:name=".widget.EpexFitWidgetReceiver"
  android:exported="true">
  <intent-filter>
    <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
  </intent-filter>
  <meta-data
    android:name="android.appwidget.provider"
    android:resource="@xml/epexfit_widget_info" />
</receiver>
```

Create `android/app/src/main/res/xml/epexfit_widget_info.xml`:
```xml
<appwidget-provider
  android:minWidth="110dp"
  android:minHeight="40dp"
  android:updatePeriodMillis="1800000"
  android:previewImage="@drawable/widget_preview"
  android:initialLayout="@layout/epexfit_widget"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
```

Pass data to the widget from React Native:
```typescript
import { updateWidget } from 'expo-community-widgets';

await updateWidget('EpexFitWidget', {
  steps: 7842,
  streak: 12,
  aps: 87.4,
});
```

---

## iOS Widget (WidgetKit)

### Step 1 — Add Widget Extension target

1. Open `ios/EpexFit.xcworkspace` in Xcode
2. **File → New → Target → Widget Extension**
3. Name: `EpexFitWidget`
4. Bundle ID: `com.yourcompany.epexfit.widget`
5. Uncheck "Include Configuration Intent" for a static widget

### Step 2 — Widget Swift code

Create `ios/EpexFitWidget/EpexFitWidget.swift`:
```swift
import WidgetKit
import SwiftUI

struct EpexFitEntry: TimelineEntry {
    let date: Date
    let steps: Int
    let streak: Int
    let aps: Double
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> EpexFitEntry {
        EpexFitEntry(date: Date(), steps: 8000, streak: 7, aps: 80)
    }

    func getSnapshot(in context: Context, completion: @escaping (EpexFitEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<EpexFitEntry>) -> Void) {
        let entry = loadEntry()
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadEntry() -> EpexFitEntry {
        // Read from App Group shared UserDefaults
        let defaults = UserDefaults(suiteName: "group.com.yourcompany.epexfit")
        return EpexFitEntry(
            date: Date(),
            steps: defaults?.integer(forKey: "todaySteps") ?? 0,
            streak: defaults?.integer(forKey: "streakCount") ?? 0,
            aps: defaults?.double(forKey: "apsScore") ?? 0
        )
    }
}

struct EpexFitWidgetView: View {
    let entry: EpexFitEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("EpexFit")
                .font(.caption2).foregroundColor(.secondary)
            HStack {
                VStack(alignment: .leading) {
                    Text("\(entry.steps)")
                        .font(.title2.bold()).foregroundColor(.green)
                    Text("Steps").font(.caption2).foregroundColor(.secondary)
                }
                Spacer()
                VStack(alignment: .trailing) {
                    Text("\(entry.streak)🔥")
                        .font(.title3.bold())
                    Text("\(Int(entry.aps)) APS")
                        .font(.caption2).foregroundColor(.cyan)
                }
            }
        }
        .padding()
        .containerBackground(.background, for: .widget)
    }
}

@main
struct EpexFitWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "EpexFitWidget", provider: Provider()) { entry in
            EpexFitWidgetView(entry: entry)
        }
        .configurationDisplayName("EpexFit")
        .description("Your daily fitness at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
```

### Step 3 — Share data from React Native to widget

1. Add an **App Group** capability to both the main app target and the widget target:
   - `group.com.yourcompany.epexfit`
2. In React Native, write to shared UserDefaults using `react-native-shared-group-preferences`:

```bash
yarn add react-native-shared-group-preferences
cd ios && pod install
```

```typescript
import SharedGroupPreferences from 'react-native-shared-group-preferences';

const APP_GROUP = 'group.com.yourcompany.epexfit';

await SharedGroupPreferences.setItem('todaySteps', steps, APP_GROUP);
await SharedGroupPreferences.setItem('streakCount', streak, APP_GROUP);
await SharedGroupPreferences.setItem('apsScore', aps, APP_GROUP);

// Tell WidgetKit to refresh
import { NativeModules } from 'react-native';
NativeModules.WidgetKit?.reloadAllTimelines();
```

3. Add a tiny native module to call `WidgetCenter.shared.reloadAllTimelines()` — see `ios/EpexFit/WidgetKitBridge.swift`.

---

## Testing

**Android:** Long-press home screen → Widgets → EpexFit

**iOS:** Long-press home screen → + button → search "EpexFit"

---

## Deep Links from Widget

Configure deep links to open directly to the daily log or activity screen:

```swift
// In EpexFitWidgetView
Link(destination: URL(string: "epexfit://log")!) {
    Text("Quick Log")
}
```

Ensure `epexfit://` is registered in your `app.config.js` under `scheme`.
