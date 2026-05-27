# iOS Deep Link Fix

To enable universal links and custom URL schemes in your iOS app, you need to add `CFBundleURLTypes` to your `Info.plist` file.

## Steps to Add CFBundleURLTypes

1. Open your iOS project in Xcode:
   ```
   npx cap open ios
   ```

2. In Xcode, select your app target and navigate to **Info** > **URL Types**

3. Click the **+** button to add a new URL type

4. Configure the following fields:

   | Field | Value |
   |-------|-------|
   | **Identifier** | `com.yourcompany.yourapp` (your app bundle identifier) |
   | **URL Schemes** | Add your custom scheme(s), e.g., `yourapp` |

5. For universal links (https://), add your associated domains:
   - Go to **Signing & Capabilities** > **Associated Domains**
   - Add `applinks:yourdomain.com`

## Example Info.plist Addition

If you prefer to edit `Info.plist` directly, add this inside the `<dict>` element:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>com.yourcompany.yourapp</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>yourapp</string>
        </array>
    </dict>
</array>
```

## After Making Changes

1. Save the file
2. Run `npx cap sync ios` to sync the changes
3. Rebuild your iOS project

## Testing Deep Links

After setup, test your deep links:

```bash
# Custom URL scheme
xcrun simctl openurl booted "yourapp://path/to/page"

# Universal link
xcrun simctl openurl booted "https://yourdomain.com/path/to/page"
```
