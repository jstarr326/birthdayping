#!/usr/bin/env python3
"""
BirthdayPing — Facebook birthday scraper.

Opens Chromium to Facebook so you can log in (session is saved for future
runs), then uses Facebook's internal GraphQL API to fetch ALL friends'
birthdays across all 12 months in a single run.

Outputs a CSV compatible with BirthdayPing's import:
    Name, Year, Month, Day, Link to Profile

Usage:
    python3 facebook_scraper.py
    python3 facebook_scraper.py --output ~/Desktop/birthdays.csv

Prerequisites:
    pip install playwright
    python -m playwright install chromium
"""

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout
except ImportError:
    print(
        "ERROR: playwright is not installed.\n"
        "Run:\n"
        "  pip3 install playwright\n"
        "  python3 -m playwright install chromium",
        file=sys.stderr,
    )
    sys.exit(1)

BIRTHDAYS_URL = "https://www.facebook.com/birthdays"
GRAPHQL_URL = "https://www.facebook.com/api/graphql/"
# Facebook's internal GraphQL query ID for birthday data
BIRTHDAY_DOC_ID = "3681233908586032"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "facebook-birthdays.csv"

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def get_birthdayping_profile_dir():
    """Return a dedicated BirthdayPing Chrome profile directory."""
    home = Path.home()
    profile_dir = home / ".birthdayping" / "chrome-profile"
    profile_dir.mkdir(parents=True, exist_ok=True)
    return str(profile_dir)


def show_status(page, message, color="#1877f2"):
    """Show a floating status banner in the browser window."""
    safe_msg = message.replace("'", "\\'").replace('"', '\\"')
    page.evaluate(f"""() => {{
        let banner = document.getElementById('bp-status');
        if (!banner) {{
            banner = document.createElement('div');
            banner.id = 'bp-status';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;' +
                'padding:12px 20px;font:16px/1.4 -apple-system,sans-serif;text-align:center;' +
                'color:white;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
            document.body.appendChild(banner);
        }}
        banner.style.background = '{color}';
        banner.textContent = '{safe_msg}';
    }}""")


def dismiss_cookie_dialog(page):
    """Try to dismiss Facebook cookie consent / login overlays."""
    for selector in [
        '[data-cookiebanner="accept_button"]',
        'button:has-text("Accept All")',
        'button:has-text("Allow all cookies")',
        'button:has-text("Accept all")',
        '[aria-label="Close"]',
    ]:
        try:
            btn = page.locator(selector).first
            if btn.is_visible(timeout=500):
                btn.click()
                print("  Dismissed overlay dialog.")
                time.sleep(1)
                return True
        except Exception:
            continue
    return False


def ensure_logged_in(page, timeout_minutes=5):
    """Navigate to Facebook and ensure the user is logged in."""
    deadline = time.time() + timeout_minutes * 60

    print(f"Navigating to {BIRTHDAYS_URL}...")
    try:
        page.goto(BIRTHDAYS_URL, wait_until="domcontentloaded", timeout=30000)
    except PwTimeout:
        print("ERROR: Timed out loading Facebook.", file=sys.stderr)
        return False

    # Check if login is needed
    url = page.url
    if "/login" in url or "/checkpoint" in url:
        print("You need to log into Facebook (first-time setup).")
        print("Your session will be saved for future runs.\n")
        show_status(page, "Please log into Facebook below")

        while time.time() < deadline:
            time.sleep(2)
            url = page.url
            if "/login" not in url and "/checkpoint" not in url:
                print("Login detected!")
                break
        else:
            print("ERROR: Timed out waiting for login.", file=sys.stderr)
            return False

        dismiss_cookie_dialog(page)
        print(f"Navigating to {BIRTHDAYS_URL}...")
        page.goto(BIRTHDAYS_URL, wait_until="domcontentloaded", timeout=30000)

        if "/login" in page.url:
            print("ERROR: Still not logged in after login attempt.", file=sys.stderr)
            return False

    dismiss_cookie_dialog(page)

    # Wait briefly for page to settle
    time.sleep(2)
    print("Logged into Facebook.\n")
    return True


def extract_csrf_token(page):
    """Extract Facebook's fb_dtsg CSRF token from the page."""
    print("Extracting CSRF token...")

    token = page.evaluate("""() => {
        // Method 1: Look for the token in a hidden input
        const input = document.querySelector('input[name="fb_dtsg"]');
        if (input) return input.value;

        // Method 2: Search the page source for the token pattern
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const text = script.textContent || '';
            // Pattern: "DTSGInitialData",[],{"token":"..."}
            const match = text.match(/"token":"([^"]+)"/);
            if (match) return match[1];
        }

        // Method 3: Look in require calls
        for (const script of scripts) {
            const text = script.textContent || '';
            const match = text.match(/fb_dtsg.*?"token":"([^"]+)"/);
            if (match) return match[1];
        }

        return null;
    }""")

    if not token:
        # Fallback: fetch the page HTML and search for the token
        html = page.content()
        match = re.search(r'"token":"([^"]+)"', html)
        if match:
            token = match.group(1)

    if token:
        print(f"  Got CSRF token ({token[:10]}...)")
    else:
        print("  WARNING: Could not find CSRF token.")

    return token


def fetch_birthdays_graphql(page, token):
    """
    Fetch all friends' birthdays using Facebook's internal GraphQL API.

    Uses the BirthdayCometMonthlyBirthdaysRefetchQuery with cursor-based
    pagination to fetch 2 months at a time across all 12 months.
    """
    all_birthdays = []
    seen = set()

    # Cursor offsets: -1, 0, 2, 4, 6, 8, 10
    # Each request with count=2 returns 2 months of data
    # -1 starts from the previous month, covering all 12+ months
    offsets = [-1, 0, 2, 4, 6, 8, 10]

    for idx, offset in enumerate(offsets):
        month_range = f"months {offset + 1}-{offset + 2}" if offset >= 0 else "current month"
        print(f"  Fetching {month_range} ({idx + 1}/{len(offsets)})...")
        show_status(page, f"Fetching birthdays... ({idx + 1}/{len(offsets)})")

        variables = json.dumps({"count": 2, "cursor": str(offset)})

        try:
            result = page.evaluate(f"""async () => {{
                const params = new URLSearchParams();
                params.append('__a', '1');
                params.append('fb_dtsg', '{token}');
                params.append('fb_api_caller_class', 'RelayModern');
                params.append('fb_api_req_friendly_name', 'BirthdayCometMonthlyBirthdaysRefetchQuery');
                params.append('variables', '{variables}');
                params.append('server_timestamps', 'true');
                params.append('doc_id', '{BIRTHDAY_DOC_ID}');

                const resp = await fetch('{GRAPHQL_URL}', {{
                    method: 'POST',
                    headers: {{
                        'Content-Type': 'application/x-www-form-urlencoded',
                    }},
                    body: params.toString(),
                    credentials: 'include',
                }});

                const text = await resp.text();
                // Facebook prefixes responses with "for (;;);" to prevent JSONP hijacking
                const cleaned = text.replace(/^for \\(;;\\);/, '');
                return JSON.parse(cleaned);
            }}""")
        except Exception as e:
            print(f"    WARNING: Request failed for offset {offset}: {e}")
            continue

        if not result:
            print(f"    WARNING: Empty response for offset {offset}")
            continue

        # Parse the GraphQL response
        try:
            edges = (result.get("data", {})
                     .get("viewer", {})
                     .get("all_friends_by_birthday_month", {})
                     .get("edges", []))
        except (AttributeError, TypeError):
            print(f"    WARNING: Unexpected response structure for offset {offset}")
            if isinstance(result, dict) and "errors" in result:
                for err in result["errors"]:
                    print(f"      Error: {err.get('message', err)}")
            continue

        month_count = 0
        for month_edge in edges:
            month_node = month_edge.get("node", {})
            month_num = month_node.get("month", 0)
            friends_edges = month_node.get("friends", {}).get("edges", [])

            if month_num > 0:
                month_name = MONTHS[month_num - 1]
            else:
                month_name = f"month-{month_num}"

            for friend_edge in friends_edges:
                friend = friend_edge.get("node", {})
                name = friend.get("name", "")
                friend_id = friend.get("id", "")
                birthdate = friend.get("birthdate", {})

                if not name or name in seen:
                    continue

                day = birthdate.get("day")
                month = birthdate.get("month")
                year = birthdate.get("year")

                if not day or not month:
                    continue

                profile_url = f"https://www.facebook.com/{friend_id}" if friend_id else ""

                all_birthdays.append({
                    "name": name,
                    "month": month,
                    "day": day,
                    "year": year if year else "",
                    "profile_url": profile_url,
                })
                seen.add(name)
                month_count += 1

        print(f"    Got {month_count} birthdays.")

    return all_birthdays


def write_csv(birthdays, output_path):
    """Write birthdays to CSV in the format our import expects."""
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Name", "Year", "Month", "Day", "Link to Profile"])
        for b in sorted(birthdays, key=lambda x: (x["month"], x["day"])):
            writer.writerow([
                b["name"],
                b.get("year", ""),
                b["month"],
                b["day"],
                b.get("profile_url", ""),
            ])


def main():
    parser = argparse.ArgumentParser(
        description="Scrape Facebook birthdays into a CSV for BirthdayPing."
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output CSV path (default: {DEFAULT_OUTPUT})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=5,
        help="Minutes to wait for login (default: 5)",
    )
    parser.add_argument(
        "--profile-dir",
        type=str,
        default=None,
        help="Chromium profile directory (default: ~/.birthdayping/chrome-profile)",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Save raw API responses for debugging",
    )
    args = parser.parse_args()

    user_data_dir = args.profile_dir or get_birthdayping_profile_dir()

    print("=" * 50)
    print("BirthdayPing — Facebook Birthday Scraper")
    print("=" * 50)
    print()
    print(f"Using profile: {user_data_dir}")
    print()

    with sync_playwright() as pw:
        print("Launching browser...")
        try:
            context = pw.chromium.launch_persistent_context(
                user_data_dir,
                headless=False,
                args=["--disable-blink-features=AutomationControlled"],
                viewport={"width": 1280, "height": 900},
            )
        except Exception as e:
            print(f"ERROR: Failed to launch browser: {e}", file=sys.stderr)
            sys.exit(1)

        page = context.pages[0] if context.pages else context.new_page()

        if not ensure_logged_in(page, timeout_minutes=args.timeout):
            context.close()
            sys.exit(1)

        # Extract the CSRF token needed for GraphQL requests
        token = extract_csrf_token(page)
        if not token:
            print("ERROR: Could not extract CSRF token. Facebook may have changed their page.",
                  file=sys.stderr)
            context.close()
            sys.exit(1)

        # Fetch all birthdays via GraphQL API
        print("\nFetching birthdays for all 12 months...")
        show_status(page, "Fetching all birthdays via API...")
        try:
            birthdays = fetch_birthdays_graphql(page, token)
        except Exception as e:
            print(f"\nERROR: Failed to fetch birthdays: {e}", file=sys.stderr)
            if args.debug:
                import traceback
                traceback.print_exc()
            context.close()
            sys.exit(1)

        show_status(page, f"Done! Found {len(birthdays)} birthdays. You can close this window.", "#2e7d32")
        print(f"\nTotal: {len(birthdays)} birthdays found across all months.")

        # Brief pause so user can see the success message
        time.sleep(3)
        print("Closing browser...")
        context.close()

    if not birthdays:
        print(
            "\nNo birthdays found. This could mean:\n"
            "  - Facebook changed their internal API\n"
            "  - Your account has no friends with visible birthdays\n"
            "  - The CSRF token was invalid\n\n"
            "Fallback: Install 'Birthday Calendar Exporter' Chrome extension,\n"
            "export a .csv, and upload it at birthdayping.vercel.app/dashboard",
            file=sys.stderr,
        )
        sys.exit(1)

    write_csv(birthdays, args.output)

    print()
    print(f"Saved {len(birthdays)} birthdays to {args.output}")


if __name__ == "__main__":
    main()
