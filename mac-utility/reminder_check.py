#!/usr/bin/env python3
"""
BirthdayPing reminder checker.

Polls the server for today's birthday reminders, then sends each one
as an iMessage to YOU via osascript. Run daily via launchd.

Usage:
    python3 reminder_check.py

Environment (or edit the constants below):
    BIRTHDAYPING_URL    - Server URL (default: http://localhost:3000)
    BIRTHDAYPING_KEY    - API key (SYNC_API_KEY on the server)
    BIRTHDAYPING_EMAIL  - Your account email
    BIRTHDAYPING_PHONE  - Your phone number (iMessage sends reminders here)
"""

import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────
API_URL = os.environ.get("BIRTHDAYPING_URL", "http://localhost:3000")
API_KEY = os.environ.get("BIRTHDAYPING_KEY", "dev-sync-key-change-me")
USER_EMAIL = os.environ.get("BIRTHDAYPING_EMAIL", "jstarrtaylor@gmail.com")
MY_PHONE = os.environ.get("BIRTHDAYPING_PHONE", "+1XXXXXXXXXX")  # ← set your number

LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / f"reminders-{datetime.now().strftime('%Y-%m-%d')}.log"


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def fetch_reminders() -> list[dict]:
    req = urllib.request.Request(
        f"{API_URL}/api/reminders/today",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "X-User-Email": USER_EMAIL,
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
    return data.get("reminders", [])


def send_imessage(phone: str, message: str) -> bool:
    """Send an iMessage via osascript. Returns True on success."""
    # Escape double quotes and backslashes for AppleScript string
    escaped = message.replace("\\", "\\\\").replace('"', '\\"')
    script = f'tell application "Messages" to send "{escaped}" to buddy "{phone}"'
    try:
        subprocess.run(
            ["osascript", "-e", script],
            check=True,
            capture_output=True,
            timeout=30,
        )
        return True
    except subprocess.CalledProcessError as e:
        log(f"  osascript error: {e.stderr.decode().strip()}")
        return False
    except subprocess.TimeoutExpired:
        log("  osascript timed out")
        return False


def main():
    log(f"Checking reminders for {USER_EMAIL}...")

    try:
        reminders = fetch_reminders()
    except Exception as e:
        log(f"Failed to fetch reminders: {e}")
        sys.exit(1)

    if not reminders:
        log("No birthdays today.")
        return

    log(f"{len(reminders)} birthday(s) today:")

    sent = 0
    for r in reminders:
        name = r["name"]
        message = r["message"]
        log(f"  → {name}: {message}")

        if MY_PHONE == "+1XXXXXXXXXX":
            log("  [DRY RUN] Set BIRTHDAYPING_PHONE to actually send")
            continue

        if send_imessage(MY_PHONE, message):
            log(f"  ✓ Sent to {MY_PHONE}")
            sent += 1
        else:
            log(f"  ✗ Failed to send to {MY_PHONE}")

    log(f"Done: {sent}/{len(reminders)} reminders sent.")


if __name__ == "__main__":
    main()
