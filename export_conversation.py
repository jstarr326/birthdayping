#!/usr/bin/env python3
"""Export iMessage conversations for specific contacts within a date range."""

import sqlite3
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

CHAT_DB = Path.home() / "Library/Messages/chat.db"
APPLE_EPOCH_OFFSET = 978307200

def to_apple_ts(dt):
    return int((dt.timestamp() - APPLE_EPOCH_OFFSET) * 1_000_000_000)

def apple_ts_to_datetime(ts):
    if not ts:
        return None
    unix_ts = ts / 1_000_000_000 + APPLE_EPOCH_OFFSET
    return datetime.fromtimestamp(unix_ts, tz=timezone.utc)

def normalize_phone(phone):
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits

def get_contact_identifiers(name):
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
    identifiers = []

    target = name.lower()

    def handler(contact, stop):
        first = contact.givenName() or ""
        last = contact.familyName() or ""
        full = f"{first} {last}".strip().lower()
        if full == target:
            for p in contact.phoneNumbers():
                identifiers.append(normalize_phone(str(p.value().stringValue())))
            for e in contact.emailAddresses():
                identifiers.append(str(e.value()).lower())

    store.enumerateContactsWithFetchRequest_error_usingBlock_(fetch_request, None, handler)
    return identifiers

def extract_text_from_attributed_body(blob):
    """Extract plain text from the NSAttributedString binary blob."""
    if not blob:
        return None
    try:
        blob_bytes = bytes(blob)
        # The text is stored after "NSString" marker followed by the content
        # Try to find the text between known markers
        text = blob_bytes.decode("utf-8", errors="ignore")
        # Look for the pattern: NSString...then the actual text before NSDictionary
        # Common pattern: text appears after '+' byte and before next control sequence
        import re as _re
        # Method 1: extract between streamtyped markers
        match = _re.search(r"NSString.{1,20}?(.+?)(?:NSDictionary|NSMutableDictionary|\x86\x84)", text, _re.DOTALL)
        if match:
            extracted = match.group(1).strip()
            # Clean control characters
            extracted = "".join(c for c in extracted if c.isprintable() or c in "\n\t")
            if extracted:
                return extracted.strip()
        # Method 2: simpler heuristic - find readable text chunk
        parts = _re.split(r"[\x00-\x08\x0b\x0c\x0e-\x1f]+", text)
        longest = max(parts, key=len) if parts else ""
        if len(longest) > 1:
            return longest.strip()
    except Exception:
        pass
    return None

def export_messages(name, start, end, output_path):
    identifiers = get_contact_identifiers(name)
    if not identifiers:
        print(f"  No contact found for '{name}'")
        return

    start_ts = to_apple_ts(start)
    end_ts = to_apple_ts(end)

    conn = sqlite3.connect(f"file:{CHAT_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Build query for all identifiers (phone numbers and emails)
    placeholders = ",".join("?" for _ in identifiers)
    # Also match with +1 prefix for phones
    all_ids = list(identifiers)
    for i in identifiers:
        if len(i) == 10 and i.isdigit():
            all_ids.append(f"+1{i}")
    placeholders = ",".join("?" for _ in all_ids)

    cur.execute(f"""
        SELECT
            m.text,
            m.attributedBody,
            m.date,
            m.is_from_me,
            h.id AS handle_id
        FROM message m
        JOIN handle h ON m.handle_id = h.ROWID
        WHERE h.id IN ({placeholders})
          AND m.date >= ? AND m.date < ?
        ORDER BY m.date ASC
    """, all_ids + [start_ts, end_ts])

    rows = cur.fetchall()
    conn.close()

    with open(output_path, "w") as f:
        f.write(f"Conversation with {name}\n")
        f.write(f"Period: {start.strftime('%m/%d/%Y')} - {end.strftime('%m/%d/%Y')}\n")
        f.write(f"Messages: {len(rows)}\n")
        f.write("=" * 60 + "\n\n")

        for row in rows:
            dt = apple_ts_to_datetime(row["date"])
            timestamp = dt.strftime("%m/%d/%y %I:%M %p") if dt else "?"
            sender = "Jordan" if row["is_from_me"] else name
            text = row["text"]
            if not text and row["attributedBody"]:
                text = extract_text_from_attributed_body(row["attributedBody"])
            text = text or "[attachment/reaction]"
            f.write(f"[{timestamp}] {sender}: {text}\n")

    print(f"  {name}: {len(rows)} messages -> {output_path}")

def main():
    out_dir = Path(__file__).parent / "conversation_exports"
    out_dir.mkdir(exist_ok=True)

    exports = [
        ("Megan Valentine", datetime(2023, 3, 1, tzinfo=timezone.utc), datetime(2026, 4, 3, tzinfo=timezone.utc)),
        ("Annelies Gamble", datetime(2020, 1, 1, tzinfo=timezone.utc), datetime(2026, 4, 3, tzinfo=timezone.utc)),
        ("Phil Boyer", datetime(2021, 1, 1, tzinfo=timezone.utc), datetime(2026, 4, 3, tzinfo=timezone.utc)),
        ("Andrew Dudum", datetime(2021, 1, 1, tzinfo=timezone.utc), datetime(2026, 4, 3, tzinfo=timezone.utc)),
        ("Dad", datetime(2021, 1, 1, tzinfo=timezone.utc), datetime(2026, 4, 3, tzinfo=timezone.utc)),
    ]

    print("Exporting conversations...\n")
    for name, start, end in exports:
        safe_name = name.lower().replace(" ", "_")
        output_path = out_dir / f"{safe_name}.txt"
        export_messages(name, start, end, output_path)

    print(f"\nAll exports in: {out_dir}")

if __name__ == "__main__":
    main()
