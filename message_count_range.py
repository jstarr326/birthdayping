#!/usr/bin/env python3
"""One-off: top 15 contacts by message count in a date range."""

import sqlite3
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

CHAT_DB = Path.home() / "Library/Messages/chat.db"
APPLE_EPOCH_OFFSET = 978307200

# Date range: 3/26/23 to 7/23/23
START = datetime(2023, 3, 26, tzinfo=timezone.utc)
END = datetime(2023, 7, 24, tzinfo=timezone.utc)  # inclusive of 7/23

def to_apple_ts(dt):
    return int((dt.timestamp() - APPLE_EPOCH_OFFSET) * 1_000_000_000)

def normalize_phone(phone):
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits

def read_contacts():
    try:
        import Contacts as CNContacts
    except ImportError:
        print("ERROR: pip3 install pyobjc-framework-Contacts", file=sys.stderr)
        sys.exit(1)

    store = CNContacts.CNContactStore.alloc().init()
    keys = [
        CNContacts.CNContactGivenNameKey,
        CNContacts.CNContactFamilyNameKey,
        CNContacts.CNContactPhoneNumbersKey,
        CNContacts.CNContactEmailAddressesKey,
    ]
    fetch_request = CNContacts.CNContactFetchRequest.alloc().initWithKeysToFetch_(keys)
    contacts = []

    def handler(contact, stop):
        first = contact.givenName() or ""
        last = contact.familyName() or ""
        name = f"{first} {last}".strip() or "Unknown"
        phones = [normalize_phone(str(p.value().stringValue())) for p in contact.phoneNumbers()]
        emails = [str(e.value()).lower() for e in contact.emailAddresses()]
        contacts.append({"name": name, "phones": phones, "emails": emails})

    store.enumerateContactsWithFetchRequest_error_usingBlock_(fetch_request, None, handler)
    return contacts

def main():
    start_ts = to_apple_ts(START)
    end_ts = to_apple_ts(END)

    conn = sqlite3.connect(f"file:{CHAT_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT
            h.id AS identifier,
            COUNT(m.ROWID) AS total_messages,
            SUM(CASE WHEN m.is_from_me = 1 THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN m.is_from_me = 0 THEN 1 ELSE 0 END) AS received
        FROM message m
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE m.date >= ? AND m.date < ?
        GROUP BY h.id
        ORDER BY total_messages DESC
    """, (start_ts, end_ts))

    handles = [dict(row) for row in cur.fetchall()]
    conn.close()

    contacts = read_contacts()
    phone_idx = {}
    email_idx = {}
    for c in contacts:
        for p in c["phones"]:
            if p:
                phone_idx[p] = c["name"]
        for e in c["emails"]:
            if e:
                email_idx[e] = c["name"]

    results = []
    for h in handles:
        ident = h["identifier"]
        if "@" in ident:
            name = email_idx.get(ident.lower(), ident)
        else:
            name = phone_idx.get(normalize_phone(ident), ident)
        results.append({"name": name, "total": h["total_messages"], "sent": h["sent"] or 0, "received": h["received"] or 0})

    # Deduplicate by name (same person, multiple handles)
    by_name = {}
    for r in results:
        if r["name"] in by_name:
            by_name[r["name"]]["total"] += r["total"]
            by_name[r["name"]]["sent"] += r["sent"]
            by_name[r["name"]]["received"] += r["received"]
        else:
            by_name[r["name"]] = dict(r)

    ranked = sorted(by_name.values(), key=lambda x: x["total"], reverse=True)

    print(f"\nTop 15 contacts by message count (3/26/23 - 7/23/23)\n")
    print(f"{'#':<4} {'Name':<30} {'Total':>7} {'Sent':>7} {'Received':>9}")
    print("-" * 60)
    for i, r in enumerate(ranked[:50], 1):
        print(f"{i:<4} {r['name']:<30} {r['total']:>7} {r['sent']:>7} {r['received']:>9}")

if __name__ == "__main__":
    main()
