#!/usr/bin/env python3
"""
BirthdayPing — Phase 1 Core Engine
Reads iMessage metadata + macOS Contacts, scores relationships, outputs ranked JSON.
Privacy: NEVER reads message.text or any message content.
"""

import sqlite3
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── iMessage ──────────────────────────────────────────────────────────────────

CHAT_DB = Path.home() / "Library/Messages/chat.db"

# Apple Core Data epoch is 2001-01-01 00:00:00 UTC
APPLE_EPOCH_OFFSET = 978307200


def apple_ts_to_datetime(ts):
    """Convert Apple Core Data nanosecond timestamp to datetime."""
    if not ts:
        return None
    unix_ts = ts / 1_000_000_000 + APPLE_EPOCH_OFFSET
    return datetime.fromtimestamp(unix_ts, tz=timezone.utc)


def read_imessage_metadata():
    """
    Query chat.db for per-handle message counts and last message date.
    Reads ONLY: handle.id, message.date, message.is_from_me, message.ROWID
    NEVER reads: message.text, attributedBody, payload_data
    """
    if not CHAT_DB.exists():
        print(f"ERROR: chat.db not found at {CHAT_DB}", file=sys.stderr)
        print("Grant Full Disk Access to Terminal in System Settings → Privacy & Security", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(f"file:{CHAT_DB}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT
            h.id AS contact_identifier,
            COUNT(m.ROWID) AS total_messages,
            SUM(CASE WHEN m.is_from_me = 1 THEN 1 ELSE 0 END) AS sent_count,
            SUM(CASE WHEN m.is_from_me = 0 THEN 1 ELSE 0 END) AS received_count,
            MAX(m.date) AS last_message_date
        FROM message m
        JOIN handle h ON m.handle_id = h.ROWID
        GROUP BY h.id
        ORDER BY total_messages DESC
    """)

    handles = []
    for row in cur.fetchall():
        handles.append({
            "identifier": row["contact_identifier"],
            "total_messages": row["total_messages"],
            "sent_count": row["sent_count"] or 0,
            "received_count": row["received_count"] or 0,
            "last_message_date": apple_ts_to_datetime(row["last_message_date"]),
        })

    conn.close()
    print(f"[iMessage] Read {len(handles)} unique handles from chat.db")
    return handles


# ── Phone normalization ───────────────────────────────────────────────────────

def normalize_phone(phone):
    """Strip formatting and leading country code (+1) to get 10-digit number."""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def is_email(s):
    return "@" in s


# ── macOS Contacts ────────────────────────────────────────────────────────────

def read_contacts():
    """
    Read names, phone numbers, email addresses, and birthdays from macOS Contacts.
    Returns list of dicts.
    """
    try:
        import Contacts as CNContacts
    except ImportError:
        print("ERROR: pyobjc-framework-Contacts not installed. Run: pip3 install pyobjc-framework-Contacts", file=sys.stderr)
        sys.exit(1)

    store = CNContacts.CNContactStore.alloc().init()

    # Check auth status first; if not determined, trigger the system prompt
    auth_status = CNContacts.CNContactStore.authorizationStatusForEntityType_(
        CNContacts.CNEntityTypeContacts
    )
    # CNAuthorizationStatus: 0=NotDetermined, 1=Restricted, 2=Denied, 3=Authorized
    if auth_status == 2:
        print("ERROR: Contacts access denied. Grant access in System Settings → Privacy → Contacts", file=sys.stderr)
        sys.exit(1)
    elif auth_status == 1:
        print("ERROR: Contacts access restricted by system policy.", file=sys.stderr)
        sys.exit(1)
    elif auth_status == 0:
        # Not determined — trigger the system permission prompt synchronously via a semaphore
        import threading
        semaphore = threading.Semaphore(0)
        result = [False]

        def handler(granted, err):
            result[0] = granted
            semaphore.release()

        store.requestAccessForEntityType_completionHandler_(
            CNContacts.CNEntityTypeContacts, handler
        )
        semaphore.acquire()
        if not result[0]:
            print("ERROR: Contacts access denied. Grant access in System Settings → Privacy → Contacts", file=sys.stderr)
            sys.exit(1)

    keys = [
        CNContacts.CNContactGivenNameKey,
        CNContacts.CNContactFamilyNameKey,
        CNContacts.CNContactPhoneNumbersKey,
        CNContacts.CNContactEmailAddressesKey,
        CNContacts.CNContactBirthdayKey,
    ]

    fetch_request = CNContacts.CNContactFetchRequest.alloc().initWithKeysToFetch_(keys)
    fetch_request.setSortOrder_(CNContacts.CNContactSortOrderGivenName)

    contacts = []

    def handler(contact, stop):
        first = contact.givenName() or ""
        last = contact.familyName() or ""
        full_name = f"{first} {last}".strip() or "Unknown"

        phones = [normalize_phone(str(p.value().stringValue()))
                  for p in contact.phoneNumbers()]
        emails = [str(e.value()).lower() for e in contact.emailAddresses()]

        birthday = None
        bday_components = contact.birthday()
        if bday_components:
            month = bday_components.month()
            day = bday_components.day()
            year = bday_components.year()
            INVALID_YEAR = (0, 2147483647, 9223372036854775807)
            if month and day:
                year_str = str(year) if year not in INVALID_YEAR else "????"
                birthday = f"{year_str}-{month:02d}-{day:02d}"

        contacts.append({
            "name": full_name,
            "phones": phones,
            "emails": emails,
            "birthday": birthday,
        })

    error = store.enumerateContactsWithFetchRequest_error_usingBlock_(
        fetch_request, None, handler
    )

    print(f"[Contacts] Read {len(contacts)} contacts")
    return contacts


# ── Matching ──────────────────────────────────────────────────────────────────

def build_contact_index(contacts):
    """Build lookup dicts: normalized_phone → contact, email → contact."""
    phone_index = {}
    email_index = {}
    for c in contacts:
        for p in c["phones"]:
            if p:
                phone_index[p] = c
        for e in c["emails"]:
            if e:
                email_index[e] = c
    return phone_index, email_index


def match_handles_to_contacts(handles, contacts):
    """
    Match each iMessage handle to a contact.
    Returns list of matched records and list of unmatched high-volume handles.
    """
    phone_index, email_index = build_contact_index(contacts)
    matched = []
    unmatched = []

    for h in handles:
        identifier = h["identifier"]
        contact = None

        if is_email(identifier):
            contact = email_index.get(identifier.lower())
        else:
            normalized = normalize_phone(identifier)
            if normalized:
                contact = phone_index.get(normalized)

        if contact:
            matched.append({**h, "contact": contact})
        else:
            unmatched.append(h)

    print(f"[Match] {len(matched)} matched, {len(unmatched)} unmatched handles")
    return matched, unmatched


# ── Scoring ───────────────────────────────────────────────────────────────────

def recency_score(last_message_date):
    """Exponential decay based on days since last message."""
    if not last_message_date:
        return 0.0
    now = datetime.now(tz=timezone.utc)
    days = (now - last_message_date).days
    if days < 30:
        return 1.0
    elif days < 90:
        return 0.7
    elif days < 180:
        return 0.4
    elif days < 365:
        return 0.1
    else:
        return 0.0


def bidirectional_score(sent, received):
    """Ratio of two-way communication. Filters spam/notifications."""
    if sent == 0 or received == 0:
        return 0.0
    return min(sent, received) / max(sent, received)


def score_contacts(matched, unmatched):
    """Compute relationship scores for all handles."""
    all_messages = [r["total_messages"] for r in matched] + \
                   [r["total_messages"] for r in unmatched]
    max_messages = max(all_messages) if all_messages else 1

    results = []

    for record in matched:
        total = record["total_messages"]
        freq = math.log(total) / math.log(max_messages) if total > 1 else 0.0
        rec = recency_score(record["last_message_date"])
        bi = bidirectional_score(record["sent_count"], record["received_count"])
        score = round(0.4 * freq + 0.5 * rec + 0.1 * bi, 4)

        contact = record["contact"]
        last_texted = record["last_message_date"].strftime("%Y-%m-%d") if record["last_message_date"] else None

        results.append({
            "name": contact["name"],
            "identifier": record["identifier"],
            "score": score,
            "total_messages": total,
            "sent_count": record["sent_count"],
            "received_count": record["received_count"],
            "last_texted": last_texted,
            "has_birthday": bool(contact["birthday"]),
            "birthday_date": contact["birthday"],
            "_matched": True,
        })

    # High-volume unmatched handles (surface as Unknown)
    for record in unmatched:
        if record["total_messages"] < 10:
            continue
        total = record["total_messages"]
        freq = math.log(total) / math.log(max_messages) if total > 1 else 0.0
        rec = recency_score(record["last_message_date"])
        bi = bidirectional_score(record["sent_count"], record["received_count"])
        score = round(0.4 * freq + 0.5 * rec + 0.1 * bi, 4)
        last_texted = record["last_message_date"].strftime("%Y-%m-%d") if record["last_message_date"] else None

        results.append({
            "name": f"Unknown — {record['identifier']}",
            "identifier": record["identifier"],
            "score": score,
            "total_messages": total,
            "sent_count": record["sent_count"],
            "received_count": record["received_count"],
            "last_texted": last_texted,
            "has_birthday": False,
            "birthday_date": None,
            "_matched": False,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


# ── Output ────────────────────────────────────────────────────────────────────

THRESHOLD = 0.3

def build_output(scored):
    has_birthday = [r for r in scored if r["has_birthday"] and r["score"] >= THRESHOLD]
    missing_birthday = [r for r in scored if not r["has_birthday"] and r["score"] >= THRESHOLD]

    # Strip internal field
    for r in has_birthday + missing_birthday:
        r.pop("_matched", None)

    return {
        "generated_at": datetime.now().isoformat(),
        "threshold": THRESHOLD,
        "has_birthday": has_birthday,
        "missing_birthday": missing_birthday,
    }


def main():
    print("=== BirthdayPing — Phase 1 Core Engine ===\n")

    handles = read_imessage_metadata()
    contacts = read_contacts()
    matched, unmatched = match_handles_to_contacts(handles, contacts)
    scored = score_contacts(matched, unmatched)
    output = build_output(scored)

    out_path = Path(__file__).parent / "contacts_ranked.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    # Console summary
    hb = output["has_birthday"]
    mb = output["missing_birthday"]
    print(f"\n[Output] Written to {out_path}")
    print(f"\n--- Top 10 (has birthday) ---")
    for r in hb[:10]:
        print(f"  {r['score']:.3f}  {r['name']:<30}  bday: {r['birthday_date']}  last: {r['last_texted']}  msgs: {r['total_messages']}")
    print(f"\n--- Top 10 (missing birthday) ---")
    for r in mb[:10]:
        print(f"  {r['score']:.3f}  {r['name']:<30}  last: {r['last_texted']}  msgs: {r['total_messages']}")
    print(f"\nTotal above threshold — has birthday: {len(hb)}, missing birthday: {len(mb)}")


if __name__ == "__main__":
    main()
