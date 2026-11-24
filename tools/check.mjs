#!/usr/bin/env node
// tools/check.mjs: the check every proposal and every change to this repo has to pass (CI runs it on each pull request).
//
//   node tools/check.mjs            every proposal, and the rules unchanged from the copy recorded in rules/SHA256SUMS
//   node tools/check.mjs --against <path to a chanio.com checkout>
//                                   also: rules/ is byte for byte the same as that checkout's commons/
//
// Exit 0 when everything stands, 1 when something does not.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { checkDir, ROOT } from "./proposals.mjs";

let bad = 0;
const say = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// 1. The rules are the copy this repo says they are. A pull request that edits rules/ without the steward's sync from
//    chanio.com changes a hash here and fails.
const sums = fs.readFileSync(path.join(ROOT, "rules/SHA256SUMS"), "utf8").trim().split("\n").map((l) => l.split(/\s+/));
for (const [want, name] of sums) {
  const got = createHash("sha256").update(fs.readFileSync(path.join(ROOT, "rules", name))).digest("hex");
  say(got === want, `rules/${name} is the recorded copy${got === want ? "" : ` (sha256 ${got.slice(0, 12)}, recorded ${want.slice(0, 12)})`}`);
}

// 2. Optionally, the copy is still what chanio.com runs.
const at = process.argv.indexOf("--against");
if (at > 0) {
  const repo = process.argv[at + 1];
  for (const [, name] of sums) {
    const theirs = path.join(repo, "commons", name);
    const same = fs.existsSync(theirs) && Buffer.compare(fs.readFileSync(theirs), fs.readFileSync(path.join(ROOT, "rules", name))) === 0;
    say(same, `rules/${name} is the same bytes as ${theirs}`);
  }
}

// 3. Every proposal stands.
const results = checkDir();
for (const { file, problems } of results) {
  if (!problems.length) say(true, path.relative(ROOT, file));
  else for (const p of problems) say(false, `${path.relative(ROOT, file)}: ${p}`);
}
console.log(`\n${results.length} proposal(s); ${bad ? `${bad} problem(s)` : "everything stands"}`);
process.exit(bad ? 1 : 0);
