#!/usr/bin/env node
// tools/propose.mjs: write one proposal from what you read, with its id worked out for you, then check it.
//
//   node tools/propose.mjs \
//     --claim "One sentence that stands on its own, about a thing, not a person" \
//     --source https://example.org/page@2026-11-24 [--source ...] \
//     --verdict CONFIRMED|PARTLY|WRONG \
//     --finding "What the sources say, in your words" \
//     --words three,or-more,match-words \
//     --not-paid-work \
//     [--checked 2026-11-24]
//
// --not-paid-work is your word that this was not made as paid work for anyone, and not under a promise to keep it
// confidential. Without it nothing is written: the commons takes neither.
//
// It writes proposals/<id>.json and prints every reason it may not stand. Nothing is sent anywhere: you open the pull
// request yourself, from your own account.
import fs from "node:fs";
import path from "node:path";
import { makeProposal, proposalProblems, ROOT } from "./proposals.mjs";

const args = process.argv.slice(2);
const one = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const all = (k) => args.flatMap((a, i) => (a === `--${k}` ? [args[i + 1]] : []));
const today = new Date().toISOString().slice(0, 10);

const sources = all("source").map((s) => {
  const at = s.lastIndexOf("@");
  return at > 8 ? { url: s.slice(0, at), fetched: s.slice(at + 1) } : { url: s, fetched: today };
});
if (!one("claim") || !sources.length || !one("verdict") || !one("finding") || !one("words")) {
  console.error("usage: node tools/propose.mjs --claim \"...\" --source <url>@<YYYY-MM-DD> --verdict CONFIRMED|PARTLY|WRONG --finding \"...\" --words a,b,c --not-paid-work");
  process.exit(2);
}
if (!args.includes("--not-paid-work")) {
  console.error("Not written. The commons takes only what was not made as paid work for anyone, and not under a promise to keep it\nconfidential. If that is true of this answer, add --not-paid-work; if it is not, it stays with you.");
  process.exit(2);
}
const p = makeProposal({
  claim: one("claim"), sources, verdict: one("verdict"), finding: one("finding"),
  words: one("words").split(",").map((w) => w.trim()).filter(Boolean), checked: one("checked") || today, notPaidWork: true,
});
const file = path.join(ROOT, "proposals", `${p.id}.json`);
const problems = proposalProblems(file, p);
if (problems.length) {
  console.log(`Not written. ${problems.length} reason(s) it may not stand:`);
  for (const x of problems) console.log(`  - ${x}`);
  process.exit(1);
}
fs.writeFileSync(file, JSON.stringify(p, null, 2) + "\n");
console.log(`Written: ${path.relative(ROOT, file)}\nNext: commit it on a branch and open a pull request from your own account.`);
