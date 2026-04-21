# BirthdayPing

## What this is
A tool that ranks your contacts by iMessage frequency, imports birthdays from Facebook, and reminds you on the day. Mac utility + Next.js web app.

## Architecture
- **Web app**: Next.js on Vercel, Postgres (Vercel/Supabase), NextAuth with Google OAuth
- **Local dev**: SQLite via better-sqlite3 (auto-detected, no config needed)
- **Mac utility**: Python scripts in mac-utility/ — NOT a packaged .app for now, just run directly
- **Facebook scraper**: Uses Facebook's internal GraphQL API (doc_id 3681233908586032), not DOM scraping

## Key paths
- `core_engine.py` — reads chat.db + Contacts, outputs contacts_ranked.json
- `scripts/sync.py` — uploads contacts_ranked.json to the server
- `mac-utility/facebook_scraper.py` — scrapes all 12 months of Facebook birthdays
- `mac-utility/reminder_check.py` — polls server, sends iMessage reminders via osascript
- `src/app/api/import/facebook/route.ts` — CSV upload + name matching
- `src/lib/name-matcher.ts` — exact + close (nickname) matching
- `src/lib/ics-parser.ts` — parses CSV and ICS birthday files

## Running locally
```bash
# Start dev server
npm run dev

# Scan contacts and sync to server
python3 core_engine.py
python3 scripts/sync.py

# Facebook birthday scraper (opens browser, uses GraphQL API)
python3 mac-utility/facebook_scraper.py

# Test reminders
python3 mac-utility/reminder_check.py
```

## Environment
- Production: birthdayping.vercel.app
- Auth: Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- API key for Mac utility: SYNC_API_KEY
- Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
- Cron: CRON_SECRET (Vercel cron triggers /api/reminders/send daily at 9 AM PT)

## Current state
- Phases 1-4, 6, 9-11 complete
- The PyInstaller .app bundle has menu bar display issues — just run scripts directly for now
- Facebook scraper works great (800+ birthdays via GraphQL)
- Vercel cron configured for daily reminders at 4 PM UTC (9 AM PT)
- Birthday dates stored as YYYY-MM-DD where year may be "0000" (month/day only)
