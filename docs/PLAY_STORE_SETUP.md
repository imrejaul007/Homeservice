# Play Store Setup Guide

## Prerequisites

Before publishing to the Play Store, you need:

1. **Google Play Developer Account** ($25 one-time fee)
   - Sign up at: https://play.google.com/console

2. **Firebase Project** (for Push Notifications)
   - Create at: https://console.firebase.google.com/
   - Download `google-services.json` (see Firebase Setup below)

3. **App Icons** (generate from your designer)
   - See `android/app/src/main/res/mipmap-*/README.md` for sizes needed

4. **Privacy Policy URL** (required)
   - Host at: `https://nilin.app/privacy`
   - Must comply with Google Play Privacy Policy requirements

5. **Release Keystore** (for signing)
   - See "Generating Release Keystore" below

---

## Step 1: Firebase Setup

1. Go to https://console.firebase.google.com/
2. Click "Add project" → Name: `nilin-homeservice`
3. Disable Google Analytics if not needed
4. Click "Create project"
5. In project settings, go to "Your apps" → Add Android app
   - Package name: `com.nilin.app`
   - App nickname: `NILIN`
   - Debug signing certificate: Leave empty for development
6. Download `google-services.json`
7. Place it at: `android/app/google-services.json`

---

## Step 2: Enable Firebase Cloud Messaging

1. In Firebase Console, go to "Messaging" in the sidebar
2. Click "Create your first campaign" or "New notification"
3. Follow the prompts to test sending a notification

---

## Step 3: Generate Release Keystore

```bash
# Run from the android directory
cd android

# Generate keystore (use a strong password and store it safely)
keytool -genkey -v -keystore release-key.keystore -alias nilin -keyalg RSA -keysize 2048 -validity 10000

# You'll be prompted for:
# - Keystore password
# - Key password
# - Your name, organization, city, state, country
```

**IMPORTANT:** Keep your keystore file safe! You'll need it for every update.

---

## Step 4: Configure Release Signing

Edit `android/app/build.gradle`:

```gradle
signingConfigs {
    release {
        storeFile file('release-key.keystore')
        storePassword 'YOUR_STORE_PASSWORD'
        keyAlias 'nilin'
        keyPassword 'YOUR_KEY_PASSWORD'
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        // ... rest of config
    }
}
```

---

## Step 5: Build Release APK/AAB

```bash
# From the frontend directory
cd frontend

# Build web app
npm run build

# Sync to Android
npx cap sync android

# Build release APK
cd android
./gradlew assembleRelease

# OR build App Bundle (recommended for Play Store)
./gradlew bundleRelease

# Output location:
# - APK: android/app/build/outputs/apk/release/
# - AAB: android/app/build/outputs/bundle/release/
```

---

## Step 6: Play Store Console Setup

1. Go to https://play.google.com/console
2. Select your developer account
3. Click "Create app"

### Store Listing Information

**App Name:** NILIN
**Short Description:** (80 characters max)
```
Premium home services at your fingertips
```

**Full Description:** (4000 characters max)
```
NILIN - Your Premium Home Services Marketplace

Discover trusted professionals for all your home service needs. From deep cleaning to beauty treatments, repairs to installations - NILIN connects you with verified experts in your area.

FEATURES:
✓ Browse & Book: Find the perfect service provider for your needs
✓ Verified Professionals: All providers are background-checked
✓ Real-time Tracking: Track your bookings in real-time
✓ Secure Payments: Pay safely through the app
✓ Loyalty Rewards: Earn points with every booking
✓ Instant Notifications: Stay updated on your bookings

SERVICES:
• Home Cleaning (regular, deep, move-in/out)
• Beauty & Wellness (hair, nails, spa)
• Repairs & Installation (plumbing, electrical, AC)
• And many more categories!

Download NILIN today and experience premium home services made simple.
```

**Category:** Lifestyle > Home Services

**Tags:** home services, cleaning, beauty, repairs, plumber, electrician

**Contact Email:** support@nilin.app

**Privacy Policy URL:** https://nilin.app/privacy

**Website:** https://nilin.app

---

## Step 7: Upload to Play Store

1. In Play Console, go to "Production" → "Create release"
2. Upload your `.aab` file (App Bundle is recommended)
3. Fill in "What's new in this release?"
4. Review and save
5. Click "Review release"
6. Click "Send for approval"

**Review typically takes 1-7 days.**

---

## Troubleshooting

### "App not compliant with Java 8+ desugaring"
Add to `android/app/build.gradle`:
```gradle
android {
    compileOptions {
        coreLibraryDesugaringEnabled true
    }
}
dependencies {
    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.0.4'
}
```

### "Native code missing"
Make sure you run `npx cap sync android` after adding new plugins.

### "Signature mismatch"
Verify your keystore alias and passwords are correct.

---

## Post-Launch Checklist

- [ ] Test on multiple devices
- [ ] Enable Firebase Analytics
- [ ] Set up Play Store notifications
- [ ] Configure App Signing by Play Store (optional)
- [ ] Set up Crashlytics/Play Console crash reporting
- [ ] Create support article for common issues
