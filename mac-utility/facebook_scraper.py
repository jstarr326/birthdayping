#!/usr/bin/env python3
"""
BirthdayPing — Facebook birthday scraper.

Opens a Chromium browser to Facebook's birthdays page, waits for the user
to log in, then scrapes friend names + birthday dates from all 12 months.

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

BIRTHDAYS_URL = "https://www.facebook.com/events/birthdays/"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "facebook-birthdays.csv"

# Month names Facebook uses in its birthday cards / section headers
MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def wait_for_login(page, timeout_minutes=5):
    """Poll until we detect the user is logged in and on the birthdays page."""
    print("Waiting for you to log into Facebook...")
    print(f"(timeout: {timeout_minutes} minutes)\n")

    deadline = time.time() + timeout_minutes * 60
    while time.time() < deadline:
        url = page.url
        # If redirected to login, wait for navigation back
        if "/login" in url or "/checkpoint" in url:
            time.sleep(2)
            continue

        # Check if birthday content is present
        try:
            page.wait_for_selector(
                "[data-pagelet], [role='main']",
                timeout=3000,
            )
            # Verify we're on the birthdays page with actual content
            content = page.content()
            if any(m in content for m in ["birthday", "Birthday", "BIRTHDAY"]):
                print("Logged in — birthday page detected.\n")
                return True
        except PwTimeout:
            pass

        time.sleep(2)

    print("ERROR: Timed out waiting for login.", file=sys.stderr)
    return False


def extract_birthdays_from_page(page):
    """
    Extract birthday entries visible on the current page.

    Facebook's birthdays page shows cards grouped by time period
    (Today, Recent, Upcoming, and by month). Each card typically has:
    - A link to the friend's profile
    - The friend's name
    - Birthday text like "January 15" or "Turns 30 on January 15"

    Returns list of dicts: {name, month, day, year, profile_url}
    """
    birthdays = []

    # Strategy 1: Look for birthday card links with aria-labels or text content.
    # Facebook renders birthday entries as links/divs with the person's name
    # and a date string somewhere nearby.
    entries = page.evaluate("""() => {
        const results = [];
        const seen = new Set();

        // Look for all links that point to a Facebook profile
        const links = document.querySelectorAll('a[href*="facebook.com/"], a[href^="/"]');
        for (const link of links) {
            const href = link.href || link.getAttribute('href') || '';

            // Skip non-profile links
            if (href.includes('/events/') || href.includes('/groups/') ||
                href.includes('/pages/') || href.includes('/settings') ||
                href.includes('/login') || href.includes('/help') ||
                href.includes('#') || href === '/' || href === '') continue;

            // Get the name from the link text
            const name = (link.textContent || '').trim();
            if (!name || name.length < 2 || name.length > 80) continue;
            if (seen.has(name)) continue;

            // Look at the parent container for date text
            const container = link.closest('[class]')?.parentElement?.parentElement
                || link.parentElement?.parentElement;
            if (!container) continue;
            const containerText = container.textContent || '';

            // Try to find a date pattern in nearby text
            results.push({
                name: name,
                context: containerText.substring(0, 500),
                href: href,
            });
            seen.add(name);
        }
        return results;
    }""")

    # Strategy 2: Extract structured birthday data from section headers + cards
    section_data = page.evaluate("""() => {
        const results = [];
        // Facebook often uses heading elements or bold text for month sections
        const allText = document.body.innerText;
        return allText;
    }""")

    # Parse the raw page text for birthday patterns
    text_birthdays = parse_birthday_text(section_data)

    # Merge link-based entries with text-based entries
    name_to_profile = {}
    for entry in entries:
        name_to_profile[entry["name"]] = entry["href"]

    # Use text-parsed birthdays as primary (they have dates)
    for bday in text_birthdays:
        if bday["name"] in name_to_profile:
            bday["profile_url"] = name_to_profile[bday["name"]]
        birthdays.append(bday)

    return birthdays


def parse_birthday_text(page_text):
    """
    Parse birthday entries from the raw text content of the page.

    Facebook birthdays page typically shows entries like:
        "John Smith\nJanuary 15"
        "Jane Doe\nTurns 30 on February 3"

    Or under month headers:
        "January Birthdays\nJohn Smith\nJane Doe\n..."

    Also handles the common format where the page text has sections like:
        "Today's Birthdays\nAlice Johnson\nBob Williams\n
         Upcoming Birthdays\nCarol Davis - January 20\n..."
    """
    results = []
    seen = set()
    lines = page_text.split("\n")

    current_month = None
    current_day = None

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        # Check if this line is a month header like "January Birthdays" or just "January"
        month_match = re.match(
            r"^(" + "|".join(MONTHS) + r")(?:\s+Birthdays?)?$", line, re.IGNORECASE
        )
        if month_match:
            current_month = MONTHS.index(month_match.group(1).title()) + 1
            current_day = None
            continue

        # Check for "Name - Month Day" or "Name · Month Day" pattern
        dash_match = re.match(
            r"^(.+?)(?:\s*[-·–—]\s*|\s+)("
            + "|".join(MONTHS)
            + r")\s+(\d{1,2})(?:\s|$)",
            line,
            re.IGNORECASE,
        )
        if dash_match:
            name = dash_match.group(1).strip()
            month = MONTHS.index(dash_match.group(2).title()) + 1
            day = int(dash_match.group(3))
            skip_words = ["birthday", "upcoming", "recent", "today", "this week", "turns ", "write on"]
            if (name and name not in seen and 2 <= len(name) <= 80
                    and not any(w in name.lower() for w in skip_words)):
                results.append({
                    "name": name,
                    "month": month,
                    "day": day,
                    "year": "",
                    "profile_url": "",
                })
                seen.add(name)
            continue

        # Check for "Turns N on Month Day" in the next line after a name
        if i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            turns_match = re.match(
                r"(?:Turns\s+\d+\s+on\s+)?("
                + "|".join(MONTHS)
                + r")\s+(\d{1,2})",
                next_line,
                re.IGNORECASE,
            )
            if turns_match and 2 <= len(line) <= 80 and not any(
                c in line.lower() for c in [
                    "birthday", "upcoming", "recent", "today", "this week",
                    "turns ", "write on",
                ]
            ):
                month = MONTHS.index(turns_match.group(1).title()) + 1
                day = int(turns_match.group(2))
                name = line
                if name not in seen:
                    results.append({
                        "name": name,
                        "month": month,
                        "day": day,
                        "year": "",
                        "profile_url": "",
                    })
                    seen.add(name)
                continue

        # Check for standalone "Month Day" line — applies to the previous name
        date_match = re.match(
            r"^(" + "|".join(MONTHS) + r")\s+(\d{1,2})$", line, re.IGNORECASE
        )
        if date_match:
            current_month = MONTHS.index(date_match.group(1).title()) + 1
            current_day = int(date_match.group(2))
            # Look backwards for a name
            for j in range(i - 1, max(i - 3, -1), -1):
                prev = lines[j].strip()
                if prev and 2 <= len(prev) <= 80 and prev not in seen and not any(
                    c in prev.lower()
                    for c in ["birthday", "upcoming", "recent", "today", "this week", "write on"]
                ):
                    results.append({
                        "name": prev,
                        "month": current_month,
                        "day": current_day,
                        "year": "",
                        "profile_url": "",
                    })
                    seen.add(prev)
                    break
            continue

    return results


def navigate_months(page):
    """
    Navigate through all 12 months on the Facebook birthdays page.
    Facebook sometimes has a month picker or shows upcoming months inline.
    We scroll through the page and click month links if available.

    Returns all collected birthdays across all visible months.
    """
    all_birthdays = []
    seen_names = set()

    # First, try to scroll down to load all content
    print("Scrolling to load all birthday content...")
    last_height = 0
    for _ in range(30):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)
        new_height = page.evaluate("document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height

    # Scroll back to top
    page.evaluate("window.scrollTo(0, 0)")
    time.sleep(1)

    # Try clicking month navigation links if they exist
    month_links = page.evaluate("""() => {
        const links = [];
        const allLinks = document.querySelectorAll('a');
        const months = ['january','february','march','april','may','june',
                       'july','august','september','october','november','december'];
        for (const a of allLinks) {
            const text = (a.textContent || '').trim().toLowerCase();
            if (months.includes(text)) {
                links.push({text: a.textContent.trim(), selector: a.getAttribute('href') || ''});
            }
        }
        return links;
    }""")

    if month_links:
        print(f"Found {len(month_links)} month navigation links.")
        for ml in month_links:
            print(f"  Navigating to {ml['text']}...")
            try:
                page.click(f"a:text-is('{ml['text']}')", timeout=5000)
                time.sleep(2)
                # Scroll to load this month's content
                for _ in range(5):
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    time.sleep(0.5)
                page.evaluate("window.scrollTo(0, 0)")
                time.sleep(0.5)
            except Exception:
                pass
    else:
        print("No month navigation found — extracting from full page.")

    # Extract all birthdays from the fully-loaded page
    birthdays = extract_birthdays_from_page(page)
    for b in birthdays:
        if b["name"] not in seen_names:
            all_birthdays.append(b)
            seen_names.add(b["name"])

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
    args = parser.parse_args()

    print("=" * 50)
    print("BirthdayPing — Facebook Birthday Scraper")
    print("=" * 50)
    print()
    print("A Chromium window will open to Facebook's birthdays page.")
    print("Log into your Facebook account in that window.")
    print("We NEVER see or store your credentials.")
    print()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            page.goto(BIRTHDAYS_URL, wait_until="domcontentloaded", timeout=30000)
        except PwTimeout:
            print("ERROR: Timed out loading Facebook. Check your internet connection.",
                  file=sys.stderr)
            browser.close()
            sys.exit(1)

        if not wait_for_login(page, timeout_minutes=args.timeout):
            browser.close()
            sys.exit(1)

        # Give the page a moment to fully render after login
        time.sleep(3)

        print("Scraping birthdays...")
        try:
            birthdays = navigate_months(page)
        except Exception as e:
            print(
                f"\nERROR: Failed to scrape birthdays. Facebook may have changed their layout.\n"
                f"Details: {e}\n\n"
                f"Try the Chrome extension fallback instead:\n"
                f"  1. Install 'Birthday Calendar Exporter' from the Chrome Web Store\n"
                f"  2. Export a .csv file\n"
                f"  3. Upload it at birthdayping.vercel.app/dashboard",
                file=sys.stderr,
            )
            browser.close()
            sys.exit(1)

        browser.close()

    if not birthdays:
        print(
            "\nNo birthdays found. This could mean:\n"
            "  - Facebook changed their page layout (try the Chrome extension instead)\n"
            "  - Your Facebook account has no friends with visible birthdays\n"
            "  - The page didn't fully load\n\n"
            "Fallback: Install 'Birthday Calendar Exporter' Chrome extension,\n"
            "export a .csv, and upload it at birthdayping.vercel.app/dashboard",
            file=sys.stderr,
        )
        sys.exit(1)

    write_csv(birthdays, args.output)

    print()
    print(f"Scraped {len(birthdays)} birthdays.")
    print(f"File saved to {args.output}")
    print()
    print(f"Upload this file at birthdayping.vercel.app/dashboard")


if __name__ == "__main__":
    main()
