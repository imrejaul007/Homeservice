# App Store Setup Guide (iOS)

## Prerequisites

Before publishing to the App Store, you need:

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com/programs/

2. **macOS with Xcode** (required for iOS builds)
   - Minimum Xcode 15.0

3. **App Store Connect Account** access

4. **Push Notification Certificate** (APNs)
   - See "APNs Setup" below

5. **App Icons** (all required sizes)
   - See "App Icon Requirements" below

6. **Privacy Policy URL** (required)

---

## Step 1: APNs Setup (Push Notifications)

### Option A: APNs Certificate (Simpler)

1. Go to https://developer.apple.com
2. Go to "Certificates, Identifiers & Profiles"
3. Click "+" to create a new certificate
4. Select "Apple Push Notification service SSL (Sandbox & Production)"
5. Follow the prompts to create CSR using Keychain Access
6. Download the certificate
7. Export as .p12 file (you'll need this later)

### Option B: APNs Authentication Key (Recommended)

1. Go to https://developer.apple.com
2. Go to "Keys" → Click "+"
3. Name: "NILIN Push Key"
4. Check "Apple Push Notifications service (APNs)"
5. Download the .p8 key file
6. Note your Key ID and Team ID

---

## Step 2: Configure in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - **Platforms:** iOS
   - **Name:** NILIN
   - **Primary Language:** English
   - **Bundle ID:** Select or create `com.nilin.app`
   - **SKU:** NILIN-001 (or your internal reference)

---

## Step 3: iOS Project Configuration

### Update Info.plist

Edit `ios/App/App/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Existing entries... -->

    <!-- Privacy Descriptions -->
    <key>NSCameraUsageDescription</key>
    <string>NILIN needs camera access to take profile photos and service images.</string>

    <key>NSPhotoLibraryUsageDescription</key>
    <string>NILIN needs photo library access to select profile photos.</string>

    <key>NSLocationWhenInUseUsageDescription</key>
    <string>NILIN needs your location to find nearby service providers.</string>

    <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
    <string>NILIN needs your location to track your bookings and provide real-time updates.</string>

    <key>NSFaceIDUsageDescription</key>
    <string>Use Face ID to securely log into NILIN.</string>

    <!-- Background Modes -->
    <key>UIBackgroundModes</key>
    <array>
        <string>fetch</string>
        <string>remote-notification</string>
    </array>

    <!-- URL Schemes for Deep Linking -->
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>com.nilin.app</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>nilin</string>
            </array>
        </dict>
    </array>

    <!-- Associated Domains for Universal Links -->
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:nilin.app</string>
    </array>
</dict>
</plist>
```

### Enable Capabilities in Xcode

1. Open `ios/App/App.xcworkspace` in Xcode
2. Select your project in the navigator
3. Go to "Signing & Capabilities"
4. Add these capabilities:
   - Push Notifications
   - Associated Domains
   - Background Modes (Remote notifications, Background fetch)

---

## Step 4: Build for App Store

### Generate App Icons

Create all required sizes:
```
AppIcon/
  Contents.json
  AppIcon.appiconset/
    Icon-20@1x.png (20x20)
    Icon-20@2x.png (40x40)
    Icon-20@3x.png (60x60)
    Icon-29@1x.png (29x29)
    Icon-29@2x.png (58x58)
    Icon-29@3x.png (87x87)
    Icon-40@1x.png (40x40)
    Icon-40@2x.png (80x80)
    Icon-40@3x.png (120x120)
    Icon-60@1x.png (60x60)
    Icon-60@2x.png (120x120)
    Icon-60@3x.png (180x180)
    Icon-76@1x.png (76x76)
    Icon-76@2x.png (152x152)
    Icon-83.5@2x.png (167x167)
    Icon-1024@1x.png (1024x1024) - App Store
```

### Build Commands

```bash
cd frontend

# Build web app
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
open ios/App/App.xcworkspace

# In Xcode:
# 1. Select your team for signing
# 2. Set "Generic iOS Device" as destination
# 3. Product → Archive
# 4. Distribute App → App Store Connect
```

---

## Step 5: Upload to App Store Connect

### Using Xcode Organizer

1. After archiving, Xcode Organizer opens
2. Select your archive
3. Click "Distribute App"
4. Choose "App Store Connect"
5. Follow the prompts:
   - Upload: Yes
   - Include bitcode: No (deprecated)
6. Select your signing certificate
7. Choose "Upload"

### Using Transporter App

1. Download Transporter from Mac App Store
2. Drag and drop your .ipa file
3. Click "Deliver"

---

## App Store Listing

### Name: NILIN

### Subtitle: Premium Home Services

### Description (4000 chars max)
```
NILIN - Your Premium Home Services Marketplace

Discover trusted professionals for all your home service needs. From deep cleaning to beauty treatments, repairs to installations - NILIN connects you with verified experts in your area.

FEATURES:
• Browse & Book - Find the perfect service provider
• Verified Professionals - Background-checked providers
• Real-time Tracking - Track your bookings live
• Secure Payments - Pay safely through the app
• Loyalty Rewards - Earn points with every booking
• Instant Notifications - Stay updated

SERVICES:
• Home Cleaning (regular, deep, move-in/out)
• Beauty & Wellness (hair, nails, spa)
• Repairs & Installation (plumbing, electrical, AC)
• And many more!

Download NILIN today for premium home services made simple.
```

### Keywords (100 chars max)
```
home services, cleaning, beauty, repairs, plumber, electrician, maid, salon, spa
```

### Category
- Primary: Lifestyle
- Secondary: Home Services

### Age Rating: 4+

### Screenshots Required
- iPhone 6.5" Display (1284x2778): 1-5 screenshots
- iPhone 5.5" Display (1242x2208): 1-5 screenshots
- iPad Pro 12.9" (2048x2732): 1-5 screenshots (optional but recommended)

### App Preview Video (Optional)
- 15-30 seconds
- Show key features
- iPhone 6.5" or iPad Pro 12.9"

---

## Review & Submission

1. In App Store Connect, go to your app
2. Fill in all required information
3. Add screenshots and preview
4. Click "Add for Review"
5. Apple typically reviews within 24-48 hours

---

## Troubleshooting

### "No accounts with iOS Distribution"
- Open Xcode → Preferences → Accounts
- Add your Apple Developer account

### "Bundle identifier already exists"
- Use a unique bundle ID in App Store Connect
- Or request to transfer the existing app

### "Push Notifications capability not found"
- Enable in Xcode Signing & Capabilities
- Regenerate provisioning profile if needed
