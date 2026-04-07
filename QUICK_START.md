# 🚀 EpexFit Quick Start Guide

## Launch in 5 Minutes

### ✅ Prerequisites Check
- [x] Node.js installed (v18+)
- [x] npm installed
- [x] Dependencies installed (592 packages)
- [x] `.env` file configured
- [x] Supabase project active

---

## 🎯 Start Development Server

```bash
# Navigate to project
cd "f:\app testing\EpexFit"

# Start Expo
npm start
```

**Expected Output:**
```
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

---

## 📱 Test on Device

### iOS (Recommended)
1. Install **Expo Go** from App Store
2. Open Camera app
3. Scan QR code from terminal
4. App opens in Expo Go

### Android
1. Install **Expo Go** from Play Store
2. Open Expo Go app
3. Scan QR code from terminal
4. App opens in Expo Go

### iOS Simulator (Mac only)
```bash
npm run ios
```

### Android Emulator
```bash
npm run android
```

---

## 🧪 Quick Test Flow (2 minutes)

### 1. Register Account
- Open app
- Tap "Create Account"
- Email: `test@example.com`
- Password: `Test123!`
- Name: `Test User`
- Tap "Sign Up"

### 2. Complete Onboarding
- Select fitness level: Intermediate
- Set goals: 10,000 steps
- Training days: 5 days/week
- Tap "Get Started"

### 3. Test Core Features
- **Home Tab:** See APS score, weekly stats
- **Activity Tab:** Start a walk (tap "START ACTIVITY")
- **Progress Tab:** View charts
- **Workouts Tab:** Create a workout
- **Social Tab:** Browse feed
- **Profile Tab:** Edit profile, change theme

---

## 🔍 Verify Everything Works

### ✅ Checklist
- [ ] App loads without errors
- [ ] Can register new account
- [ ] Can log in
- [ ] Home screen shows data
- [ ] Activity tracking starts
- [ ] Food search returns results
- [ ] Profile picture uploads
- [ ] Theme switching works
- [ ] No console errors

---

## 🚨 If Something Breaks

### Quick Fixes
```bash
# Clear cache and restart
npx expo start -c

# Reinstall dependencies
rm -rf node_modules && npm install

# Check environment variables
cat .env
```

### Common Issues
1. **White screen:** Clear cache (`npx expo start -c`)
2. **API errors:** Check `.env` has `EXPO_PUBLIC_` prefix
3. **GPS not working:** Enable location permissions
4. **Food search fails:** USDA API key missing (app uses fallback)

See `TROUBLESHOOTING.md` for detailed solutions.

---

## 📦 Build for Production

### iOS (TestFlight)
```bash
# First time: configure credentials
eas build:configure

# Build
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

### Android (Google Play)
```bash
# Build
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

**Build time:** 10-20 minutes per platform

---

## 🎉 You're Ready!

Your app is now running and ready for testing. 

### Next Steps:
1. ✅ Test all features thoroughly
2. ✅ Fix any bugs you find
3. ✅ Add privacy policy URL to `app.json`
4. ✅ Add terms of service URL to `app.json`
5. ✅ Prepare app store screenshots
6. ✅ Build production version
7. ✅ Submit to App Store & Google Play

---

## 📚 Documentation

- **Full Launch Guide:** `LAUNCH_READY.md`
- **Troubleshooting:** `TROUBLESHOOTING.md`
- **Environment Setup:** `.env.example`

---

## 🆘 Need Help?

**Check logs:**
- Terminal where `npm start` is running
- Browser console (if using web)
- Xcode console (if using iOS simulator)

**Common commands:**
```bash
npm start              # Start dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npx expo start -c      # Clear cache and start
```

---

**Good luck! 🚀**

*Your app is production-ready and waiting to launch.*
