/**
 * Gap report: why do 154 high-interaction contacts still have no birthday?
 *
 * Run: node --experimental-strip-types scripts/gap-report.mjs
 *   or: npx tsx scripts/gap-report.mjs
 */

import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "../local.db");
const db = new Database(dbPath);

// ── Load contacts missing birthdays, above threshold ──
const settings = db.prepare(`SELECT * FROM settings WHERE user_id = ?`)
  .get("c0fdee0f-078f-4cc4-933e-3aada8a53445");
const threshold = settings?.threshold ?? 0.3;

const missing = db.prepare(`
  SELECT * FROM contacts
  WHERE user_id = ? AND (has_birthday = 0 OR birthday_date IS NULL)
  ORDER BY score DESC
`).all("c0fdee0f-078f-4cc4-933e-3aada8a53445");

const aboveThreshold = missing.filter(c => c.score >= threshold);

console.log(`\nContacts missing birthday: ${missing.length} total, ${aboveThreshold.length} above threshold (>=${threshold})\n`);

// ── Load Facebook CSV ──
const csv = readFileSync(resolve(__dirname, "../facebook-birthdays.csv"), "utf8");
const lines = csv.split(/\r?\n/).filter(l => l.trim());

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

const header = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
const nameIdx = header.indexOf("name");
const monthIdx = header.indexOf("month");
const dayIdx = header.indexOf("day");

const fbPeople = [];
for (let i = 1; i < lines.length; i++) {
  const cols = splitCsvLine(lines[i]);
  const name = cols[nameIdx]?.trim();
  const month = parseInt(cols[monthIdx]?.trim(), 10);
  const day = parseInt(cols[dayIdx]?.trim(), 10);
  if (name && month && day) fbPeople.push({ name, month, day });
}

console.log(`Facebook birthdays loaded: ${fbPeople.length}\n`);

// ── Build indexes for fuzzy search ──
const normalize = s => s.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

// Index FB names by each word
const fbByWord = new Map();
for (const fb of fbPeople) {
  const words = normalize(fb.name).split(" ");
  for (const w of words) {
    if (w.length < 2) continue;
    if (!fbByWord.has(w)) fbByWord.set(w, []);
    fbByWord.get(w).push(fb);
  }
}

// ── Categorize each missing contact ──
const notOnFacebook = [];
const possibleMatch = [];

for (const contact of aboveThreshold) {
  const cNorm = normalize(contact.name);
  const cWords = cNorm.split(" ");

  // Find all FB people sharing at least one name-word
  const candidates = new Set();
  for (const w of cWords) {
    if (w.length < 2) continue;
    const hits = fbByWord.get(w) || [];
    for (const fb of hits) candidates.add(fb);
  }

  if (candidates.size === 0) {
    notOnFacebook.push(contact);
    continue;
  }

  // Score each candidate: count shared words
  let best = null;
  let bestScore = 0;
  const fbNormCache = new Map();

  for (const fb of candidates) {
    if (!fbNormCache.has(fb)) fbNormCache.set(fb, normalize(fb.name).split(" "));
    const fbWords = fbNormCache.get(fb);

    let shared = 0;
    for (const cw of cWords) {
      if (fbWords.includes(cw)) shared++;
    }
    // Fraction of contact words matched
    const score = shared / Math.max(cWords.length, fbWords.length);
    if (score > bestScore) {
      bestScore = score;
      best = fb;
    }
  }

  possibleMatch.push({
    contact,
    bestFb: best,
    bestScore,
    sharedWords: bestScore,
    totalCandidates: candidates.size,
  });
}

// Sort possible matches by score descending (most plausible first)
possibleMatch.sort((a, b) => b.bestScore - a.bestScore);

// ── Report ──
console.log("═══════════════════════════════════════════════════");
console.log("  GAP REPORT: Why no birthday?");
console.log("═══════════════════════════════════════════════════\n");

console.log(`  Not on Facebook (no name overlap at all):  ${notOnFacebook.length}`);
console.log(`  Possible match (shared first/last name):   ${possibleMatch.length}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  Total above threshold missing birthday:     ${aboveThreshold.length}\n`);

// ── Not on Facebook ──
console.log("── NOT ON FACEBOOK ──────────────────────────────");
console.log("   (No Facebook friend shares any part of this name)\n");
for (const c of notOnFacebook) {
  const scoreStr = (c.score * 100).toFixed(0).padStart(3);
  console.log(`   ${scoreStr}%  ${c.name}  (${c.total_messages} msgs)`);
}

// ── Possible matches ──
console.log("\n── POSSIBLE MATCH, DIFFERENT NAME ───────────────");
console.log("   (Shares first or last name but wasn't auto-matched)\n");

const showCount = Math.min(possibleMatch.length, 30);
console.log(`   Showing top ${showCount} of ${possibleMatch.length} by match quality:\n`);
console.log("   Score  Contact                    Best FB Match                 Birthday   Why not matched");
console.log("   ─────  ─────────────────────────  ────────────────────────────  ─────────  ───────────────");

for (let i = 0; i < showCount; i++) {
  const { contact, bestFb, bestScore, totalCandidates } = possibleMatch[i];
  const score = (bestScore * 100).toFixed(0).padStart(4) + "%";
  const cName = contact.name.padEnd(25).slice(0, 25);
  const fbName = bestFb.name.padEnd(28).slice(0, 28);
  const bday = `${String(bestFb.month).padStart(2)}/${String(bestFb.day).padStart(2, "0")}`;

  // Figure out WHY it wasn't matched
  const cWords = normalize(contact.name).split(" ");
  const fbWords = normalize(bestFb.name).split(" ");
  const sharedFirst = cWords[0] === fbWords[0];
  const sharedLast = cWords[cWords.length - 1] === fbWords[fbWords.length - 1];

  let reason = "";
  if (sharedFirst && !sharedLast) reason = "same first, diff last";
  else if (!sharedFirst && sharedLast) reason = "diff first, same last";
  else if (sharedFirst && sharedLast) reason = "same first+last, diff middle";
  else reason = "partial overlap only";

  console.log(`   ${score}  ${cName}  ${fbName}  ${bday.padEnd(9)}  ${reason} (${totalCandidates} candidates)`);
}

// ── Breakdown of "possible match" reasons ──
let sameFirstDiffLast = 0;
let diffFirstSameLast = 0;
let sameFirstLast = 0;
let partialOnly = 0;

for (const { contact, bestFb } of possibleMatch) {
  const cWords = normalize(contact.name).split(" ");
  const fbWords = normalize(bestFb.name).split(" ");
  const sf = cWords[0] === fbWords[0];
  const sl = cWords[cWords.length - 1] === fbWords[fbWords.length - 1];
  if (sf && sl) sameFirstLast++;
  else if (sf && !sl) sameFirstDiffLast++;
  else if (!sf && sl) diffFirstSameLast++;
  else partialOnly++;
}

console.log("\n── BREAKDOWN OF POSSIBLE MATCHES ────────────────\n");
console.log(`   Same first + last name (missed by matcher):  ${sameFirstLast}`);
console.log(`   Same first name, different last name:        ${sameFirstDiffLast}`);
console.log(`   Different first name, same last name:        ${diffFirstSameLast}`);
console.log(`   Partial overlap only:                        ${partialOnly}`);

db.close();
