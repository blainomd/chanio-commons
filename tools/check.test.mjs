#!/usr/bin/env node
// tools/check.test.mjs: the check must refuse what it is there to refuse, or it proves nothing.
// Each broken sample has to fail, and the worked example has to pass, before CI trusts tools/check.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { makeProposal, proposalProblems, ROOT } from "./proposals.mjs";

let fails = 0;
const check = (ok, what, got = "") => { console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok ? "" : `  — ${String(got).slice(0, 300)}`}`); if (!ok) fails++; };

const good = {
  claim: "All structured data in Wikidata is available under the Creative Commons CC0 license, so anyone may reuse it without asking.",
  sources: [{ url: "https://www.wikidata.org/wiki/Wikidata:Licensing", fetched: "2026-11-24" }],
  verdict: "CONFIRMED",
  finding: "The licensing page says all structured data in the main, property, lexeme and entity-schema namespaces is under CC0; text in the other namespaces is under CC BY-SA.",
  words: ["wikidata", "cc0", "license", "structured-data"],
  checked: "2026-11-24",
};
const at = (p) => path.join(ROOT, "proposals", `${p.id}.json`);

// The worked example passes, and examples/ holds exactly it.
const ex = makeProposal(good);
check(proposalProblems(at(ex), ex).length === 0, "the worked example stands", proposalProblems(at(ex), ex).join("; "));
const exFile = path.join(ROOT, "examples", `${ex.id}.json`);
check(fs.existsSync(exFile) && JSON.stringify(JSON.parse(fs.readFileSync(exFile, "utf8"))) === JSON.stringify(ex), `examples/${ex.id}.json is the worked example`);

// Each of these must be refused.
const refused = [
  ["a claim about a named person", { claim: "Senator Smith voted to fund the library expansion in the spring session of the state legislature." }],
  ["a claim about health", { claim: "Drinking two cups of green tea a day lowers blood pressure in most adults over fifty." }],
  ["a claim that carries a price", { claim: "The annual membership of the public library costs $20 for every adult resident of the county." }],
  ["a claim that does not stand on its own", { claim: "It was released under an open license in the spring." }],
  ["an entry with no source", { sources: [] }],
  ["a source that is not https", { sources: [{ url: "http://www.wikidata.org/wiki/Wikidata:Licensing", fetched: "2026-11-24" }] }],
  ["a source with no day it was read", { sources: [{ url: "https://www.wikidata.org/wiki/Wikidata:Licensing" }] }],
  ["a verdict that is not one of the three", { verdict: "MAYBE" }],
  ["a crisis line", { claim: "The national crisis line answers calls and texts at 988 every hour of every day in the country." }],
];
for (const [what, change] of refused) {
  const p = makeProposal({ ...good, ...change });
  check(proposalProblems(at(p), p).length > 0, `refused: ${what}`, "it stood");
}

// A file not named by its id, and two proposals carrying one id.
check(proposalProblems(path.join(ROOT, "proposals", "c-000000000000.json"), ex).some((x) => /holds/.test(x)), "refused: a file named for another id");
const seen = new Set();
proposalProblems(at(ex), ex, seen);
check(proposalProblems(at(ex), ex, seen).some((x) => /same entry/.test(x)), "refused: the same entry proposed twice");

// An edit to the rules that skips the sync from chanio.com fails tools/check.mjs.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chanio-commons-"));
fs.cpSync(ROOT, tmp, { recursive: true, filter: (s) => !s.includes(`${path.sep}.git`) });
fs.appendFileSync(path.join(tmp, "rules", "check.mjs"), "\n// a quiet edit\n");
const r = spawnSync(process.execPath, [path.join(tmp, "tools", "check.mjs")], { encoding: "utf8" });
check(r.status === 1 && /FAIL rules\/check\.mjs is the recorded copy/.test(r.stdout), "refused: rules/ edited without the sync", r.stdout.slice(-300));
fs.rmSync(tmp, { recursive: true, force: true });

// And the repo as it stands passes.
const live = spawnSync(process.execPath, [path.join(ROOT, "tools", "check.mjs")], { encoding: "utf8" });
check(live.status === 0, "the repo as it stands passes tools/check.mjs", live.stdout.slice(-300));

console.log(fails ? `\n${fails} FAILED` : "\nall checks of the check pass");
process.exit(fails ? 1 : 0);
