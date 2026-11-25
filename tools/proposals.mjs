// tools/proposals.mjs: what a proposal is, and every reason one may not stand.
//
// A proposal is one checked answer, one file: proposals/<id>.json. It is a commons entry exactly as chanio's rules
// define it (rules/check.mjs, copied byte for byte from chanio.com), plus the proposer's word that it is not paid work
// (not_paid_work: true, refused if missing or anything but true; since 2026-11-25), plus two things a proposal must also
// get right: its file is named by its id, and no two proposals carry the same id. The word stays in the proposal file;
// the commons file never carries it (chanio.com commons/next.mjs leaves it behind when it builds the next file).
//
// The rules themselves are never written here. If a proposal should be refused for a reason check.mjs does not know,
// the change belongs in chanio.com's commons/check.mjs, so the commons file, the stage gate and this repo cannot disagree.
import fs from "node:fs";
import path from "node:path";
import { proposalProblems as ruleProblems, entryId } from "../rules/check.mjs";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** Every reason one proposal may not stand. `file` is its path; `seen` is a Set of ids already read. */
export function proposalProblems(file, entry, seen = new Set()) {
  const out = ruleProblems(entry);
  const base = path.basename(file);
  if (!/^c-[0-9a-f]{12}\.json$/.test(base)) out.push(`a file name that is not <id>.json (${base})`);
  else if (entry && entry.id && base !== `${entry.id}.json`) out.push(`a file named ${base} that holds ${entry.id}`);
  if (entry && entry.id) {
    if (seen.has(entry.id)) out.push(`the same entry as another proposal (${entry.id})`);
    seen.add(entry.id);
  }
  return out;
}

/** Reads every proposals/*.json under `dir` and returns [{ file, problems }]. */
export function checkDir(dir = path.join(ROOT, "proposals")) {
  const seen = new Set();
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const file = path.join(dir, f);
    let entry;
    try { entry = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { file, problems: [`not JSON: ${e.message}`] }; }
    return { file, problems: proposalProblems(file, entry, seen) };
  });
}

/** Builds a proposal from what a person read. The id is computed, never typed. not_paid_work is written only when the
 *  person gave their word (notPaidWork: true); without it the proposal is refused. */
export function makeProposal({ claim, sources, verdict, finding, words, checked, lang = "en", notPaidWork = false }) {
  const by = "a reviewer who read the cited source";
  const p = {
    id: entryId(claim, sources.map((s) => s.url)),
    claim, lang, verdict, finding, sources,
    checked_by: by, checked,
    history: [{ date: checked, verdict, by }],
    words,
  };
  if (notPaidWork === true) p.not_paid_work = true;
  return p;
}
