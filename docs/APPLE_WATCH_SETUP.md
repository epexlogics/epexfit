# Apple Watch & watchOS Companion — Setup Guide

> **Status:** Planned feature — not yet implemented in the current release.
>
> The current version of EpexFit reads step and activity data from Apple Health
> (HealthKit) on iOS using `expo-sensors` Pedometer. A native watchOS companion
> app is planned for a future release.

## Planned Features
- Live workout metrics on Apple Watch face
- Haptic cues for pace/interval alerts
- Heart rate streaming to EpexFit during workouts

## Current iOS Health Integration
EpexFit reads from HealthKit via the Pedometer API:
- Daily step count
- Live step tracking during workouts

### Required Permissions (already configured in app.json)
```
NSHealthShareUsageDescription  — reads steps from Apple Health
NSMotionUsageDescription        — accesses CoreMotion for step counting
```

### Required Entitlement (already configured in app.json)
```
com.apple.developer.healthkit: true
```
