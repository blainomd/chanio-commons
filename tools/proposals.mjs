// tools/proposals.mjs: what a proposal is, and every reason one may not stand.
//
// A proposal is one checked answer, one file: proposals/<id>.json. It is a commons entry exactly as chanio's rules
// define it (rules/check.mjs, copied byte for byte from chanio.com), plus two things a proposal must also get right:
// its file is named by its id, and no two proposals carry the same id.
//
// The rules themselves are never written here. If a proposal should be refused for a reason check.mjs does not know,
// the change belongs in chanio.com's commons/check.mjs, so the commons file, the stage gate and this repo cannot disagree.
import fs from "node:fs";
import path from "node:path";
import { entryProblems, entryId } from "../rules/check.mjs";

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** Every reason one proposal may not stand. `file` is its path; `seen` is a Set of ids already read. */
export function proposalProblems(file, entry, seen = new Set()) {
  const out = entryProblems(entry);
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

/** Builds a proposal from what a person read. The id is computed, never typed. */
export function makeProposal({ claim, sources, verdict, finding, words, checked, lang = "en" }) {
  const by = "a reviewer who read the cited source";
  return {
    id: entryId(claim, sources.map((s) => s.url)),
    claim, lang, verdict, finding, sources,
    checked_by: by, checked,
    history: [{ date: checked, verdict, by }],
    words,
  };
}
