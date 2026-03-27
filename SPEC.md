# BirthdayPing — Product & Technical Spec (v2)

## One-Liner

A Mac utility that analyzes who you actually communicate with, surfaces their birthdays, and automatically texts them on the day — so you remember the people who matter without any effort.

## Problem

Birthday reminder tools today either dump every Facebook friend's birthday into your calendar (useless noise you learn to ignore) or force you to manually curate a list (defeats the purpose). The result: you miss the birthdays of people you genuinely care about. Nobody uses the strongest signal available — your actual messaging behavior — to figure out who matters.

## Core Insight

Your iMessage/SMS history is a near-perfect proxy for relationship importance. Frequency + recency of texting tells you who's in your life right now. Combine that signal with birthday data already in your contacts, and you get a smart, zero-effort birthday list — no Facebook required.

---

## What's Changed from v1 Spec

- **Dropped Facebook for v0.** Most contacts already have birthdays via iCloud/Google sync. Facebook adds setup friction and a brittle dependency. It becomes a "fill gaps" feature later if needed.
- **GUI is a lightweight local web UI**, not terminal or SwiftUI.
- **Automated SMS on birthdays**, not just calendar reminders.
- **Surfaces high-interaction contacts missing birthdays** so you can manually input them.
- **Per-person toggles** for who gets an automated birthday text.
- **Longer-term vision** section added (relationship memory / personal CRM direction).

---

## Product Flow (End User Perspective)

### First-Time Setup

1. **Download & install** the Mac utility (direct download, not App Store)
2. **Grant Full Disk Access** — guided walkthrough explains exactly what this means and why. Explicit promise: "We read who you text and when — never what you say. The code is open source."
3. **Utility runs analysis** (~5 seconds):
   - Reads iMessage metadata only (handle, count, most recent date — never message text)
   - Reads macOS Contacts for names, phone numbers, birthdays
   - Matches iMessage handles to contacts by phone number / email
   - Scores each contact by communication frequency and recency
4. **Web UI opens in browser** showing two lists:
   - **"Ready to go"** — contacts with high interaction scores who already have birthdays in Contacts. Auto-enabled for birthday texts. User can toggle any person off.
   - **"Missing birthdays"** — contacts with high interaction scores but no birthday data. User can manually enter birthdays right in the UI.
5. **User reviews, toggles, and adds any missing birthdays**
6. **Birthdays sync to calendar** (Apple Calendar or Google Calendar) with yearly recurrence
7. **App runs in background** — on each person's birthday, sends an automated text via the configured method

### Ongoing

- App runs as a lightweight background process (or launchd daemon)
- On the morning of someone's birthday: sends an automated SMS/iMessage
- User can re-open the web UI anytime to:
  - Toggle people on/off
  - Add or edit birthdays
  - See who's coming up
  - Re-run the analysis to pick up new contacts

---

## Technical Architecture

### Data Sources

#### 1. iMessage / SMS History (Primary Signal)

- **Location:** `~/Library/Messages/chat.db` (SQLite)
- **Access:** Requires Full Disk Access permission on macOS
- **Key tables:**
  - `handle` — each unique phone number or email (`handle.id`)
  - `message` — every message with timestamp, `handle_id`, `is_from_me`
  - `chat_handle_join` — maps handles to chat threads
- **Core query (metadata only):**

```sql
SELECT
    h.id AS contact_identifier,
    COUNT(m.ROWID) AS total_messages,
    SUM(CASE WHEN m.is_from_me = 1 THEN 1 ELSE 0 END) AS sent_count,
    SUM(CASE WHEN m.is_from_me = 0 THEN 1 ELSE 0 END) AS received_count,
    MAX(m.date) AS last_message_date
FROM message m
JOIN handle h ON m.handle_id = h.ROWID
GROUP BY h.id
ORDER BY total_messages DESC;
```

- **Date conversion:** chat.db uses Apple Core Data timestamps (nanoseconds since 2001-01-01). Convert: `datetime(date/1000000000 + 978307200, 'unixepoch')`
- **Privacy constraint:** NEVER read `message.text`, `message.attributedBody`, or `message.payload_data`. Only metadata.

#### 2. macOS Contacts (Birthday Source)

- **Access:** Contacts framework (`CNContactStore` via PyObjC) — requires Contacts permission
- **Data needed:** Full name, phone numbers, email addresses, birthday field
- **Note:** Many contacts already have birthdays populated from iCloud, Google, Exchange, or CardDAV sync

#### 3. User-Provided Birthdays (Manual Input)

- **Source:** The web UI allows users to manually enter birthdays for contacts that don't have one
- **Storage:** Local JSON file or SQLite database alongside app data
- **Priority:** User-entered birthdays override any other source

### Identity Matching (v0 — Two-Way)

Match iMessage handles to macOS Contacts only. No Facebook, no LLM fuzzy matching in v0.

**Tier 1 — Phone number / email match (~85%):**
- `handle.id` contains a phone number → normalize and match against contact phone numbers
- `handle.id` contains an email → match against contact email addresses
- This covers the vast majority of cases because iMessage handles ARE phone numbers/emails

**Tier 2 — Unmatched handles:**
- Some handles won't match any contact (deleted contacts, numbers not in address book)
- These are deprioritized but logged — if a user texts a number 500 times, it should still surface
- UI shows these as "Unknown — [phone number]" with option to assign a name

**Future (v1+):** LLM-assisted fuzzy matching for Facebook integration, WhatsApp/Telegram cross-referencing.

### Scoring Algorithm

For each matched contact, compute a relationship score:

```
score = (0.4 × frequency_score) + (0.5 × recency_score) + (0.1 × bidirectional_score)
```

| Component | Calculation | Range |
|-----------|-------------|-------|
| **frequency_score** | `log(total_messages) / log(max_messages_across_all)` | 0–1 |
| **recency_score** | Exponential decay from last message: <30 days = 1.0, <90 = 0.7, <180 = 0.4, <365 = 0.1, >365 = 0.0 | 0–1 |
| **bidirectional_score** | `min(sent, received) / max(sent, received)` — filters one-way spam/notifications | 0–1 |

**Threshold:** Default 0.3. Contacts above threshold appear in the UI. User can adjust via a simple slider ("Show people I've texted in the last 6 / 12 / 24 months").

**Two categories in UI:**
- **Has birthday + above threshold** → auto-enabled for reminders
- **No birthday + above threshold** → surfaced with prompt: "You talk to this person a lot. Add their birthday?"

### Automated Birthday Texts

This is the core ongoing value — not just a calendar entry, but an actual text sent on the day.

**Mechanism:** AppleScript or `osascript` to send iMessage/SMS via Messages.app:

```bash
osascript -e 'tell application "Messages" to send "Happy birthday! 🎂" to buddy "+15551234567"'
```

**Considerations:**
- Requires Messages.app to be configured (it will be, since we're reading chat.db)
- User must grant Automation permission (System Settings → Privacy → Automation → allow app to control Messages)
- Default message: "Happy birthday! 🎂" — user can customize per-person or globally
- Timing: configurable, default 9:00 AM local time
- **Per-person toggle:** Each contact has an on/off switch in the UI. Enabled by default for high-score contacts with birthdays.

**Fallback:** If automated sending fails or user prefers, fall back to a macOS notification: "Today is [Name]'s birthday — tap to open Messages"

### Calendar Sync

In addition to automated texts, birthdays sync to the user's calendar for visibility.

- **Method:** `.ics` file export (simplest, works with any calendar app) OR direct EventKit integration
- **Event format:** All-day event, yearly recurrence, "[Name]'s Birthday 🎂"
- **Reminder:** Day-before notification via calendar

### Web UI

Lightweight local web interface — Python backend serves a local web page.

**Tech:** Python (Flask or FastAPI) backend + vanilla HTML/CSS/JS frontend, or a simple React app served locally.

**Screens:**

1. **Setup / Onboarding**
   - Permission check status (Full Disk Access, Contacts, Automation)
   - Step-by-step grant flow with screenshots
   - Privacy disclosure

2. **Dashboard (main screen)**
   - Ranked list of contacts with scores
   - Toggle switch per person (on = gets birthday text)
   - Birthday field: shows date if known, editable input if not
   - "Upcoming birthdays" section at top
   - Score explanation on hover/click (message count, last texted date)

3. **Settings**
   - Default birthday message (customizable)
   - Send time (default 9 AM)
   - Score threshold slider
   - Calendar sync on/off + which calendar
   - Re-run analysis button

**Runs on:** `localhost:PORT` — opens automatically after setup. App lives in menu bar or as a background process.

---

## Tech Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Language** | Python | Fast prototyping, good SQLite/PyObjC support, Claude Code scaffolds quickly |
| **Web UI** | Flask + vanilla JS (or React) | Lightweight, no heavy framework needed |
| **Contacts access** | PyObjC (`pyobjc-framework-Contacts`) | Native macOS Contacts framework |
| **iMessage sending** | `osascript` (AppleScript via subprocess) | Simplest way to send iMessage/SMS programmatically |
| **Calendar** | `icalendar` library for .ics export | Works with any calendar app, zero API auth |
| **Background scheduling** | `launchd` plist or `schedule` library | Runs daily check for today's birthdays |
| **Packaging** | PyInstaller or py2app | Single distributable Mac app |
| **Data storage** | Local SQLite DB | Stores user-entered birthdays, toggles, preferences |

---

## Privacy Design

The entire trust model depends on this. It's not just a feature — it's the pitch.

### Principles

1. **Metadata only.** Reads message handles, timestamps, and counts. NEVER reads message.text.
2. **Local only.** All processing happens on the user's Mac. No data leaves the machine. No server. No analytics.
3. **Open source.** Code is public and auditable. Anyone can verify what data is accessed.
4. **Zero network calls in v0.** No API calls at all. No LLM, no telemetry, no cloud sync. Everything is local.
5. **User controls everything.** Every contact is individually toggleable. User can delete all data from the app at any time.

### What We Access

- `handle.id` (phone number or email)
- `message.date` (timestamp)
- `message.is_from_me` (direction)
- `COUNT` of messages per handle
- Contact names, phone numbers, emails, birthdays

### What We NEVER Access

- `message.text` (message content)
- `message.attributedBody` (rich text content)
- `message.payload_data` (attachment data)
- Any media, photos, or attachments
- Any data is sent over the network

### User-Facing Privacy Promise

> "BirthdayPing looks at who you text and how often — never what you say. It reads names and timestamps only. Everything stays on your Mac. The code is open source so you can verify this yourself."

---

## Build Phases

### Phase 1: Core Engine (Day 1)

- [ ] Read chat.db — extract handle + frequency + recency metadata
- [ ] Read macOS Contacts — names, numbers, emails, birthdays
- [ ] Match handles to contacts by phone number / email
- [ ] Compute relationship scores
- [ ] Output ranked JSON of contacts with scores + birthday status

### Phase 2: Web UI (Day 1)

- [ ] Flask app serving on localhost
- [ ] Dashboard showing ranked contact list
- [ ] Per-person toggle (on/off for birthday text)
- [ ] Inline birthday input for contacts missing birthdays
- [ ] Upcoming birthdays view
- [ ] Settings page (message, time, threshold)

### Phase 3: Automated Texting + Calendar (Day 2)

- [ ] osascript-based iMessage/SMS sending
- [ ] Background scheduler (daily check at configured time)
- [ ] Per-person custom messages (optional, with global default)
- [ ] .ics export for calendar sync
- [ ] macOS notification fallback

### Phase 4: Polish + Packaging (Day 2-3)

- [ ] Onboarding flow with permission walkthrough
- [ ] Menu bar icon / background process management
- [ ] Re-run analysis feature
- [ ] PyInstaller packaging as distributable .app
- [ ] Code-sign with Apple Developer ID certificate (avoids "unidentified developer" warning)
- [ ] Notarize with Apple (lets Gatekeeper pass the app through without friction)
- [ ] README with privacy documentation

### Why Not the Mac App Store?

Mac App Store apps are sandboxed — they cannot request or use Full Disk Access, which is required to read `chat.db`. Since reading iMessage metadata is the core product (not an optional feature), App Store distribution is not possible. Apple will auto-reject any app that depends on Full Disk Access.

**Distribution path:** Direct download from website, signed with a Developer ID certificate and notarized with Apple. This is the same model used by well-known Mac utilities (Alfred, Bartender, Homebrew, etc.). Users get a clean install experience with no Gatekeeper warnings as long as signing + notarization are done correctly.

---

## Future Roadmap (v1+)

### Facebook Integration

- Parse Facebook data export for friend birthdays
- LLM-assisted fuzzy matching (Claude API) for name ambiguity
- Fills birthday gaps for contacts that don't have birthdays in Contacts

### WhatsApp / Telegram

- Both store local SQLite databases on Mac
- Cross-reference to strengthen the relationship signal
- Particularly valuable for international contacts

### Relationship Memory / Personal CRM Direction

This is the bigger vision if v0 validates. BirthdayPing becomes the wedge into:

- **Check-in reminders:** "You haven't texted [Name] in 3 months — want to reach out?"
- **Important dates beyond birthdays:** Anniversaries, kids' birthdays, work milestones
- **Relationship health dashboard:** See who you're losing touch with over time
- **Smart suggestions:** "You used to text [Name] weekly, now it's been 2 months"

The core asset is the communication-pattern analysis engine. Birthdays are the first and most emotionally resonant use case, but the same engine powers all of the above.

---

## Open Questions

- **Project name:** BirthdayPing is the working title. Open to alternatives.
- **Automated text tone:** Should the default message be customizable per-person from day 1, or start with a single global default?
- **Re-run frequency:** Should the analysis auto-refresh (weekly? monthly?) or only on manual trigger?
- **Notification permission:** osascript iMessage sending may require Automation permission — need to test exact permission flow on current macOS versions.
