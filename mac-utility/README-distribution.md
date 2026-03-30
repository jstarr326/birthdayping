# BirthdayPing — Mac Utility Build & Distribution

## Prerequisites

```bash
cd mac-utility
pip3 install -r requirements.txt
```

## Building the .app

```bash
./build.sh
```

This produces `dist/BirthdayPing.app` — an unsigned build for local testing.

### Testing unsigned builds

macOS will block unsigned apps by default. To open:

1. Right-click `BirthdayPing.app` > **Open**
2. Click **Open** in the security dialog
3. Or: System Settings > Privacy & Security > scroll down > click **Open Anyway**

## Code Signing & Notarization

To distribute without security warnings, you need an [Apple Developer ID certificate](https://developer.apple.com/developer-id/) ($99/year).

### Setup

1. Enroll in the Apple Developer Program
2. Create a "Developer ID Application" certificate in Xcode > Settings > Accounts
3. Generate an [app-specific password](https://appleid.apple.com/account/manage) for notarization
4. Set environment variables:

```bash
export DEVELOPER_ID='Developer ID Application: Your Name (TEAMID)'
export APPLE_ID='you@example.com'
export TEAM_ID='XXXXXXXXXX'          # 10-character Team ID
export APP_PASSWORD='xxxx-xxxx-xxxx-xxxx'  # App-specific password
```

### Build + Sign + Notarize

```bash
./build.sh --sign
```

This will:
1. Build the .app with PyInstaller
2. Code sign with your Developer ID (using `entitlements.plist`)
3. Create a DMG
4. Submit to Apple for notarization (takes 2-15 minutes)
5. Staple the notarization ticket to the DMG

The resulting `dist/BirthdayPing.dmg` can be distributed to anyone — no security warnings.

## What Users Need After Installing

### Required Permissions

1. **Full Disk Access** — needed to read `~/Library/Messages/chat.db`
   - System Settings > Privacy & Security > Full Disk Access > add BirthdayPing
   - The app cannot request this programmatically; users must grant it manually

2. **Contacts** — needed to read names, phone numbers, and birthdays
   - macOS will prompt automatically on first run

3. **Automation** — needed for sending iMessage reminders via AppleScript
   - macOS will prompt when the app first tries to send a message

### Facebook Scraper

The Facebook birthday scraper uses Playwright (a browser automation tool). On first run, it will automatically download a Chromium browser (~150MB) to `~/Library/Caches/ms-playwright/`. This is a one-time download.

## Project Structure

```
mac-utility/
  app.py                  # Menu bar app entry point (rumps)
  core_engine.py          # -> ../core_engine.py (chat.db + contacts analysis)
  reminder_check.py       # Birthday reminder checker
  facebook_scraper.py     # Facebook GraphQL birthday scraper
  birthdayping.spec       # PyInstaller build spec
  build.sh                # Build + sign + notarize script
  entitlements.plist       # macOS entitlements for hardened runtime
  requirements.txt        # Python dependencies
```

## Entitlements

The `entitlements.plist` grants:

| Entitlement | Purpose |
|-------------|---------|
| `cs.allow-unsigned-executable-memory` | Required for PyObjC (Python-ObjC bridge) |
| `cs.disable-library-validation` | Required for loading PyObjC dynamic libraries |
| `personal-information.addressbook` | Contacts access |
| `automation.apple-events` | AppleScript for iMessage sending |

**Note:** Full Disk Access cannot be granted via entitlements. Users must enable it manually in System Settings.

## App Icon

Place an `icon.icns` file in `mac-utility/` to use a custom app icon. To generate one from a PNG:

```bash
# Create iconset from a 1024x1024 PNG
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```
