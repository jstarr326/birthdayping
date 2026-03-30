# BirthdayPing — Mac Utility Build & Distribution

## Prerequisites

```bash
cd mac-utility
pip3 install -r requirements.txt
```

## Building

```bash
# Build .app only (for local development)
./build.sh

# Build .app + styled DMG (for sharing with beta testers)
./build.sh --dmg

# Build + code sign + notarize DMG (for public distribution)
./build.sh --sign
```

### Output

| Command | Output |
|---------|--------|
| `./build.sh` | `dist/BirthdayPing.app` |
| `./build.sh --dmg` | `dist/BirthdayPing-1.0.0.dmg` |
| `./build.sh --sign` | `dist/BirthdayPing-1.0.0.dmg` (signed + notarized) |

## Sharing with Beta Testers

### 1. Build the DMG

```bash
./build.sh --dmg
```

### 2. Share the DMG

Send `dist/BirthdayPing-1.0.0.dmg` to testers via AirDrop, iMessage, email, etc.

### 3. Tell testers

> **To install:**
> 1. Open the DMG and drag BirthdayPing to Applications
> 2. Open Applications, right-click BirthdayPing → **Open** → click **Open** in the dialog
> 3. Follow the welcome screen to grant permissions
>
> (The right-click step is only needed the first time — macOS blocks unsigned apps by default)

### What testers will see

1. **DMG opens** — shows BirthdayPing.app with an arrow pointing to Applications, plus instructions for the right-click workaround
2. **First launch** — a welcome dialog explains the two permissions needed (Full Disk Access + Contacts) and offers to open System Settings directly
3. **Menu bar** — 🎂 icon appears in the menu bar

## Code Signing & Notarization

For distribution without security warnings, you need an [Apple Developer ID certificate](https://developer.apple.com/developer-id/) ($99/year).

### Setup

1. Enroll in the Apple Developer Program
2. Create a "Developer ID Application" certificate in Xcode → Settings → Accounts
3. Generate an [app-specific password](https://appleid.apple.com/account/manage) for notarization
4. Set environment variables:

```bash
export DEVELOPER_ID='Developer ID Application: Your Name (TEAMID)'
export APPLE_ID='you@example.com'
export TEAM_ID='XXXXXXXXXX'
export APP_PASSWORD='xxxx-xxxx-xxxx-xxxx'
```

### Build + Sign + Notarize

```bash
./build.sh --sign
```

This will:
1. Build the .app with PyInstaller
2. Code sign with your Developer ID (using `entitlements.plist`)
3. Create a styled DMG with Applications shortcut
4. Submit to Apple for notarization (2-15 minutes)
5. Staple the notarization ticket to the DMG

The resulting DMG can be distributed to anyone — no security warnings.

## User Permissions

### Required

| Permission | Why | How |
|------------|-----|-----|
| **Full Disk Access** | Read `~/Library/Messages/chat.db` for iMessage metadata | System Settings → Privacy & Security → Full Disk Access → add BirthdayPing |
| **Contacts** | Match names to phone numbers, find existing birthdays | macOS prompts automatically on first run |

### Optional

| Permission | Why | How |
|------------|-----|-----|
| **Automation** | Send iMessage reminders via AppleScript | macOS prompts when first sending a reminder |

### First-Launch Welcome Dialog

On first run, BirthdayPing shows a native welcome dialog explaining the permissions and offering a button to open System Settings directly to Full Disk Access. This dialog only appears once (flag stored at `~/.birthdayping/onboarded`).

To reset (show the dialog again):
```bash
rm ~/.birthdayping/onboarded
```

## Facebook Scraper & Playwright

The Facebook birthday scraper uses Playwright to automate a Chromium browser. On first use, it automatically downloads Chromium (~150MB) to `~/Library/Caches/ms-playwright/`. This is not bundled in the .app to keep the download small.

## Project Structure

```
mac-utility/
  app.py                    Menu bar app entry point (rumps)
  core_engine.py            → ../core_engine.py (chat.db + contacts analysis)
  reminder_check.py         Birthday reminder checker
  facebook_scraper.py       Facebook GraphQL birthday scraper
  birthdayping.spec         PyInstaller build specification
  build.sh                  Build + sign + notarize script
  create_dmg_background.py  Generates DMG background image
  entitlements.plist        macOS entitlements for hardened runtime
  requirements.txt          Python dependencies
```

## App Icon

Place an `icon.icns` file in `mac-utility/` to use a custom app icon. To generate one from a 1024x1024 PNG:

```bash
mkdir icon.iconset
for size in 16 32 128 256 512; do
    sips -z $size $size icon.png --out icon.iconset/icon_${size}x${size}.png
    sips -z $((size*2)) $((size*2)) icon.png --out icon.iconset/icon_${size}x${size}@2x.png
done
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

## Entitlements

| Entitlement | Purpose |
|-------------|---------|
| `cs.allow-unsigned-executable-memory` | Required for PyObjC |
| `cs.disable-library-validation` | Required for PyObjC dynamic libraries |
| `personal-information.addressbook` | Contacts access |
| `automation.apple-events` | AppleScript for iMessage |

Full Disk Access cannot be granted via entitlements — users must enable it manually.
