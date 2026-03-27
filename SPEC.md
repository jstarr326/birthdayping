# BirthdayPing — Product & Technical Spec (v3)

## One-Liner

A tool that figures out who you actually care about from your texting history, collects their birthdays for you, and automatically texts them on the day.

## Problem

Birthday reminder tools today either dump every Facebook friend's birthday on you (useless noise you learn to ignore) or force you to manually curate a list (defeats the purpose). The result: you miss the birthdays of people you genuinely care about. Nobody uses the strongest signal available — your actual messaging behavior — to figure out who matters.

## Core Insight

Your iMessage/SMS history is a near-perfect proxy for relationship importance. Frequency + recency of texting tells you who's in your life right now. Combine that signal with a dead-simple way to collect birthdays, and you get a smart, zero-effort birthday system.

---

## What's Changed from v2 Spec

- **Client-server architecture.** No longer a purely local app. There's a hosted web app (dashboard, preferences) and a lightweight Mac utility (reads chat.db, sends texts).
- **Facebook birthday import is core, not optional.** Testing showed only 6 out of 194 high-interaction contacts had birthdays in macOS Contacts. Facebook is the richest birthday data source and is needed for the product to work. Users import via a free Chrome extension (one-time, ~10 min).
- **No birthday-collection links.** Removed the "text them a link to enter their birthday" feature. If someone fills in their birthday via a link and then gets an automated text on that day, they'll connect the dots — which kills the personal touch.
- **Web dashboard is the primary interface.** You manage everything from the website — from your Mac, phone, or anywhere. The Mac utility is a background sync agent, not the main UI.

---

## Product Flow (End User Perspective)

### First-Time Setup

1. **Create an account** at birthdayping.com (email + password, or OAuth)
2. **Download & install** the Mac utility (direct download, not App Store)
3. **Log into the Mac utility** with your account
4. **Grant Full Disk Access** — guided walkthrough with explicit privacy promise: "We read who you text and when — never what you say."
5. **Grant Automation permission** — needed for sending iMessages via the Mac utility
6. **Mac utility runs initial analysis** (~5 seconds):
   - Reads iMessage metadata only (handle, count, most recent date — never message text)
   - Reads macOS Contacts for names, phone numbers, birthdays
   - Matches iMessage handles to contacts by phone number / email
   - Scores each contact by communication frequency and recency
   - Syncs the scored contact list + any existing birthdays to your account
7. **Web dashboard opens** showing your ranked contacts

### Birthday Collection

The dashboard shows two groups:

**"Ready to go"** — contacts who already have birthdays (from Contacts or Facebook import). Toggled on by default.

**"Missing birthdays"** — contacts you interact with a lot but have no birthday for. Two ways to fill the gap:

1. **Import from Facebook (recommended, do this during onboarding):** Install a free Chrome extension (Birthday Calendar Exporter or birthdays.social). The extension scrapes your Facebook friends' birthday page and exports a .ics or .csv file (~10 minutes for ~500 friends). Upload the file to the BirthdayPing dashboard. The app matches Facebook names to your ranked contact list and fills in birthdays automatically. Exact name matches are auto-linked; ambiguous matches are surfaced for user confirmation.

2. **Enter manually:** Type the birthday directly in the dashboard for any remaining contacts.

### Ongoing

- **Web dashboard** (birthdayping.com) is where you manage everything:
  - See upcoming birthdays
  - Toggle per-person reminders on/off
  - Customize birthday messages (per-person or global default)
  - Add/edit birthdays
  - Adjust settings (send time, threshold, calendar sync)
  - Re-trigger a contact analysis refresh

- **Mac utility** runs as a lightweight background process:
  - Sends automated birthday texts on the scheduled day/time via osascript
  - Periodically re-scans chat.db and syncs updated contact scores to the server
  - Receives instructions from the server (who to text, when, what message)

---

## Technical Architecture

### System Overview

```
┌─────────────────────────┐         ┌─────────────────────────┐
│     Mac Utility          │  sync   │     Web App (Server)     │
│                          │◄───────►│                          │
│  - Reads chat.db         │         │  - User accounts         │
│  - Reads Contacts        │         │  - Dashboard UI          │
│  - Sends iMessages       │         │  - Facebook .ics/.csv    │
│  - Runs as background    │         │    import + matching     │
│    process               │         │  - Preferences/settings  │
│                          │         │  - Contact + birthday DB │
│  Needs: Full Disk Access │         │  - API for Mac utility   │
│         Automation perm  │         │                          │
└─────────────────────────┘         └─────────────────────────┘
```

### Mac Utility (Local Agent)

**Language:** Python (packaged with PyInstaller or py2app)

**Responsibilities:**
- Read `~/Library/Messages/chat.db` for contact metadata (NEVER message.text)
- Read macOS Contacts for names, phone numbers, birthdays
- Match handles to contacts, compute relationship scores
- Sync scored contact list + birthdays to server via API
- Send iMessages/SMS via osascript when instructed by server
- Run as launchd daemon or menu bar app

**chat.db query (metadata only):**

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

**Date conversion:** chat.db uses Apple Core Data timestamps (nanoseconds since 2001-01-01). Convert: `datetime(date/1000000000 + 978307200, 'unixepoch')`

**iMessage sending:**

```bash
osascript -e 'tell application "Messages" to send "message text" to buddy "+15551234567"'
```

Requires Automation permission (System Settings → Privacy → Automation → allow app to control Messages).

**Sync cadence:**
- Initial: full scan on first run
- Ongoing: daily or weekly rescan of chat.db, sync deltas to server
- On-demand: user triggers refresh from dashboard

### Web App (Server)

**Responsibilities:**
- User authentication (Google OAuth)
- Dashboard UI (Next.js)
- REST API for Mac utility communication
- Store contacts, birthdays, scores, preferences, toggles
- Scheduling logic: determine which reminders to send each day
- Facebook .ics/.csv import and name matching

**Tech stack:**

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Framework** | Next.js (full-stack) | API routes + React frontend in one project, deploys to Vercel easily |
| **Database** | PostgreSQL (Vercel Postgres) | Relational data (users, contacts, birthdays, preferences) |
| **Hosting** | Vercel | Already have an account, good free tier, serverless API routes |
| **Auth** | NextAuth.js with Google OAuth | Simple, well-documented, no password management needed |

**Key API endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sync` | POST | Mac utility pushes scored contact list |
| `/api/tasks` | GET | Mac utility polls for pending texts to send |
| `/api/tasks/:id/complete` | POST | Mac utility confirms a text was sent |
| `/api/contacts` | GET/PUT | Dashboard reads/updates contact list |
| `/api/contacts/:id/birthday` | PUT | Manual birthday entry from dashboard |
| `/api/settings` | GET/PUT | User preferences (message, time, threshold) |
| `/api/import/facebook` | POST | Upload .ics/.csv for Facebook birthday import + matching |

### Facebook Birthday Import

**How it works:**
1. During onboarding, user is prompted: "Import birthdays from Facebook to fill in the gaps"
2. User installs a free Chrome extension (Birthday Calendar Exporter or birthdays.social)
3. Extension scrapes Facebook's birthdays page while user is logged in (~10 min for ~500 friends)
4. Extension exports a .ics or .csv file containing friend names + birthday dates
5. User uploads the file to the BirthdayPing dashboard
6. Server parses the file, extracts name + birthday pairs
7. Matching engine links Facebook names to the ranked contact list:
   - **Exact match:** Facebook name == Contact name → auto-linked
   - **Close match:** Minor variations (Mike/Michael, missing middle name) → auto-linked with confidence flag
   - **Ambiguous:** Surfaced in dashboard for user to confirm or dismiss
8. Matched birthdays populate the contact list immediately

**Supported formats:**
- `.ics` (iCalendar) — standard birthday calendar export, one VEVENT per birthday
- `.csv` — columns: name, birthday date

**Future enhancement:** LLM-assisted fuzzy matching via Claude API for ambiguous name pairs (e.g., "Is 'Mike T.' the same as 'Michael Torres'?"). For v0, exact + close matching is sufficient.

### Identity Matching

Three-way match: iMessage handles ↔ macOS Contacts ↔ Facebook friends.

**Step 1 — Handle-to-Contact match (~85% of handles):**
- `handle.id` phone number → normalize (strip +1, spaces, dashes, parens) → match against contact phone numbers
- `handle.id` email → match against contact email addresses

**Step 2 — Facebook-to-Contact match (fills in birthdays):**
- Exact name match: Facebook friend name == Contact full name → auto-link birthday
- Close name match: common variations (Mike/Michael, missing middle name, Jr./Sr.) → auto-link with flag
- Ambiguous matches: surfaced in dashboard for user to confirm

**Unmatched handles:**
- High-volume unmatched handles surfaced as "Unknown — [phone number]" with option to assign a name

**Future:** LLM-assisted fuzzy matching via Claude API for the ambiguous Facebook-to-Contact cases.

### Scoring Algorithm

```
score = (0.4 × frequency_score) + (0.5 × recency_score) + (0.1 × bidirectional_score)
```

| Component | Calculation | Range |
|-----------|-------------|-------|
| **frequency_score** | `log(total_messages) / log(max_messages_across_all)` | 0–1 |
| **recency_score** | Exponential decay: <30 days = 1.0, <90 = 0.7, <180 = 0.4, <365 = 0.1, >365 = 0.0 | 0–1 |
| **bidirectional_score** | `min(sent, received) / max(sent, received)` — filters one-way spam/notifications | 0–1 |

**Threshold:** Default 0.3. Configurable via dashboard slider.

### Automated Birthday Texts

### Birthday Reminders

The app reminds *you* to text people — it does NOT auto-send birthday messages to your contacts. This preserves the personal touch: you write the message yourself.

**Mechanism:**
- Mac utility checks server each morning at configured time (default 9 AM)
- Server returns list of contacts with birthdays today who have reminders enabled
- Mac utility sends a text **to you** via osascript: *"Here's a reminder to say happy birthday to Jordan Smith"*
- One text per birthday person, sent to your own phone number
- **Fallback:** If Mac utility is offline, server sends an email to the user with the same reminder
- **Future consideration:** Option to auto-send a birthday text directly to the contact (opt-in per person, not default)

**Communication model:** Polling. Mac utility checks the server once or twice daily. Simple, reliable, no persistent connection needed. WebSockets are unnecessary for this cadence and add complexity.

### Calendar Sync

Optional, in addition to automated texts:
- `.ics` file download from dashboard (works with any calendar app)
- Or direct Google Calendar API integration
- Event format: all-day, yearly recurrence, "[Name]'s Birthday 🎂"

---

## Privacy Design

### Principles

1. **Metadata only.** The Mac utility reads message handles, timestamps, and counts. It NEVER reads message.text.
2. **Minimal data synced.** Only contact names, phone numbers, relationship scores, and birthdays are sent to the server. No message content. No message timestamps beyond "most recent."
3. **Open source Mac utility.** The local component that touches sensitive data is public and auditable.
4. **User controls everything.** Every contact is individually toggleable. User can delete their account and all data at any time.

### What the Mac Utility Accesses Locally

- `handle.id` (phone number or email)
- `message.date` (timestamp)
- `message.is_from_me` (direction)
- `COUNT` of messages per handle
- Contact names, phone numbers, emails, birthdays

### What the Mac Utility NEVER Accesses

- `message.text` (message content)
- `message.attributedBody` (rich text content)
- `message.payload_data` (attachment data)
- Any media, photos, or attachments

### What Gets Sent to the Server

- Contact name + phone number
- Relationship score
- Birthday (if known)
- User preferences and toggles

### What NEVER Leaves the Mac

- Message content
- Full message history or timestamps
- Attachment data
- Any data beyond what's listed above

### User-Facing Privacy Promise

> "BirthdayPing looks at who you text and how often — never what you say. Your message content never leaves your Mac. The Mac utility is open source so you can verify this yourself."

---

## Build Phases

### Phase 1: Core Engine — Mac Utility (Day 1) ✅ DONE
- [x] Read chat.db — extract handle + frequency + recency metadata
- [x] Read macOS Contacts — names, numbers, emails, birthdays
- [x] Match handles to contacts by phone number / email
- [x] Compute relationship scores
- [x] Output ranked JSON of contacts with scores + birthday status

### Phase 2: Web App — Server + Dashboard (Day 1-2)
- [ ] Next.js project with Vercel Postgres
- [ ] Google OAuth via NextAuth.js
- [ ] API endpoint for Mac utility to sync contact data (`POST /api/sync`)
- [ ] Dashboard UI: ranked contact list with toggles and inline birthday editing
- [ ] Upcoming birthdays view
- [ ] Settings page (send time, threshold)

### Phase 3: Facebook Birthday Import (Day 2)
- [ ] .ics parser (extract VEVENT birthday entries: name + date)
- [ ] .csv parser (name + birthday columns)
- [ ] Upload UI in dashboard
- [ ] Name matching engine: exact match, close match (common variations), ambiguous flagging
- [ ] Ambiguous match review UI in dashboard
- [ ] Manual birthday entry for remaining gaps

### Phase 4: Birthday Reminders (Day 2-3)
- [ ] Server-side scheduling: determine daily reminder list
- [ ] Mac utility polls server for today's reminders
- [ ] Mac utility sends reminder text TO THE USER (not to the birthday person) via osascript
- [ ] Fallback: email reminder if Mac utility is offline
- [ ] Per-person toggle on/off in dashboard

### Phase 5: Polish + Packaging (Day 3)
- [ ] Mac utility: menu bar icon, background process, auto-start on login
- [ ] Onboarding flow with permission walkthrough
- [ ] .ics calendar export from dashboard
- [ ] PyInstaller packaging as distributable .app
- [ ] Code-sign with Apple Developer ID certificate
- [ ] Notarize with Apple
- [ ] Landing page for birthdayping.com

### Why Not the Mac App Store?

Mac App Store apps are sandboxed — they cannot request or use Full Disk Access, which is required to read `chat.db`. Since reading iMessage metadata is the core product (not an optional feature), App Store distribution is not possible. Apple will auto-reject any app that depends on Full Disk Access.

**Distribution path:** Direct download from website, signed with a Developer ID certificate and notarized with Apple. Same model as Alfred, Bartender, Homebrew, etc.

---

## Future Roadmap (v1+)

### LLM-Assisted Name Matching
- Claude API for ambiguous Facebook-to-Contact matches
- Batch all ambiguous pairs in a single API call with structured output
- Auto-accept high-confidence, surface medium-confidence for user review

### WhatsApp / Telegram
- Both store local SQLite databases on Mac
- Cross-reference to strengthen the relationship signal
- Particularly valuable for international contacts

### Mobile App
- iOS app that shows upcoming birthdays and lets you manage toggles
- Push notifications as an alternative to Mac utility for reminders
- Long-term: could replace the Mac utility if Apple ever opens up iMessage APIs

### Relationship Memory / Personal CRM
The bigger vision if v0 validates. BirthdayPing becomes the wedge into:
- **Check-in reminders:** "You haven't texted [Name] in 3 months — want to reach out?"
- **Important dates beyond birthdays:** Anniversaries, kids' birthdays, milestones
- **Relationship health dashboard:** See who you're losing touch with over time
- **Smart suggestions:** "You used to text [Name] weekly, now it's been 2 months"

The core asset is the communication-pattern analysis engine. Birthdays are the first and most emotionally resonant use case, but the same engine powers all of the above.

---

## Resolved Decisions

- **Hosting:** Vercel (already have an account) with Vercel Postgres
- **Auth:** Google OAuth via NextAuth.js
- **Communication model:** Polling (Mac utility checks server 1-2x daily)
- **Reminder model:** App texts the USER a reminder ("Here's a reminder to say happy birthday to [Name]"). User sends the actual birthday message themselves — preserves personal touch.
- **Facebook:** Core flow, not optional. Import via Chrome extension export (.ics/.csv).

## Open Questions

- **Project name:** BirthdayPing is the working title. Open to alternatives.
- **Facebook name matching threshold:** How aggressively to auto-match close-but-not-exact names vs surfacing for user review? Will be trial and error.
- **Reminder timing:** What time of day should the reminder text arrive? Default 9 AM, but should it be configurable?
- **Future: auto-send option?** Should there eventually be an opt-in to auto-send birthday texts directly to contacts, or always keep it as a reminder to the user?
