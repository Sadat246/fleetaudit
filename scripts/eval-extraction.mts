// Runs every test document through the AI and compares with expected.json.
// Costs about 1–2 cents per document.
//
// Run:  npm run eval:extract
// (needs ANTHROPIC_API_KEY in .env.local)

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDocument, type Extraction } from '../src/lib/ai/extract';
import { reviewChecks } from '../src/lib/ai/review';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test-fixtures', 'documents');
const TODAY = '2026-11-24';

interface Expected {
  type: Extraction['type'];
  driver: string;
  problems: string[];
  [field: string]: unknown;
}

// How to tell each deliberate problem was caught.
const PROBLEM_PATTERNS: Record<string, RegExp> = {
  'Expires more than 24 months after the exam': /24 months/,
  'Examiner signature missing': /examiner's signature/,
  'Registry number is not 10 digits': /10 digits/,
};

const FIELDS = ['type', 'issued', 'expires', 'examiner', 'nrcme', 'cdlClass', 'endorsements', 'restrictions', 'sigReviewer'] as const;

const expected: Record<string, Expected> = JSON.parse(readFileSync(path.join(DIR, 'expected.json'), 'utf8'));

let fieldsRight = 0;
let fieldsTotal = 0;
let problemsCaught = 0;
let problemsTotal = 0;
let falseAlarms = 0;

for (const [file, want] of Object.entries(expected)) {
  const started = Date.now();
  const jpeg = readFileSync(path.join(DIR, file));
  const got = await extractDocument(new Uint8Array(jpeg).buffer, TODAY);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  const misses: string[] = [];
  for (const f of FIELDS) {
    if (!(f in want)) continue;
    fieldsTotal++;
    const a = JSON.stringify(got[f]);
    const b = JSON.stringify(want[f]);
    if (a === b) fieldsRight++;
    else misses.push(`${f}: got ${a}, want ${b}`);
  }
  // Name: the last name must appear in what was read.
  fieldsTotal++;
  const last = want.driver.split(' ').pop()!.toLowerCase();
  if (got.driverName?.toLowerCase().includes(last)) fieldsRight++;
  else misses.push(`driverName: got ${JSON.stringify(got.driverName)}, want ${JSON.stringify(want.driver)}`);

  const [first, lastName] = want.driver.split(' ');
  const checks = reviewChecks(got, { first, last: lastName }).join(' | ');
  for (const p of want.problems) {
    problemsTotal++;
    if (PROBLEM_PATTERNS[p].test(checks)) problemsCaught++;
    else misses.push(`problem not flagged: ${p}`);
  }
  if (want.problems.length === 0 && checks) {
    falseAlarms++;
    misses.push(`false alarm: ${checks}`);
  }

  console.log(`${misses.length ? '✗' : '✓'} ${file}  (${secs}s)`);
  for (const m of misses) console.log(`    ${m}`);
}

console.log(`\nFields read correctly: ${fieldsRight}/${fieldsTotal} (${Math.round((100 * fieldsRight) / fieldsTotal)}%)`);
console.log(`Problems caught:       ${problemsCaught}/${problemsTotal}`);
console.log(`False alarms:          ${falseAlarms}`);
