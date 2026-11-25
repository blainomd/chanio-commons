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
  notPaidWork: true,
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

// Not paid work (2026-11-25): with no word, or a word that is not exactly true, a proposal is refused.
const noWord = makeProposal({ ...good, notPaidWork: false });
check(!("not_paid_work" in noWord) && proposalProblems(at(noWord), noWord).some((x) => /^no not_paid_work: true/.test(x)), "refused: a proposal without the not_paid_work word");
for (const v of ["yes", "true", 1, false]) {
  const p = { ...ex, not_paid_work: v };
  check(proposalProblems(at(p), p).some((x) => /not_paid_work that is not true/.test(x)), `refused: a not_paid_work of ${JSON.stringify(v)}`);
}
const r0 = spawnSync(process.execPath, [path.join(ROOT, "tools", "propose.mjs"), "--claim", good.claim, "--source", `${good.sources[0].url}@2026-11-24`, "--verdict", "CONFIRMED", "--finding", good.finding, "--words", good.words.join(",")], { encoding: "utf8" });
check(r0.status === 2 && /add --not-paid-work/.test(r0.stderr) && !fs.existsSync(at(ex)), "propose.mjs writes nothing without --not-paid-work", r0.stderr);

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
const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "chanio-commons-"));
fs.cpSync(ROOT, tmp2, { recursive: true, filter: (s) => !s.includes(`${path.sep}.git`) });
const words2 = path.join(tmp2, "starter", "common-words.txt");
const had = fs.existsSync(words2);
if (had) fs.appendFileSync(words2, "notaword\n");
const r2 = spawnSync(process.execPath, [path.join(tmp2, "tools", "check.mjs")], { encoding: "utf8" });
check(had && r2.status === 1 && /FAIL rules\/\.\.\/starter\/common-words\.txt is the recorded copy/.test(r2.stdout), "refused: starter/ edited without the sync", r2.stdout.slice(-300));
fs.rmSync(tmp2, { recursive: true, force: true });

// The rules run here exactly as they run on chanio.com: rules/check.mjs reads ../starter/common-words.txt and
// ../starter/members.mjs, so both sit at those paths. Without the word list a claim chanio.com accepts is refused here.
const { pathToFileURL } = await import("node:url");
let R = null; try { R = await import(pathToFileURL(path.join(ROOT, "rules", "check.mjs")).href); } catch (e) { R = null; }
check(!!R, "rules/check.mjs loads");
check(R?.COMMON_WORDS?.size === 10000, "the rules read the same 10,000 common English words chanio.com does (starter/common-words.txt)", R?.COMMON_WORDS?.size ?? "no word list");
check(R?.standsAlone?.("Sourdough starters need feeding every day at room temperature") === true, "a claim chanio.com accepts stands alone here too (needs the word list)");

// Giving: a gift is signed with a member key, and two reviewers from two groups accept it, never today.
let M = null; try { M = await import(pathToFileURL(path.join(ROOT, "starter", "members.mjs")).href); } catch { M = null; }
const GIVE = !!R && ["giftProblems", "giftSigProblems", "giftHash", "acceptProblems", "entryFromGift"].every((x) => typeof R[x] === "function");
check(!!M && GIVE, "starter/members.mjs loads, and the rules have the gift and review checks");
check(Array.isArray(R?.REVIEWERS) && R.REVIEWERS.length === 0 && Object.isFrozen(R.REVIEWERS), "REVIEWERS is empty and frozen (who reviews is the members' choice, once there are members)");
if (M && GIVE) {
  const mk = async () => { const k = await M.makeBrowserKey(); return { key: k.key, sign: M.browserSigner(k.privateKey) }; };
  const [rootK, giver, r1, r2, r3] = [await mk(), await mk(), await mk(), await mk(), await mk()];
  const roots = [rootK.key];
  const card = M.extendCard(M.rootCard(rootK.key), await M.makeVouch(await M.makeRequest(giver.key, giver.sign, "2026-11-24"), rootK.key, rootK.sign, "2026-11-24"));
  const b = { v: 1, type: "gift", q: "Which license covers the structured data in Wikidata?", answer: "All structured data in the main, property and lexeme namespaces of Wikidata is under CC0.", sources: [{ url: "https://www.wikidata.org/wiki/Wikidata:Licensing" }], lang: "en", date: "2026-11-24", key: giver.key, not_paid_work: true, passion: { key: "open-data" }, card };
  const gift = { ...b, sig: await giver.sign(M.message("gift", b)) };
  const CLAIM = "All structured data in Wikidata is available under the Creative Commons CC0 license";
  const review = async (who) => { const x = { v: 1, type: "review", gift: await R.giftHash(gift), verdict: "CONFIRMED", claim: CLAIM, finding: "The licensing page says structured data in the main, property and lexeme namespaces is under CC0.", date: "2026-11-25", key: who.key }; return { ...x, sig: await who.sign(M.message("review", x)) }; };
  const REV = [{ key: r1.key, group: "a" }, { key: r2.key, group: "b" }, { key: r3.key, group: "a" }];
  const sig = await R.giftSigProblems(gift, { roots });
  check(sig.length === 0, "a signed gift from a vouched member passes its signature check", sig.join("; "));
  const today = await R.acceptProblems(gift, [await review(r1), await review(r2)], { roots });
  check(today.length === 1 && /until reviewers exist/.test(today[0]), "nothing is accepted today, because REVIEWERS is empty", today.join("; "));
  const ok = await R.acceptProblems(gift, [await review(r1), await review(r2)], { reviewers: REV, roots });
  check(ok.length === 0, "control: two test reviewers from two groups accept a good gift (so the rule can say yes)", ok.join("; "));
  const one = await R.acceptProblems(gift, [await review(r1), await review(r3)], { reviewers: REV, roots });
  check(one.some((x) => /all from one group/.test(x)), "refused: two reviewers from one group", one.join("; "));
  const self = await R.acceptProblems(gift, [await review(giver), await review(r2)], { reviewers: [...REV, { key: giver.key, group: "c" }], roots });
  check(self.some((x) => /cannot review their own gift/.test(x)), "refused: the giver reviewing their own gift", self.join("; "));
  // Not paid work (2026-11-25): the giver's word sits inside the signed gift; without it, two reviewers cannot accept it.
  const nb = { ...b }; delete nb.not_paid_work;
  const noWord = { ...nb, sig: await giver.sign(M.message("gift", nb)) };
  const rv = async (who) => { const x = { v: 1, type: "review", gift: await R.giftHash(noWord), verdict: "CONFIRMED", claim: CLAIM, finding: "The licensing page says structured data in the main, property and lexeme namespaces is under CC0.", date: "2026-11-25", key: who.key }; return { ...x, sig: await who.sign(M.message("review", x)) }; };
  const nw = await R.acceptProblems(noWord, [await rv(r1), await rv(r2)], { reviewers: REV, roots });
  check(nw.some((x) => /^no not_paid_work: true/.test(x)), "refused: a gift without the giver's not_paid_work word, even with two reviewers", nw.join("; "));
} else check(false, "the gift and review checks ran (NOT CHECKED is never a pass)");

// The published file: published/v1.json is the exact commons file chanio.com serves, the one Blaine approved by its
// sha256 (2026-11-24). It passes the rules, it is the recorded copy, and an edit to it without the sync fails.
const PUB = path.join(ROOT, "published", "v1.json");
const pubOk = fs.existsSync(PUB);
check(pubOk, "published/v1.json is here (the commons file chanio.com serves)");
if (pubOk && R) {
  const doc = JSON.parse(fs.readFileSync(PUB, "utf8"));
  const p = R.commonsProblems(doc);
  check(p.length === 0 && (doc.entries || []).length > 0, `the published file passes the rules (${(doc.entries || []).length} entries)`, p.slice(0, 3).join("; "));
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), "chanio-commons-"));
  fs.cpSync(ROOT, tmp3, { recursive: true, filter: (s) => !s.includes(`${path.sep}.git`) });
  const pubCopy = path.join(tmp3, "published", "v1.json");
  fs.writeFileSync(pubCopy, fs.readFileSync(pubCopy, "utf8").replace(/"verdict": ?"WRONG"/, '"verdict":"CONFIRMED"'));
  const r3 = spawnSync(process.execPath, [path.join(tmp3, "tools", "check.mjs")], { encoding: "utf8" });
  check(r3.status === 1 && /FAIL published\/v1\.json is the recorded copy/.test(r3.stdout), "refused: the published file edited without the sync (a WRONG verdict turned CONFIRMED)", r3.stdout.slice(-300));
  fs.rmSync(tmp3, { recursive: true, force: true });
} else check(false, "the published-file checks ran (NOT CHECKED is never a pass)");

// And the repo as it stands passes.
const live = spawnSync(process.execPath, [path.join(ROOT, "tools", "check.mjs")], { encoding: "utf8" });
check(live.status === 0, "the repo as it stands passes tools/check.mjs", live.stdout.slice(-300));

console.log(fails ? `\n${fails} FAILED` : "\nall checks of the check pass");
process.exit(fails ? 1 : 0);
