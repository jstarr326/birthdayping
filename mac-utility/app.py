#!/usr/bin/env python3
"""
BirthdayPing — macOS menu bar app.

Sits in the menu bar and provides quick access to:
- Run Contact Scan (core engine + sync)
- Check Reminders
- Open web dashboard
- Install/uninstall login item
"""

import os
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path

import rumps

# Ensure the app is recognized as a foreground GUI app by macOS.
# PyInstaller + LSUIElement apps sometimes need an explicit NSApplication push.
try:
    from AppKit import NSApplication, NSApplicationActivationPolicyAccessory
    NSApplication.sharedApplication().setActivationPolicy_(
        NSApplicationActivationPolicyAccessory
    )
except Exception:
    pass

# When bundled by PyInstaller, resources live next to the executable inside the .app.
# sys._MEIPASS is set by PyInstaller at runtime.
if getattr(sys, "frozen", False):
    BUNDLE_DIR = Path(sys._MEIPASS)
else:
    BUNDLE_DIR = Path(__file__).resolve().parent

CORE_ENGINE = BUNDLE_DIR / "core_engine.py"
SYNC_SCRIPT = BUNDLE_DIR / "sync.py"
REMINDER_SCRIPT = BUNDLE_DIR / "reminder_check.py"
FB_SCRAPER = BUNDLE_DIR / "facebook_scraper.py"

DASHBOARD_URL = "https://birthdayping.vercel.app/dashboard"
PLIST_NAME = "com.birthdayping.app"
PLIST_PATH = Path.home() / "Library/LaunchAgents" / f"{PLIST_NAME}.plist"


def _app_executable() -> str:
    """Return the path to the .app binary (or this script if running unbundled)."""
    if getattr(sys, "frozen", False):
        # sys.executable points to .app/Contents/MacOS/BirthdayPing
        return sys.executable
    return f"/usr/bin/python3 {__file__}"


class BirthdayPingApp(rumps.App):
    def __init__(self):
        super().__init__(
            name="BirthdayPing",
            title="\U0001F382",  # 🎂
            quit_button=None,  # we add our own
        )
        self.menu = [
            rumps.MenuItem("Run Contact Scan", callback=self.run_scan),
            rumps.MenuItem("Check Reminders", callback=self.check_reminders),
            rumps.MenuItem("Scrape Facebook Birthdays", callback=self.scrape_facebook),
            rumps.separator,
            rumps.MenuItem("Open Dashboard", callback=self.open_dashboard),
            rumps.separator,
            self._login_item_menu_item(),
            rumps.separator,
            rumps.MenuItem("Quit BirthdayPing", callback=self.quit_app),
        ]

    # ── Login item toggle ────────────────────────────────────────

    def _login_item_menu_item(self) -> rumps.MenuItem:
        installed = PLIST_PATH.exists()
        title = "Disable Start at Login" if installed else "Start at Login"
        return rumps.MenuItem(title, callback=self.toggle_login_item)

    def toggle_login_item(self, sender):
        if PLIST_PATH.exists():
            self._uninstall_login_item()
            sender.title = "Start at Login"
            rumps.notification(
                "BirthdayPing",
                "Login item removed",
                "BirthdayPing will no longer start automatically.",
            )
        else:
            self._install_login_item()
            sender.title = "Disable Start at Login"
            rumps.notification(
                "BirthdayPing",
                "Login item installed",
                "BirthdayPing will start when you log in.",
            )

    def _install_login_item(self):
        exe = _app_executable()
        plist = f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{exe}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
"""
        PLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
        PLIST_PATH.write_text(plist)
        subprocess.run(["launchctl", "load", str(PLIST_PATH)], capture_output=True)

    def _uninstall_login_item(self):
        if PLIST_PATH.exists():
            subprocess.run(
                ["launchctl", "unload", str(PLIST_PATH)], capture_output=True
            )
            PLIST_PATH.unlink(missing_ok=True)

    # ── Actions ──────────────────────────────────────────────────

    def run_scan(self, _):
        """Run core engine then sync in a background thread."""
        self.title = "🎂⏳"
        threading.Thread(target=self._do_scan, daemon=True).start()

    def _do_scan(self):
        try:
            rumps.notification("BirthdayPing", "Scanning contacts...", "This may take a moment.")

            # Run core engine
            result = subprocess.run(
                [sys.executable, str(CORE_ENGINE)] if getattr(sys, "frozen", False)
                else ["/usr/bin/python3", str(CORE_ENGINE)],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                rumps.notification(
                    "BirthdayPing", "Scan failed", result.stderr[:200] or "Unknown error"
                )
                return

            # Run sync
            result = subprocess.run(
                [sys.executable, str(SYNC_SCRIPT)] if getattr(sys, "frozen", False)
                else ["/usr/bin/python3", str(SYNC_SCRIPT)],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                rumps.notification(
                    "BirthdayPing", "Sync failed", result.stderr[:200] or "Unknown error"
                )
                return

            output = result.stdout.strip()
            rumps.notification("BirthdayPing", "Scan complete", output or "Contacts synced.")

        except subprocess.TimeoutExpired:
            rumps.notification("BirthdayPing", "Scan timed out", "Try again later.")
        except Exception as e:
            rumps.notification("BirthdayPing", "Error", str(e)[:200])
        finally:
            self.title = "🎂"

    def check_reminders(self, _):
        """Run reminder check in a background thread."""
        self.title = "🎂⏳"
        threading.Thread(target=self._do_check_reminders, daemon=True).start()

    def _do_check_reminders(self):
        try:
            result = subprocess.run(
                [sys.executable, str(REMINDER_SCRIPT)] if getattr(sys, "frozen", False)
                else ["/usr/bin/python3", str(REMINDER_SCRIPT)],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                rumps.notification(
                    "BirthdayPing", "Reminder check failed",
                    result.stderr[:200] or "Unknown error",
                )
                return

            output = result.stdout.strip().split("\n")[-1]
            rumps.notification("BirthdayPing", "Reminders", output or "No birthdays today.")

        except subprocess.TimeoutExpired:
            rumps.notification("BirthdayPing", "Timed out", "Try again later.")
        except Exception as e:
            rumps.notification("BirthdayPing", "Error", str(e)[:200])
        finally:
            self.title = "🎂"

    def scrape_facebook(self, _):
        """Launch the Facebook birthday scraper in a background thread."""
        self.title = "\U0001F382\u23F3"
        threading.Thread(target=self._do_scrape_facebook, daemon=True).start()

    def _do_scrape_facebook(self):
        try:
            rumps.notification(
                "BirthdayPing",
                "Facebook Scraper",
                "Opening browser — log into Facebook when prompted.",
            )
            csv_path = Path.home() / ".birthdayping" / "facebook-birthdays.csv"
            result = subprocess.run(
                [sys.executable, str(FB_SCRAPER), "--output", str(csv_path)]
                if getattr(sys, "frozen", False)
                else ["/usr/bin/python3", str(FB_SCRAPER), "--output", str(csv_path)],
                capture_output=True,
                text=True,
                timeout=600,  # 10 min — user needs time to log in
            )
            if result.returncode != 0:
                error_msg = result.stderr.strip().split("\n")[-1] if result.stderr else "Unknown error"
                rumps.notification(
                    "BirthdayPing", "Scrape failed", error_msg[:200]
                )
                return

            # Count birthdays from output
            import re as _re
            count_match = _re.search(r"Saved (\d+) birthdays", result.stdout)
            count = count_match.group(1) if count_match else "?"

            rumps.notification(
                "BirthdayPing",
                "Facebook Scraper",
                f"Found {count} birthdays! Opening dashboard to import...",
            )

            # Auto-open the dashboard with import flag
            webbrowser.open(f"{DASHBOARD_URL}?import=facebook")

        except subprocess.TimeoutExpired:
            rumps.notification("BirthdayPing", "Scrape timed out", "Try again.")
        except Exception as e:
            rumps.notification("BirthdayPing", "Error", str(e)[:200])
        finally:
            self.title = "\U0001F382"

    def open_dashboard(self, _):
        webbrowser.open(DASHBOARD_URL)

    def quit_app(self, _):
        rumps.quit_application()


if __name__ == "__main__":
    BirthdayPingApp().run()
