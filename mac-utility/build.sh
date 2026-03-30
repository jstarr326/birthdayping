#!/usr/bin/env bash
set -euo pipefail

#───────────────────────────────────────────────────────────────
# BirthdayPing — Mac .app build script
#
# Usage:
#   ./build.sh              Build unsigned .app
#   ./build.sh --dmg        Build .app + styled DMG for sharing
#   ./build.sh --sign       Build + code sign + notarize DMG
#
# Prerequisites:
#   pip3 install -r requirements.txt
#───────────────────────────────────────────────────────────────

VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
APP_NAME="BirthdayPing"
APP_PATH="$DIST_DIR/$APP_NAME.app"
DMG_PATH="$DIST_DIR/${APP_NAME}-${VERSION}.dmg"

SIGN=false
MAKE_DMG=false

for arg in "$@"; do
    case "$arg" in
        --sign) SIGN=true; MAKE_DMG=true ;;
        --dmg)  MAKE_DMG=true ;;
    esac
done

echo "=== BirthdayPing Build (v${VERSION}) ==="
echo ""

# ── Step 1: Clean previous build ────────────────────────────
echo "[1] Cleaning previous build..."
rm -rf "$SCRIPT_DIR/build" "$DIST_DIR"

# ── Step 2: Run PyInstaller ─────────────────────────────────
echo "[2] Running PyInstaller..."
cd "$SCRIPT_DIR"
python3 -m PyInstaller birthdayping.spec --noconfirm

if [[ ! -d "$APP_PATH" ]]; then
    echo "ERROR: PyInstaller failed — $APP_PATH not found"
    exit 1
fi

echo "    ✓ Built $APP_PATH"

# ── Step 3: Code sign (optional) ────────────────────────────
if $SIGN; then
    echo "[3] Code signing..."

    : "${DEVELOPER_ID:?Set DEVELOPER_ID env var (e.g. 'Developer ID Application: Name (TEAMID)')}"
    : "${APPLE_ID:?Set APPLE_ID env var}"
    : "${TEAM_ID:?Set TEAM_ID env var}"
    : "${APP_PASSWORD:?Set APP_PASSWORD env var}"

    ENTITLEMENTS="$SCRIPT_DIR/entitlements.plist"
    if [[ ! -f "$ENTITLEMENTS" ]]; then
        echo "ERROR: entitlements.plist not found at $ENTITLEMENTS"
        exit 1
    fi

    # Sign all nested binaries first, then the .app itself
    find "$APP_PATH" -type f \( -name "*.dylib" -o -name "*.so" -o -perm +111 \) \
        -exec codesign --force --options runtime --sign "$DEVELOPER_ID" \
        --entitlements "$ENTITLEMENTS" --timestamp {} \;

    codesign --force --deep --options runtime \
        --sign "$DEVELOPER_ID" \
        --entitlements "$ENTITLEMENTS" \
        --timestamp \
        "$APP_PATH"

    echo "    ✓ Signed with $DEVELOPER_ID"

    codesign --verify --deep --strict "$APP_PATH"
    echo "    ✓ Signature verified"
else
    echo "[3] Skipping code signing (use --sign to sign)"
fi

# ── Step 4: Create styled DMG ───────────────────────────────
if $MAKE_DMG; then
    echo "[4] Creating DMG..."

    DMG_STAGING="$DIST_DIR/dmg-staging"
    DMG_TEMP="$DIST_DIR/${APP_NAME}-temp.dmg"
    BG_IMG="$SCRIPT_DIR/dmg-background.png"

    # Generate background image
    python3 "$SCRIPT_DIR/create_dmg_background.py" "$BG_IMG" 2>/dev/null || true

    # Create staging directory with app and Applications symlink
    mkdir -p "$DMG_STAGING"
    cp -R "$APP_PATH" "$DMG_STAGING/"
    ln -s /Applications "$DMG_STAGING/Applications"

    # Create a read-write DMG first (so we can style it)
    hdiutil create -volname "$APP_NAME" \
        -srcfolder "$DMG_STAGING" \
        -ov -format UDRW \
        "$DMG_TEMP"

    # Mount the DMG to apply styling
    MOUNT_DIR=$(hdiutil attach "$DMG_TEMP" -readwrite -noverify | \
        grep "/Volumes/$APP_NAME" | awk '{print $NF}')

    if [[ -n "$MOUNT_DIR" && -f "$BG_IMG" ]]; then
        # Copy background image into the DMG
        mkdir -p "$MOUNT_DIR/.background"
        cp "$BG_IMG" "$MOUNT_DIR/.background/background.png"

        # Apply Finder window styling via AppleScript
        osascript <<APPLESCRIPT
tell application "Finder"
    tell disk "$APP_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set bounds of container window to {200, 200, 800, 620}
        set theViewOptions to icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 80
        set background picture of theViewOptions to file ".background:background.png"
        set position of item "$APP_NAME.app" of container window to {150, 200}
        set position of item "Applications" of container window to {450, 200}
        close
        open
        update without registering applications
        delay 1
        close
    end tell
end tell
APPLESCRIPT
    fi

    # Unmount
    hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
    sleep 1

    # Convert to compressed read-only DMG
    hdiutil convert "$DMG_TEMP" -format UDZO -o "$DMG_PATH"
    rm -f "$DMG_TEMP"
    rm -rf "$DMG_STAGING"
    rm -f "$BG_IMG"

    echo "    ✓ Created $DMG_PATH"
else
    echo "[4] Skipping DMG (use --dmg or --sign)"
fi

# ── Step 5: Notarize (only with --sign) ─────────────────────
if $SIGN; then
    echo "[5] Submitting for notarization..."
    xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$APPLE_ID" \
        --team-id "$TEAM_ID" \
        --password "$APP_PASSWORD" \
        --wait

    xcrun stapler staple "$DMG_PATH"
    echo "    ✓ Notarized and stapled"
else
    echo "[5] Skipping notarization"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "=== Build complete ==="
echo ""
echo "  App:  $APP_PATH"
if $MAKE_DMG; then
    echo "  DMG:  $DMG_PATH"
fi
echo ""
echo "To test: open \"$APP_PATH\""
echo ""
if ! $SIGN && ! $MAKE_DMG; then
    echo "Next steps:"
    echo "  ./build.sh --dmg     Create a DMG for sharing with beta testers"
    echo "  ./build.sh --sign    Sign + notarize for public distribution"
fi
