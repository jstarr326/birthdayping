/**
 * Match Facebook birthday names against existing contacts.
 *
 * Three tiers:
 *  - exact:  full name matches (case-insensitive)
 *  - close:  common variations (nickname ↔ full name, missing middle name)
 *  - unmatched: no plausible match found
 */

import type { Contact } from "./db";
import type { ParsedBirthday } from "./ics-parser";

export type MatchResult = {
  exact: { birthday: ParsedBirthday; contact: Contact }[];
  close: { birthday: ParsedBirthday; contact: Contact; reason: string }[];
  unmatched: ParsedBirthday[];
};

// Common English nickname → canonical mappings (bidirectional)
const NICKNAME_MAP: Record<string, string[]> = {
  michael: ["mike", "mikey"],
  mike: ["michael"],
  mikey: ["michael"],
  william: ["will", "bill", "billy", "liam"],
  will: ["william"],
  bill: ["william"],
  billy: ["william"],
  liam: ["william"],
  robert: ["rob", "bob", "bobby", "robbie"],
  rob: ["robert"],
  bob: ["robert"],
  bobby: ["robert"],
  robbie: ["robert"],
  richard: ["rick", "dick", "rich"],
  rick: ["richard"],
  dick: ["richard"],
  rich: ["richard"],
  james: ["jim", "jimmy", "jamie"],
  jim: ["james"],
  jimmy: ["james"],
  jamie: ["james"],
  john: ["jack", "johnny", "jon"],
  jack: ["john"],
  johnny: ["john"],
  jon: ["john"],
  jonathan: ["jon", "john", "johnny"],
  joseph: ["joe", "joey"],
  joe: ["joseph"],
  joey: ["joseph"],
  thomas: ["tom", "tommy"],
  tom: ["thomas"],
  tommy: ["thomas"],
  david: ["dave", "davey"],
  dave: ["david"],
  davey: ["david"],
  daniel: ["dan", "danny"],
  dan: ["daniel"],
  danny: ["daniel"],
  matthew: ["matt", "matty"],
  matt: ["matthew"],
  matty: ["matthew"],
  christopher: ["chris"],
  chris: ["christopher", "christian", "christine", "christina"],
  christian: ["chris"],
  elizabeth: ["liz", "lizzy", "beth", "betty", "eliza"],
  liz: ["elizabeth"],
  lizzy: ["elizabeth"],
  beth: ["elizabeth"],
  betty: ["elizabeth"],
  eliza: ["elizabeth"],
  jennifer: ["jen", "jenny"],
  jen: ["jennifer"],
  jenny: ["jennifer"],
  jessica: ["jess", "jessie"],
  jess: ["jessica"],
  jessie: ["jessica"],
  katherine: ["kate", "kathy", "kat", "katie"],
  catherine: ["kate", "kathy", "kat", "katie", "cathy"],
  kate: ["katherine", "catherine"],
  kathy: ["katherine", "catherine"],
  cathy: ["catherine"],
  kat: ["katherine", "catherine"],
  katie: ["katherine", "catherine"],
  margaret: ["maggie", "meg", "peggy"],
  maggie: ["margaret"],
  meg: ["margaret"],
  peggy: ["margaret"],
  patricia: ["pat", "patty", "trish"],
  pat: ["patricia", "patrick"],
  patty: ["patricia"],
  trish: ["patricia"],
  patrick: ["pat", "paddy"],
  paddy: ["patrick"],
  nicholas: ["nick", "nicky"],
  nick: ["nicholas"],
  nicky: ["nicholas"],
  alexander: ["alex"],
  alexandra: ["alex"],
  alex: ["alexander", "alexandra"],
  benjamin: ["ben", "benny"],
  ben: ["benjamin"],
  benny: ["benjamin"],
  samuel: ["sam", "sammy"],
  sam: ["samuel", "samantha"],
  sammy: ["samuel"],
  samantha: ["sam"],
  anthony: ["tony"],
  tony: ["anthony"],
  andrew: ["andy", "drew"],
  andy: ["andrew"],
  drew: ["andrew"],
  timothy: ["tim", "timmy"],
  tim: ["timothy"],
  timmy: ["timothy"],
  edward: ["ed", "eddie", "ted"],
  ed: ["edward"],
  eddie: ["edward"],
  ted: ["edward", "theodore"],
  theodore: ["ted", "teddy", "theo"],
  theo: ["theodore"],
  teddy: ["theodore"],
  stephen: ["steve"],
  steven: ["steve"],
  steve: ["stephen", "steven"],
  gregory: ["greg"],
  greg: ["gregory"],
  joshua: ["josh"],
  josh: ["joshua"],
  nathaniel: ["nate", "nathan"],
  nathan: ["nate", "nathaniel"],
  nate: ["nathan", "nathaniel"],
  raymond: ["ray"],
  ray: ["raymond"],
  zachary: ["zach", "zack"],
  zach: ["zachary"],
  zack: ["zachary"],
  victoria: ["vicky", "tori"],
  vicky: ["victoria"],
  tori: ["victoria"],
  rebecca: ["becca", "becky"],
  becca: ["rebecca"],
  becky: ["rebecca"],
  christine: ["chris", "tina"],
  christina: ["chris", "tina"],
  tina: ["christine", "christina"],
};

export function matchBirthdays(
  birthdays: ParsedBirthday[],
  contacts: Contact[]
): MatchResult {
  const result: MatchResult = { exact: [], close: [], unmatched: [] };

  // Build lookup: normalized full name → contact
  const byFullName = new Map<string, Contact>();
  // Also index by last name for close matching
  const byLastName = new Map<string, Contact[]>();

  for (const c of contacts) {
    byFullName.set(normalize(c.name), c);
    const last = lastName(c.name);
    if (last) {
      const list = byLastName.get(last) || [];
      list.push(c);
      byLastName.set(last, list);
    }
  }

  for (const bday of birthdays) {
    const normName = normalize(bday.name);

    // 1) Exact match
    const exact = byFullName.get(normName);
    if (exact) {
      result.exact.push({ birthday: bday, contact: exact });
      continue;
    }

    // 2) Close matches
    const closeMatch = findCloseMatch(bday.name, byFullName, byLastName);
    if (closeMatch) {
      result.close.push({
        birthday: bday,
        contact: closeMatch.contact,
        reason: closeMatch.reason,
      });
      continue;
    }

    // 3) Unmatched
    result.unmatched.push(bday);
  }

  return result;
}

function findCloseMatch(
  fbName: string,
  byFullName: Map<string, Contact>,
  byLastName: Map<string, Contact[]>
): { contact: Contact; reason: string } | null {
  const parts = fbName.trim().split(/\s+/);
  const fbFirst = parts[0]?.toLowerCase();
  const fbLast = parts[parts.length - 1]?.toLowerCase();

  // Try nickname variants of first name + same last name
  if (fbFirst && fbLast && parts.length >= 2) {
    const variants = NICKNAME_MAP[fbFirst] || [];
    for (const variant of variants) {
      // Try "variant lastName"
      const key = normalize(`${variant} ${fbLast}`);
      const contact = byFullName.get(key);
      if (contact) {
        return {
          contact,
          reason: `nickname: "${fbFirst}" ↔ "${variant}"`,
        };
      }
    }
  }

  // Try matching without middle name:
  // FB "John Michael Smith" → contact "John Smith"
  if (parts.length > 2) {
    const key = normalize(`${parts[0]} ${parts[parts.length - 1]}`);
    const contact = byFullName.get(key);
    if (contact) {
      return { contact, reason: "middle name omitted in contacts" };
    }
  }

  // Contact has middle name, FB doesn't:
  // FB "John Smith" → contact "John Michael Smith"
  if (parts.length === 2 && fbLast) {
    const candidates = byLastName.get(fbLast) || [];
    for (const c of candidates) {
      const cParts = c.name.trim().split(/\s+/);
      if (
        cParts.length > 2 &&
        cParts[0].toLowerCase() === fbFirst &&
        cParts[cParts.length - 1].toLowerCase() === fbLast
      ) {
        return { contact: c, reason: "middle name omitted on Facebook" };
      }
    }
  }

  // Try without suffixes (Jr., Sr., III, etc.)
  const stripped = fbName.replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "").trim();
  if (stripped !== fbName) {
    const key = normalize(stripped);
    const contact = byFullName.get(key);
    if (contact) {
      return { contact, reason: "suffix variation (Jr/Sr)" };
    }
  }

  return null;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function lastName(name: string): string | null {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? parts[parts.length - 1].toLowerCase() : null;
}
