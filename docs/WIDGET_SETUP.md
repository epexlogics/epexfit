# Home Screen Widgets — Setup Guide

> **Status:** Planned feature — not yet implemented in the current release.
>
> Home screen widgets (iOS WidgetKit / Android App Widgets) are planned for a
> future release. The current app does not include any native widget extensions.

## Planned Widgets
- Daily steps progress ring
- Today's calorie summary
- Active workout status

## Current Notification Support
EpexFit uses `expo-notifications` for:
- Workout reminders
- Water intake reminders
- Streak milestone alerts

### Android notification setup
A `google-services.json` file from Firebase is required for push notifications
on Android. See `android/app/google-services.json` — replace the placeholder
with your real file from the Firebase Console.
