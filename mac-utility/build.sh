#!/usr/bin/env bash
set -euo pipefail

#───────────────────────────────────────────────────────────────
# BirthdayPing — Mac .app build script
#
# Usage:
#   ./build.sh              Build unsigned .app
#   ./build.sh --sign       Build + code sign + notarize
#
# Prerequisites:
#   pip3 install -r requirements.txt
#───────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
APP_NAME="BirthdayPing"
APP_PATH="$DIST_DIR/$APP_NAME.app"
DMG_PATH="$DIST_DIR/$APP_NAME.dmg"

SIGN=false
if [[ "${1:-}" == "--sign" ]]; then
    SIGN=true
fi

echo "=== BirthdayPing Build ==="
echo ""

# ── Step 1: Clean previous build ────────────────────────────
echo "[1/5] Cleaning previous build..."
rm -rf "$SCRIPT_DIR/build" "$DIST_DIR"

# ── Step 2: Run PyInstaller ─────────────────────────────────
echo "[2/5] Running PyInstaller..."
cd "$SCRIPT_DIR"
python3 -m PyInstaller birthdayping.spec --noconfirm

if [[ ! -d "$APP_PATH" ]]; then
    echo "ERROR: PyInstaller failed — $APP_PATH not found"
    exit 1
fi

echo "    ✓ Built $APP_PATH"

# ── Step 3: Code sign (optional) ────────────────────────────
if $SIGN; then
    echo "[3/5] Code signing..."

    # Set these environment variables before running with --sign:
    #   DEVELOPER_ID  - "Developer ID Application: Your Name (TEAMID)"
    #   APPLE_ID      - Your Apple ID email
    #   TEAM_ID       - Your 10-character Team ID
    #   APP_PASSWORD  - App-specific password from appleid.apple.com

    : "${DEVELOPER_ID:?Set DEVELOPER_ID env var (e.g. 'Developer ID Application: Name (TEAMID)')}"
    : "${APPLE_ID:?Set APPLE_ID env var}"
    : "${TEAM_ID:?Set TEAM_ID env var}"
    : "${APP_PASSWORD:?Set APP_PASSWORD env var}"

    # Sign all nested binaries first, then the .app itself
    find "$APP_PATH" -type f \( -name "*.dylib" -o -name "*.so" -o -perm +111 \) \
        -exec codesign --force --options runtime --sign "$DEVELOPER_ID" --timestamp {} \;

    codesign --force --deep --options runtime \
        --sign "$DEVELOPER_ID" \
        --timestamp \
        "$APP_PATH"

    echo "    ✓ Signed with $DEVELOPER_ID"

    # Verify signature
    codesign --verify --deep --strict "$APP_PATH"
    echo "    ✓ Signature verified"

    # ── Step 4: Create DMG for notarization ──────────────────
    echo "[4/5] Creating DMG..."
    hdiutil create -volname "$APP_NAME" \
        -srcfolder "$APP_PATH" \
        -ov -format UDZO \
        "$DMG_PATH"
    echo "    ✓ Created $DMG_PATH"

    # ── Step 5: Notarize ─────────────────────────────────────
    echo "[5/5] Submitting for notarization..."
    xcrun notarytool submit "$DMG_PATH" \
        --apple-id "$APPLE_ID" \
        --team-id "$TEAM_ID" \
        --password "$APP_PASSWORD" \
        --wait

    # Staple the notarization ticket
    xcrun stapler staple "$DMG_PATH"
    echo "    ✓ Notarized and stapled"

else
    echo "[3/5] Skipping code signing (run with --sign to sign)"
    echo "[4/5] Skipping DMG creation"
    echo "[5/5] Skipping notarization"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo "=== Build complete ==="
echo ""
echo "  App:  $APP_PATH"
if $SIGN; then
    echo "  DMG:  $DMG_PATH"
fi
echo ""
echo "To test: open \"$APP_PATH\""
echo ""
if ! $SIGN; then
    echo "To sign and notarize later:"
    echo "  export DEVELOPER_ID='Developer ID Application: Your Name (TEAMID)'"
    echo "  export APPLE_ID='you@example.com'"
    echo "  export TEAM_ID='XXXXXXXXXX'"
    echo "  export APP_PASSWORD='xxxx-xxxx-xxxx-xxxx'"
    echo "  ./build.sh --sign"
fi
