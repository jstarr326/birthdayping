# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for BirthdayPing.app

Usage:
    cd mac-utility
    pyinstaller birthdayping.spec

Output:
    dist/BirthdayPing.app
"""

import os

block_cipher = None
spec_dir = os.path.dirname(os.path.abspath(SPEC))
project_root = os.path.dirname(spec_dir)

a = Analysis(
    [os.path.join(spec_dir, "app.py")],
    pathex=[spec_dir],
    binaries=[],
    datas=[
        # Bundle the Python scripts that the menu bar app shells out to.
        # They run as subprocesses so they stay as .py files, not compiled in.
        (os.path.join(project_root, "core_engine.py"), "."),
        (os.path.join(spec_dir, "reminder_check.py"), "."),
        (os.path.join(project_root, "scripts", "sync.py"), "."),
    ],
    hiddenimports=[
        "rumps",
        "Contacts",
        "objc",
        "Foundation",
        "AppKit",
        "CoreFoundation",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Trim unnecessary weight
        "tkinter",
        "unittest",
        "pydoc",
    ],
    noarchive=False,
    optimize=0,
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="BirthdayPing",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # No terminal window — menu bar only
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,  # Universal binary (or set 'arm64' / 'x86_64')
    codesign_identity=None,  # Filled in by build.sh when signing
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="BirthdayPing",
)

app = BUNDLE(
    coll,
    name="BirthdayPing.app",
    icon=os.path.join(spec_dir, "icon.icns") if os.path.exists(os.path.join(spec_dir, "icon.icns")) else None,
    bundle_identifier="com.birthdayping.app",
    info_plist={
        "CFBundleName": "BirthdayPing",
        "CFBundleDisplayName": "BirthdayPing",
        "CFBundleShortVersionString": "1.0.0",
        "CFBundleVersion": "1",
        "LSMinimumSystemVersion": "12.0",
        "LSUIElement": True,  # Menu bar app — no Dock icon
        "NSHumanReadableCopyright": "Copyright © 2025 BirthdayPing",
        "NSContactsUsageDescription": "BirthdayPing reads your contacts to find birthdays for people you text.",
        "NSAppleEventsUsageDescription": "BirthdayPing uses AppleScript to send iMessage reminders.",
    },
)
