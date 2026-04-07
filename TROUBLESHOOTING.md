# 🔧 EpexFit Troubleshooting Guide

## Quick Fixes for Common Issues

### 🚨 App Won't Start / White Screen

**Symptom:** App shows white screen or crashes immediately

**Solutions:**
```bash
# 1. Clear cache and restart
npx expo start -c

# 2. Reinstall dependencies
rm -rf node_modules
npm install

# 3. Clear Metro bundler cache
npx expo start --clear

# 4. Reset Expo cache
npx expo start --reset-cache
```

---

### 🔑 "Supabase URL is undefined" Error

**Symptom:** Console shows "SUPABASE_URL is undefined" or similar

**Solution:**
1. Check `.env` file has `EXPO_PUBLIC_` prefix:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
   ```

2. Restart Expo dev server:
   ```bash
   # Stop current server (Ctrl+C)
   npx expo start -c
   ```

3. Verify `app.config.js` reads from `process.env.EXPO_PUBLIC_*`

---

### 🍔 Food Search Not Working

**Symptom:** "USDA API key missing" warning or no search results

**Solution:**
1. Get free API key: https://fdc.nal.usda.gov/api-key-signup.html
2. Add to `.env`:
   ```
   EXPO_PUBLIC_USDA_API_KEY=your_key_here
   ```
3. Restart dev server

**Fallback:** App will use local database (10 common foods) if API key is missing

---

### 📍 GPS Tracking Not Working

**Symptom:** Map shows "Your route appears here" but no location points

**Solutions:**

**iOS Simulator:**
```
Features > Location > Custom Location
Enter: 37.7749, -122.4194 (San Francisco)
```

**Android Emulator:**
```
Extended Controls (⋮) > Location > Set location
Enter: 37.7749, -122.4194
```

**Physical Device:**
1. Settings > Privacy > Location Services > EpexFit > "Always"
2. Grant "Allow While Using App" then "Change to Always Allow"

---

### 🔔 Notifications Not Showing

**Symptom:** Reminders don't trigger

**Solutions:**

**iOS:**
1. Settings > Notifications > EpexFit > Allow Notifications
2. Enable Sounds, Badges, Banners

**Android:**
1. Settings > Apps > EpexFit > Notifications > Enable
2. Check "Do Not Disturb" is off

**Code Check:**
```typescript
// In ProfileScreen, verify reminders are saved:
await scheduleReminders(reminderSettings);
```

---

### 👤 Profile Picture Not Saving

**Symptom:** Avatar disappears after app restart

**Solution:**
✅ **FIXED** - Avatar now uploads to Supabase Storage and persists

If still having issues:
1. Check Supabase Storage bucket `avatars` exists
2. Check RLS policies allow uploads:
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM storage.buckets WHERE name = 'avatars';
   ```

---

### 🏃 Activity Type Changes During Tracking

**Symptom:** Started "Running" but saved as "Walking"

**Solution:**
✅ **FIXED** - Activity type now locked when tracking starts

Verify fix in `TrackingContext.tsx`:
```typescript
selectedTypeRef.current = type; // Type locked here
```

---

### 📊 APS Score Always Shows 0

**Symptom:** Athlete Performance Score stuck at 0

**Solutions:**
1. Log some data:
   - Complete an activity (Activity tab)
   - Log food (Food Log)
   - Log sleep (Daily Log)
   - Set goals (Goals tab)

2. Refresh Home screen (pull down)

3. Check training days in onboarding:
   ```typescript
   // Should be 2-6, not 0
   AsyncStorage.getItem('@epexfit_onboarding')
   ```

---

### 🔐 "Email not confirmed" Error

**Symptom:** Can't sign in after registration

**Solutions:**
1. Check email inbox (including spam) for confirmation link
2. Click confirmation link
3. Try signing in again

**Resend confirmation:**
```typescript
// In LoginScreen
await resendConfirmationEmail(email);
```

**Disable email confirmation (dev only):**
1. Supabase Dashboard > Authentication > Settings
2. Disable "Enable email confirmations"
3. ⚠️ Re-enable for production!

---

### 🗄️ Database Errors / RLS Violations

**Symptom:** "new row violates row-level security policy" or similar

**Solution:**
Check Supabase RLS policies are set up:

```sql
-- Example: activities table
CREATE POLICY "Users can insert own activities"
ON activities FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own activities"
ON activities FOR SELECT
USING (auth.uid() = user_id);
```

**Quick fix:** Temporarily disable RLS (dev only):
```sql
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
```
⚠️ **Never disable RLS in production!**

---

### 📱 Build Fails on EAS

**Symptom:** `eas build` fails with errors

**Common Solutions:**

**1. Environment variables not set:**
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your_url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your_key"
eas secret:create --scope project --name EXPO_PUBLIC_USDA_API_KEY --value "your_key"
```

**2. iOS bundle identifier mismatch:**
Check `app.json`:
```json
"ios": {
  "bundleIdentifier": "com.epexlogics.epexfit"
}
```

**3. Android package name mismatch:**
Check `app.json`:
```json
"android": {
  "package": "com.epexlogics.epexfit"
}
```

**4. Missing credentials:**
```bash
eas credentials
# Follow prompts to configure
```

---

### 🎨 Icons Showing as Orange Squares

**Symptom:** Some icons render as orange/colored squares

**Solution:**
✅ **FIXED** - All icons now have fallbacks

If still seeing issues, check `AppIcon.tsx`:
```typescript
// Missing icon? Add to VECTOR_FALLBACK_MAP
const VECTOR_FALLBACK_MAP = {
  'your-icon-name': { lib: 'Ionicons', name: 'icon-name' }
};
```

---

### 🌐 Social Feed Empty

**Symptom:** Social tab shows "No posts yet"

**Solutions:**
1. Follow some users (Profile > Search)
2. Complete an activity (publishes to feed)
3. Check `feed_events` table exists in Supabase
4. Verify RLS policies allow reading feed:
   ```sql
   SELECT * FROM feed_events LIMIT 10;
   ```

---

### 💾 Data Not Syncing

**Symptom:** Changes don't save or disappear

**Solutions:**
1. Check internet connection
2. Check Supabase project is not paused (free tier auto-pauses after 7 days inactivity)
3. Verify API keys are correct
4. Check browser console / Xcode console for errors

**Force sync:**
```typescript
// In HomeScreen
await databaseService.syncGoalProgress(user.id);
```

---

## 🆘 Still Having Issues?

### Debug Mode
Enable detailed logging:
```typescript
// In App.tsx
console.log('[DEBUG] User:', user);
console.log('[DEBUG] Supabase URL:', SUPABASE_URL);
```

### Check Logs
**iOS:** Xcode > Window > Devices and Simulators > View Device Logs
**Android:** `adb logcat`
**Expo:** Terminal where `expo start` is running

### Reset Everything
```bash
# Nuclear option - fresh start
rm -rf node_modules
rm -rf .expo
rm package-lock.json
npm install
npx expo start -c
```

### Contact Support
If all else fails:
1. Check GitHub issues: (add your repo URL)
2. Email: (add your support email)
3. Discord: (add your Discord server)

---

## 📚 Useful Commands

```bash
# Start development server
npm start

# Start with cache clear
npx expo start -c

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Check for updates
npx expo-doctor

# Build for production
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

**Last Updated:** January 2025
**App Version:** 3.0.0
