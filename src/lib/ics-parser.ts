/**
 * Parse a Facebook birthday .ics (iCalendar) export.
 *
 * Each birthday is a VEVENT with:
 *   SUMMARY: "Name's birthday"  (or just "Name")
 *   DTSTART: YYYYMMDD  (only month/day matter — year is often 1604 or current)
 *
 * Returns an array of { name, month, day } objects.
 */

export type ParsedBirthday = {
  name: string;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
};

export function parseIcs(text: string): ParsedBirthday[] {
  const results: ParsedBirthday[] = [];
  const events = text.split("BEGIN:VEVENT");

  for (const event of events) {
    if (!event.includes("END:VEVENT")) continue;

    const summary = extractField(event, "SUMMARY");
    const dtstart = extractField(event, "DTSTART");

    if (!summary || !dtstart) continue;

    // Strip "'s birthday" / "'s Birthday" suffix, common in Facebook exports
    const name = summary
      .replace(/'s\s+birthday$/i, "")
      .replace(/\u2019s\s+birthday$/i, "") // curly apostrophe
      .trim();

    if (!name) continue;

    // DTSTART can be YYYYMMDD or YYYY-MM-DD, possibly with VALUE=DATE: prefix
    const dateStr = dtstart.replace(/^VALUE=DATE:?/i, "").trim();
    const parsed = parseDateString(dateStr);
    if (!parsed) continue;

    results.push({ name, month: parsed.month, day: parsed.day });
  }

  return results;
}

export function parseCsv(text: string): ParsedBirthday[] {
  const results: ParsedBirthday[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return results;

  // Find columns from header
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name" || h === "friend" || h === "full name");
  if (nameIdx === -1) return results;

  // Facebook format: separate Month and Day columns
  const monthIdx = header.indexOf("month");
  const dayIdx = header.indexOf("day");

  // Single date column format
  const bdayIdx = header.findIndex(
    (h) => h === "birthday" || h === "date" || h === "birthday date" || h === "birth date"
  );

  if (monthIdx === -1 && dayIdx === -1 && bdayIdx === -1) return results;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const name = cols[nameIdx]?.trim();
    if (!name) continue;

    let month: number | undefined;
    let day: number | undefined;

    if (monthIdx !== -1 && dayIdx !== -1) {
      // Separate month/day columns (Facebook export format)
      month = parseInt(cols[monthIdx]?.trim(), 10);
      day = parseInt(cols[dayIdx]?.trim(), 10);
    } else if (bdayIdx !== -1) {
      // Single date column
      const parsed = parseDateString(cols[bdayIdx]?.trim());
      if (parsed) {
        month = parsed.month;
        day = parsed.day;
      }
    }

    if (!month || !day || isNaN(month) || isNaN(day)) continue;
    results.push({ name, month, day });
  }

  return results;
}

function extractField(block: string, field: string): string | null {
  // Handle both "FIELD:value" and "FIELD;params:value", with possible line folding
  const regex = new RegExp(`^${field}[;:](.*)`, "im");
  const match = block.match(regex);
  if (!match) return null;

  let value = match[1];
  // iCal parameter stripping: "VALUE=DATE:20000315" → "20000315"
  const colonIdx = value.indexOf(":");
  if (colonIdx !== -1 && /^[A-Z-]+=/.test(value)) {
    value = value.substring(colonIdx + 1);
  }

  // Unfold continuation lines (lines starting with space or tab)
  return value.replace(/\r?\n[ \t]/g, "").trim();
}

function parseDateString(s: string): { month: number; day: number } | null {
  // YYYYMMDD
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return { month: parseInt(m[2], 10), day: parseInt(m[3], 10) };

  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return { month: parseInt(m[2], 10), day: parseInt(m[3], 10) };

  // MM/DD/YYYY or MM/DD
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
  if (m) return { month: parseInt(m[1], 10), day: parseInt(m[2], 10) };

  // Month Day (e.g. "March 15")
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  m = s.match(/^([a-z]+)\s+(\d{1,2})/i);
  if (m && months[m[1].toLowerCase()]) {
    return { month: months[m[1].toLowerCase()], day: parseInt(m[2], 10) };
  }

  return null;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
