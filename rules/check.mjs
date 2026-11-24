#!/usr/bin/env node
// commons/check.mjs: the rules for chanio's commons file, as code (2026-11-23).
//
// The commons is one public file every chanio downloads the same way (chanio.com/commons/v1.json). It holds checked
// claims: the claim, the verdict, the sources with the day each was fetched, who checked it (a role, never a name) and
// when, and the dated history of its verdicts. It never holds a person, a name, health or crisis content, a price, or a
// venture. Matching it to a person's notes runs on their device.
// Decided 2026-11-23: Obsidian Vault/40-Technology/chanio-pooling-commons-decided-2026-11-23.md ("pull first, give later").
// The entry is the decision note's "living knowledge ledger": a claim, its evidence, a verdict, and its changes over time.
// Its id is the hash of the claim and its source addresses, so it stays the same when a recheck changes the verdict: the
// later idle-Mac rechecks (Ring 2 in that note, not built) refer to an entry by it and append to its history.
//
// This one file is used by:
//   - tests/commons.test.mjs (the stage gate): broken samples must fail here first, then any public/commons/v1.json must
//     pass and carry the approval named in commons/approved.json;
//   - chanio-core/commons-seed.mjs: each ledger row is kept only if entryProblems() finds nothing.
// So the seed and the gate can never disagree. The shape is also written down in commons/v1.schema.json.
//
//   node commons/check.mjs <file.json>     prints each problem; exit 1 if there is one, 0 if none
import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const VERSION = 1;
// PARTLY: part of the claim holds; the finding says which part. WRONG entries stay in, as "checked and wrong".
export const VERDICTS = ["CONFIRMED", "PARTLY", "WRONG"];
// Who checked it: a role, never a name. The first is how the seed's rows were checked (an AI session read the cited page);
// the second is for the review that comes with giving, later.
export const CHECKERS = ["an AI checker that read the cited source", "a reviewer who read the cited source"];
export const STATUSES = ["staged", "published"];
export const MAX_CLAIM = 280;
export const MAX_FINDING = 400;
export const MAX_SOURCES = 4;
export const MAX_ENTRIES = 5000;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (s) => typeof s === "string" && DAY.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// ── What may not be in an entry ──────────────────────────────────────────────────────────────────────────────────────
// The ventures: their names and domains. The family's sites are matched by the surname, so no child's name is listed here.
export const VENTURE_RE = new RegExp(String.raw`\b(?:co-?op\.?\s?care|comfort\s?card|care\s?goals|surgeon\s?value|solving\s?health|clinical\s?swipe|harness\s?health|hash\s?care|joint\s?coach|joint\s?class|chanio|vimty|map\s?of\s?you|altru\.?care|lawyer\s?swipe|medfrail|opusocial|decision\s?index|sh-?room|agentic\s?hsa|fall\s?risks?|fill\s?forward|arthritis\s?risk|hsa\s?letter|siphon\s?book|msk\s?value|bundled\s?care|onco\s?que|policy\s?app|store\s?my\s?cells|save\s?my\s?cells|surgical\s?track|surgery\s?process|enough\s?to\s?last|family\s?care\s?give|quality\s?death|careho\.?me|health\s?gait|healthyho\.?me|carescircle|blainomd|idealab|pristine surgical|brainlab|careos|wonder\s?bill|warkentine|kinematic\s?joint|kinetic\s?first|motion\s?sole|bio\s?sole|sof\s?pulse|heal\s?without|savedchat|openpatient|orthoinjury|orthoharness|myon\.clinic|hot4two|sweat\s?sciences|floor\s?pricer|soldit4less|phoenix\s?pharma|philaestateplan|customed)\b|\b[a-z0-9-]+\.(?:help)\b`, "i");

// Health, and what sits next to it (care, coverage, benefits): chanio is memory, never health. Broad on purpose.
export const HEALTH_RE = new RegExp(String.raw`\b(?:health\w*|medic\w*|clinic\w*|patients?|hospitals?|hospice|physicians?|doctors?|nurs(?:e|es|ing)|surg(?:ery|eries|eon|eons|ical)|diagnos\w*|symptoms?|diseases?|disorders?|illness\w*|syndromes?|cancer\w*|tumou?rs?|oncolog\w*|chemo\w*|diabet\w*|insulin|glucose|a1c|cholesterol|blood|cardi(?:ac|ology|ologist|ovascular)|heart (?:attacks?|disease|failure)|strokes?|dementia|alzheimer\w*|parkinson\w*|depress(?:ion|ed|ive)|anxiety|mental|psychiatr\w*|psycholog\w*|psychotherap\w*|therap(?:y|ies|ist|ists|eutic)|counsel+ing|adhd|autis\w*|bipolar|ptsd|schizo\w*|eating disorders?|anorexi\w*|bulimi\w*|addict\w*|rehab\w*|alcoholi\w*|sobriety|opioids?|overdos\w*|drugs?|pharma\w*|prescri\w*|doses?|dosage|pills?|vaccin\w*|virus(?:es)?|viral load|infect(?:ion|ions|ious|ed)|pandemic|covid\w*|sars|influenza|pregnan\w*|abortion|fertility|ivf|miscarriage|newborns?|disabilit\w*|wheelchairs?|caregiv\w*|home care|long-term care|elder care|nursing homes?|assisted living|medicare|medicaid|obamacare|hipaa|protected health information|wellness|weight loss|obesity|ozempic|wegovy|glp-1|semaglutide|tirzepatide|calories|nutrition\w*|diet(?:s|ary|ing)?|sleep apnea|insomnia|pain|injur(?:y|ies|ed)|fractures?|arthritis|joints? (?:pain|replacement)|knees?|hips?|spinal|spine|bones?|muscles?|brains?|neuro\w*|genom\w*|genes?|genetic\w*|dna|crispr|stem cells?|biopsy|lab results?|x-rays?|ct scans?|ultrasound|ambulances?|emergency rooms?|life expectancy|mortality|deaths?|dying|died|end of life|euthanasia|organ (?:donors?|donation|transplants?)|transplant\w*|dialysis|kidneys?|liver|lungs?|asthma|copd|allerg\w*|epilep\w*|seizures?|migraines?|concussions?|lupus|sclerosis|hepatitis|longevity|elderly|seniors?|outpatient|inpatient|ambulatory|orthop\w*|arthroplast\w*|implants?|prosthe\w*|stryker|medtronic|zimmer biomet|mako robot\w*|blue cross|blue shield|payers?|payors?|insurers?|health plans?|hosp(?:\.|ital)?|older adults|care at home|aging in place|live independently|personal care|homemaker|wearables?|esc congress|medtech|biotech|med-?devices?|circulation|guidelines? for|medlm|medgemma|med-?palm|novitas\w*|noridian|palmetto gba)\b`, "i");
export const HEALTH_ACRONYM_RE = new RegExp(String.raw`\b(?:WHO|AIDS|HIV|CHIP|ACA|CMS|FDA|CDC|NIH|HHS|PHI|STDs?|STIs?|HSAs?|FSAs?|LMNs?|ICU|ER|BMI|MRI|OCD|Part [A-D]|MA(?= (?:plans?|enrollees?|enrollment))|ASCs?|HOPDs?|MedPAC|MACRA|MIPS|CMMI|CMIT|THA|TKA|PROMs?|PRO-PMs?|IBX|EHRs?|EMRs?|NPIs?|CPT|ICD-?10|DRGs?|AHA|ASN|CKM|JACC|AMA|AAP|ACOG|USPSTF|CFC|HCBS|PACE|ABA)\b`);

// Crisis: always kept out, whatever else the entry says.
export const CRISIS_RE = /\b(?:suicid\w*|self[- ]?harm\w*|kill(?:ing|ed)? (?:my|your|him|her|them)sel(?:f|ves)|end(?:ing)? (?:my|your|their) (?:own )?li(?:fe|ves)|988|crisis (?:text )?lines?|hotlines?|lifeline|samaritans|abuse\w*|assault\w*|rape|domestic violence|trafficking|self-injur\w*)\b/i;

// A price, or any amount of money: chanio sells nothing, and the commons carries no figure that reads like an offer.
export const PRICE_RE = /[$€£¥₹₩]\s?\d|\d\s?(?:usd|eur|gbp|dollars?|cents?|bucks|euros?|pounds sterling)\b|\b(?:prices?|priced|pricing|costs? (?:\$|about|around|roughly|nearly|over|under)|per (?:month|year|hour|seat|user|token)s?|\/mo\b|\/yr\b|subscriptions?|discount\w*|for free|free (?:trial|tier|plan)|fees?\b|tuition|salar(?:y|ies)|wages?|paid \$|paycheck|dollars?|stipends?|\/month|\/year|a month\b|monthly fee|pay monthly|grant-funded)/i;

// A person. Names are hard to see in code, so four nets, each strict, and the review is the fifth:
//  1. a title or honorific before a capitalised word;
//  2. a citation shape: "Surname (2024)", "Surname et al.", "Zhu, Long, and Ort";
//  3. a capitalised word that says, tells, writes or argues something (an organisation that "says" drops too; strict on purpose);
//  4. a common first name followed by a capitalised word.
// The seed adds a sixth, on the Mac only: every name in the vault's 10-People folder (never written into any file).
export const TITLE_RE = /\b(?:(?:Dr|Mr|Mrs|Ms|Mx|Prof|Sen|Rep|Gov|Sir|Dame|Rev|Hon|Capt|Lt|Sgt)\.?|President|Vice President|Governor|Senator|Congress(?:man|woman)|Representative|Secretary|Chancellor|Minister|Prime Minister|Mayor|Judge|Justice|Pope|CEO|CFO|CTO|COO|founder|co-founder|cofounder|chairman|chairwoman|author|professor|economist|scientist|researcher|investor|billionaire|entrepreneur|journalist|reporter|analyst|actor|actress|singer|rapper|athlete|lawyer|attorney|commissioner|director)\s+(?:of\s+[A-Z][\w&.-]*\s+)?[A-Z][a-z]{2,}/;
// A surname of any length before "et al." ("Li et al." passed the three-letter form, 2026-11-23).
export const CITE_RE = /\b[A-Z][a-z]*(?:-[A-Z][a-z]*)?\s+et al\b|\b[A-Z][a-z]{2,}(?:\s+et al\.?|\s+\((?:19|20)\d{2}[a-z]?\)|\s+(?:and|&)\s+[A-Z][a-z]{2,}\s+\(?(?:19|20)\d{2}|,\s+[A-Z][a-z]{2,},?\s+(?:and|&)\s+[A-Z][a-z]{2,}|,\s+(?:[A-Z][a-z]+\s+)?[A-Z][a-z]{1,},\s+[A-Z][a-z]{1,})|\b[A-Z][a-z]{2,}(?:'s)?\s+(?:op-ed|essay|memo|tweet|keynote|newsletter|substack)\b|\b[A-Z][a-z]{2,}'s\s+\*|^[A-Z][a-z]{2,}['’]s\s+(?:article|post|essay|paper|book|talk|piece|thread|video|newsletter|blog|interview|podcast)\b|\b[A-Z][a-z]{2,}\s+(?:himself|herself)\b|^[A-Z][a-z]{2,}:\s+[a-z]|^[A-Z][a-z]{2,}\s+(?:19|20)\d{2}[,:]|\b[A-Z][a-z]{2,}\s+&\s+[A-Z][a-z]{2,}\b|\b[A-Z][a-z]{2,}\s+\((?:who|whose)\b|\b(?:by|with|from|interviewing)\s+[A-Z][a-z]{2,}\s+[A-Z][a-z]{1,}(?:\s|$|[,.;)])/;
// A handle: "(gakonst, Oct 21)", "(mohit67890)", "@someone" (an npm scope like @firebase/x and JSON-LD's @context are not).
export const HANDLE_RE = /\(\s*[a-z][a-z0-9_-]{2,}\d*\s*[,)]|(?:^|[\s(])@(?!context\b)[A-Za-z0-9_]{2,}(?![\/.\w])/;
export const SAID_RE = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\s+(?:said|says|told|tells|wrote|writes|tweeted|posted|argued|argues|claimed|claims|believes|believed|predicted|predicts|warned|warns|thinks|thought|testified|admitted|recalled|insisted)\b/;
// Role nouns before a name, any case ("Authors Osmani", "single author, Shangding Gu", "economist Daron Acemoglu").
export const ROLE_RE = /\b(?:[Aa]uthors?|[Ff]ounders?|[Cc]o-?founders?|[Pp]rofessors?|[Ee]conomists?|[Ss]cientists?|[Rr]esearchers?|[Ii]nvestors?|[Bb]illionaires?|[Ee]ntrepreneurs?|[Jj]ournalists?|[Rr]eporters?|[Hh]osts?|[Gg]uests?|[Ss]peakers?|[Ww]riters?|[Ee]ditors?|[Cc]reators?|[Dd]evelopers?|[Ee]ngineers?|[Dd]esigners?|[Mm]aintainers?|[Pp]artners?)(?:\s+of\s+[A-Z][\w&.-]*)?,?\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)?(?![a-z])/;
// People in the news often enough to be named by surname alone. A net, not a list of everyone: the review is the last one.
export const SURNAMES = ("trump biden obama nixon reagan clinton kennedy carter eisenhower roosevelt truman harris vance newsom desantis pelosi mcconnell schumer sanders warren musk altman amodei zuckerberg bezos nadella pichai huang gates wozniak dorsey andreessen thiel hinton lecun bengio sutskever karpathy hassabis suleyman yudkowsky bostrom kurzweil buffett dimon powell yellen bessent lutnick makary kennedy acemoglu krugman summers solow keynes friedman hayek kahneman tversky taleb pinker harari gladwell godin ostrom cahn habermas brockman murati hoffman benioff ellison zaharia stoica chiang osmani cherny newman grennan rogowsky guilluy schwartz saraev brackett katz wojcik tessler schmidt walling vollset jain greiler gross lin gerstner hinojosa blanchflower bejan gilovich medvec runta singh tan neal shahab overton sacks stout einstein feynman turing shannon licklider engelbart memex bush sam elon dario satya sundar jensen").split(" ");
const SURNAME_RE = new RegExp(String.raw`\b(?:${[...new Set(SURNAMES)].filter((w) => !["memex", "sam", "elon", "dario", "satya", "sundar", "jensen"].includes(w)).map((w) => w[0].toUpperCase() + w.slice(1)).join("|")})(?:'s)?\b`);
// A claim must stand on its own: one that opens on "it", "his" or "the model" means something only next to its source.
export const DEICTIC_RE = /^(?:it|its|it's|this|that|these|those|they|them|their|his|her|he|she|we|our|you|your|one person|someone|the (?:\w+ )?(?:model|study|paper|episode|drop|post|author|authors|company|firm|issue|report|book|video|talk|transcript|interview|speaker|host|guest|article|piece|thread|tweet|site|app|tool|product|agent|list|figure|number|claim|same|page|program|service|vendor|platform|matrix|router|team|matrix's))\b|\b(?:today|tonight|yesterday|tomorrow|this (?:week|month|morning)|last (?:week|night)|next week|right now)\b/i;
// A claim must name what it is about: a capitalised word or an acronym after its first word, or a first word that is not
// common English (starter/common-words.txt, the first 10,000). "Up to 15 active tasks at once" says nothing alone.
export const COMMON_WORDS = (() => {
  try {
    const set = new Set(); let i = 0;
    for (const l of fs.readFileSync(new URL("../starter/common-words.txt", import.meta.url), "utf8").split("\n")) { const w = l.trim(); if (!w || w.startsWith("#")) continue; if (i++ >= 10000) break; set.add(w.toLowerCase()); }
    return set.size > 5000 ? set : null;
  } catch { return null; }
})();
export function standsAlone(claim) {
  const words = String(claim || "").match(/[A-Za-z][A-Za-z0-9'’.&-]*/g) || [];
  if (words.length < 5) return false;
  if (words.slice(1).some((w) => /^[A-Z]/.test(w))) return true;
  return !!COMMON_WORDS && !COMMON_WORDS.has(words[0].toLowerCase().replace(/['’]s$/, ""));
}
const URL_IN_TEXT_RE = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.|\b[a-z0-9-]+\.(?:com|org|net|io|ai|app|dev|co|me|care|help)\b/i;
const MARKDOWN_RE = /\*\*|`|\[\[|\]\(/;
// A pointer to where it was checked from rather than to the world: an internal brief or note number, a line of a file.
const POINTER_RE = /\b(?:brief|note|row|drop|item|card|ticket)\s?#\s?\d{3,}|\(lines? \d+(?:\s?[-–]\s?\d+)?\)/i;
// PT for physical therapy, a physical therapist (not a time zone: "10 AM PT", "9:30 PT"). Added 2026-11-23, when a row on
// "PT hiring markets" and "1 in 7 PTs" passed every other health check.
export const PT_RE = /\bPTs\b|(?<!\d(?::\d\d)?\s?(?:[AaPp]\.?[Mm]\.?\s?)?)\bPT\b/;
// Social-media posts and profiles: their address names the author, and a post is one person's word, not a public page
// that can be rechecked.
export const SOCIAL_HOSTS = /(?:^|\.)(?:linkedin\.com|x\.com|twitter\.com|instagram\.com|facebook\.com|fb\.com|tiktok\.com|threads\.net|bsky\.app)$/i;
const PASTE_RE = /\b(?:the (?:drop|paste|transcript|estate|portfolio|vault)|drop's|paste's|transcript says)\b/i;
export const FIRST_NAMES = ("aaron abigail adam adrian aidan aisha alan albert alex alexander alexandra alexis alice alicia alison allison amanda amelia amir amy ana andre andrea andrew andy angela anita ann anna anne anthony antonio ari ariana arjun arthur ashley audrey ava barbara barry ben benjamin bernie beth betty beverly bob bobby bonnie brad bradley brandon brenda brendan brian brittany bruce bryan caleb cameron carl carla carlos carmen carol caroline carolyn casey catherine cathie charles charlie charlotte cheryl chris christian christina christine christopher cindy claire clara claudia colin connor craig cynthia dan dana daniel danielle danny dario daron david dean deborah debra denise dennis derek diana diane diego dmitri dominic don donald donna doris dorothy doug douglas dylan ed eddie edward elaine eleanor elena eli elijah elizabeth ella ellen elon emily emma eric erica erik erin ethan eugene eva evan evelyn fatima felix fernando fiona frances francis frank fred gabriel gary gavin geoffrey george gerald gina glenn gloria gordon greg gregory hannah harold harry heather helen henry henrik howard ian ilya isaac isabel isabella ivan jack jacob jacqueline james jamie jan jane janet janice jared jason javier jean jeff jeffrey jenna jennifer jenny jeremy jerome jerry jesse jessica jesus jill jim jimmy joan joanna joe joel john johnny jon jonathan jorge jose joseph josh joshua joyce juan judith judy julia julian julie justin karen karl kate katherine kathleen kathryn katie keith kelly ken kenneth kevin kim kimberly kyle larry laura lauren lawrence leah lee leo leon leonard linda lisa liz logan lori louis lucas lucy luis luke lynn madison maggie malcolm manuel marc marcus margaret maria marie marilyn mario marissa marjorie martha martin mary mason matt matthew maya megan meghan melanie melissa michael michelle miguel mike mila mohammed monica nancy naomi natalie nathan neil nicholas nick nicole noah nora norman olivia omar oscar owen pamela patricia patrick paul paula peter philip phillip pierre priya rachel rafael ralph ramon randy raul ray raymond rebecca reed regina richard rick rita rob robert roberto robin roger ronald ronnie ruth ryan sally sam samantha samuel sandra sara sarah satya scott sean sergey seth shannon sharon shawn sheila shirley simon sofia sonia sophia stacy stanley stephanie stephen steve steven sue susan sundar suzanne tamara tara ted teresa terry theodore theresa thomas tiffany tim timothy tina todd tom tommy tony tracy travis trevor tyler valerie vanessa vera veronica vicki victor vincent vivian walter wanda warren wayne wendy william willie wilson xavier yasmin yuri zach zachary zoe ankit michaela christophe jediah westlee rahul raj sanjay vikram anil deepak wei chen yuki hiroshi kenji lars sven anders nils mateo santiago lucia giulia marco luca francesca pablo ahmed ali hassan kwame amara bary aman belinda keon garry heidi georgios leopold").split(" ");
const FIRST_SET = new Set(FIRST_NAMES);
export function firstNameHit(text) {
  // A common first name, capitalised, followed by a space or a comma: "Sarah Johnson", "Elon at the G20", "Lawrence, ...".
  const re = /\b([A-Z][a-z]+)(?=[\s,;:)])/g;
  for (let m; (m = re.exec(text)); ) if (FIRST_SET.has(m[1].toLowerCase())) return text.slice(m.index, m.index + m[0].length + 20).trim();
  return null;
}

// What never leaves anyone: an email, a phone number, a key.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?<!\d)(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)/;
const SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|eyJ[A-Za-z0-9_-]{20,}\.)|-----BEGIN [A-Z ]*PRIVATE KEY-----/;
// The words chanio never uses on a page (AGENTS.md rule 12; scripts/cloudrun.sh FORBIDDEN).
const WORDS_RE = /\b(?:free|advance directive|kudos|credits?)\b|WRITE TO FIRESTORE|BURN MANDATE|global_ram|Direct Pipe|1841387625/i;

// Hosts whose pages are about health (a claim read there is kept out even when its own words are not).
export const HEALTH_HOSTS = /(?:^|\.)(?:nih\.gov|cdc\.gov|cms\.gov|fda\.gov|hhs\.gov|medicare\.gov|medicaid\.gov|healthcare\.gov|va\.gov|who\.int|nejm\.org|jamanetwork\.com|thelancet\.com|bmj\.com|nature\.com\/nm|kff\.org|healthaffairs\.org|fiercehealthcare\.com|beckershospitalreview\.com|beckerspayer\.com|statnews\.com|medpagetoday\.com|mayoclinic\.org|webmd\.com|clevelandclinic\.org|hopkinsmedicine\.org|ahrq\.gov|aamc\.org|ama-assn\.org|aarp\.org|medrxiv\.org|biorxiv\.org|cochrane\.org|drugs\.com|goodrx\.com|healthline\.com|psychiatry\.org|nami\.org|samhsa\.gov|988lifeline\.org|cancer\.org|cancer\.gov|heart\.org|diabetes\.org|alz\.org|clinicaltrials\.gov|ncbi\.nlm\.nih\.gov|pubmed\.ncbi\.nlm\.nih\.gov|ajmc\.com)$/i;

/** Every reason a piece of text may not be in the commons. Empty means none. */
export function textProblems(text, { extraNames = [] } = {}) {
  const s = String(text ?? "");
  const out = [];
  const hit = (why, m) => out.push(m ? `${why} — "${String(m).slice(0, 40)}"` : why);
  let m;
  if ((m = s.match(CRISIS_RE))) hit("crisis content", m[0]);
  if ((m = s.match(HEALTH_RE) || s.match(HEALTH_ACRONYM_RE) || s.match(PT_RE))) hit("a health word", m[0]);
  if ((m = s.match(PRICE_RE))) hit("a price or an amount of money", m[0]);
  if ((m = s.match(VENTURE_RE))) hit("names a venture", m[0]);
  if ((m = s.match(TITLE_RE))) hit("a name (a title before it)", m[0]);
  if ((m = s.match(CITE_RE))) hit("a name (a citation)", m[0]);
  if ((m = s.match(SAID_RE))) hit("a name (someone who says)", m[0]);
  if ((m = s.match(ROLE_RE))) hit("a name (a role before it)", m[0]);
  if ((m = s.match(HANDLE_RE))) hit("a name (a handle)", m[0]);
  if ((m = s.match(SURNAME_RE))) hit("a name (a surname)", m[0]);
  if ((m = s.match(PASTE_RE))) hit("refers to the private paste it was checked from", m[0]);
  if ((m = s.match(POINTER_RE))) hit("points at a note or file it was checked from, not at the world", m[0]);
  if ((m = s.match(URL_IN_TEXT_RE))) hit("a web address inside the text (it belongs in sources)", m[0]);
  if ((m = s.match(MARKDOWN_RE))) hit("markdown in the text (plain text only)", m[0]);
  const f = firstNameHit(s);
  if (f) hit("a name (a first name)", f);
  for (const n of extraNames) if (n && new RegExp(`\\b${String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)) { hit("a name (one of the person's contacts)"); break; }
  if ((m = s.match(EMAIL_RE))) hit("an email address");
  if ((m = s.match(PHONE_RE))) hit("a phone number");
  if ((m = s.match(SECRET_RE))) hit("a key or token");
  if ((m = s.match(WORDS_RE))) hit("a word chanio never uses", m[0]);
  return out;
}

/** The entry's id: "c-" and the first 12 hex of sha256 over the trimmed, lower-cased claim and its source addresses,
 *  each address once, sorted, one per line. It names the claim and its evidence only, so a new verdict, finding or
 *  history row leaves it as it was, and the order the sources are listed in does not change it. */
export function entryId(claim, urls) {
  const u = [...new Set((urls || []).map((x) => String(x)))].sort();
  return `c-${createHash("sha256").update([String(claim).trim().toLowerCase(), ...u].join("\n")).digest("hex").slice(0, 12)}`;
}

/** Every reason one source may not stand. A source is a public https page and the day it was fetched. */
export function sourceProblems(src) {
  const out = [];
  if (!src || typeof src !== "object") return ["a source that is not an object"];
  let u = null;
  try { u = new URL(src.url); } catch { /* below */ }
  if (typeof src.url === "string" && /[`'"<>\\^{}|\s]/.test(src.url)) out.push("a source address with a stray character in it");
  if (!u || u.protocol !== "https:") out.push("a source that is not an https address");
  else {
    if (u.username || u.password) out.push("a source address with a login in it");
    if (/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.|\[)|\.(?:local|internal|test|example)$|^example\.(?:com|org|net)$/i.test(u.hostname)) out.push("a source that is not a public page");
    if (HEALTH_HOSTS.test(u.hostname)) out.push(`a source on a health site — ${u.hostname}`);
    else {
      let words = u.pathname;
      try { words = decodeURIComponent(words); } catch { /* as written */ }
      const hm = words.replace(/[-_/.+]+/g, " ").match(HEALTH_RE);
      if (hm) out.push(`a source whose address is about health — "${hm[0]}"`);
    }
    if (SOCIAL_HOSTS.test(u.hostname)) out.push(`a source on a social-media post or profile (its address names the author) — ${u.hostname}`);
    if (VENTURE_RE.test(u.hostname)) out.push(`a source on a venture's own site — ${u.hostname}`);
    if (/[?&](?:utm_|token=|key=|sig=|session|auth)/i.test(u.search)) out.push("a source address that carries a token or tracking");
    if (src.url.length > 500) out.push("a source address over 500 characters");
  }
  if (!realDay(src.fetched)) out.push("a source with no day it was fetched (fetched: YYYY-MM-DD)");
  for (const k of Object.keys(src)) if (!SOURCE_KEYS.includes(k)) out.push(`a source field that is not in v1 (${k})`);
  return out;
}

export const SOURCE_KEYS = ["url", "fetched"];
// One row per check, oldest first: the day, the verdict that check reached, and the checker's role (never a name). The
// seed writes one row; a recheck appends one, and the entry's verdict, checked and checked_by are its last row's.
export const HISTORY_KEYS = ["date", "verdict", "by"];
// 2026-11-23 (Part 1 of the phone door, Obsidian Vault/40-Technology/chanio-everyone-access-decided-2026-11-23.md): every
// entry says the language it is written in, a BCP 47 tag. The name, health and crisis rules here are English word lists,
// so an entry in a language they cannot read is refused rather than let through unread: LANGS grows only when a
// language's own rules exist. The id stays the hash of the claim and its sources (a claim in another language is another
// claim, so it has another id anyway).
export const LANGS = ["en"];
export const LANG_RE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?$/;
export const ENTRY_KEYS = ["id", "claim", "lang", "verdict", "finding", "sources", "checked_by", "checked", "history", "words"];
// 2026-11-24, passions grow together (Obsidian Vault/40-Technology/chanio-passions-grow-together-decided-2026-11-24.md,
// build step 1). Two fields an entry may carry, added to v1 without changing an entry that lacks them:
//   passion    { key, wikidata? }: the passion the entry belongs to. key is lower-case words joined by hyphens
//              ("reverse-engineering"); wikidata is that topic's item id where one exists ("Q217110"). A device shows an
//              entry that has one only when the person's own notes mention it (passionMentioned below); the shared part
//              is public, and which passions a person has never leaves their device.
//   grew_from  the id of the entry in the same file this one grew on: Tuesday's checked question on a passion is the
//              entry Wednesday's question on the same passion grows on. It needs a passion, the same as its parent's.
export const ENTRY_OPTIONAL = ["passion", "grew_from"];
export const PASSION_KEYS = ["key", "wikidata"];
export const PASSION_KEY_RE = /^[a-z0-9]{2,}(?:-[a-z0-9]{2,}){0,3}$/;
export const PASSION_KEY_MAX = 40;
export const WIKIDATA_RE = /^Q[1-9][0-9]{0,9}$/;
export const ENTRY_ID_RE = /^c-[0-9a-f]{12}$/;
const NAME_WORDS = new Set([...FIRST_NAMES, ...SURNAMES]);
/** Every reason a passion may not stand. */
export function passionProblems(p, opts = {}) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return ["a passion that is not an object ({ key, wikidata })"];
  const out = [];
  for (const k of Object.keys(p)) if (!PASSION_KEYS.includes(k)) out.push(`a passion field that is not in v1 (${k})`);
  const key = p.key;
  if (typeof key !== "string" || !PASSION_KEY_RE.test(key) || key.length < 3 || key.length > PASSION_KEY_MAX || !/[a-z]/.test(key)) out.push(`a passion key that is not lower-case words joined by hyphens (3 to ${PASSION_KEY_MAX} letters, up to four words)`);
  else {
    const parts = key.split("-");
    if (parts.some((w) => NAME_WORDS.has(w))) out.push(`passion key: a name (a first name or surname) — "${parts.find((w) => NAME_WORDS.has(w))}"`);
    for (const x of textProblems(parts.join(" "), opts)) out.push(`passion key: ${x}`);
  }
  if ("wikidata" in p && (typeof p.wikidata !== "string" || !WIKIDATA_RE.test(p.wikidata))) out.push("a passion wikidata id that is not an item id (Q and digits)");
  return out;
}
/** Whether a person's own text mentions a passion: the key's words in order, joined by a space, a hyphen or an
 *  underscore, in any case, as whole words (a plural s or es on the last one counts), or the passion's Wikidata id.
 *  The Mac starter (commonsPassionShown) and the notebook (app/lib/commons.ts passionMentioned) run this same rule on
 *  the person's notes, on their device; tests/commons.test.mjs and tests/phone-door.test.mjs run them on the same samples. */
export function passionRe(key) {
  const parts = String(key).split("-").map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  if (!parts.length) return null;
  return new RegExp(`(?<![A-Za-z0-9])${parts.join("[\\s_-]+")}(?:e?s)?(?![A-Za-z0-9])`, "i");
}
export function passionMentioned(passion, text) {
  if (!passion || typeof passion.key !== "string") return false;
  const re = passionRe(passion.key), s = String(text ?? "");
  if (re && re.test(s)) return true;
  return typeof passion.wikidata === "string" && WIKIDATA_RE.test(passion.wikidata) && new RegExp(`(?<![A-Za-z0-9])${passion.wikidata}(?![0-9])`).test(s);
}
/** Every reason one entry may not be in the commons. Empty means it may. */
export function entryProblems(e, opts = {}) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return ["an entry that is not an object"];
  const out = [];
  for (const k of Object.keys(e)) if (!ENTRY_KEYS.includes(k) && !ENTRY_OPTIONAL.includes(k)) out.push(`a field that is not in v1 (${k})`);
  if ("passion" in e) for (const p of passionProblems(e.passion, opts)) out.push(p);
  if ("grew_from" in e) {
    if (typeof e.grew_from !== "string" || !ENTRY_ID_RE.test(e.grew_from)) out.push("a grew_from that is not an entry id (c- and 12 hex)");
    else if (e.grew_from === e.id) out.push("a grew_from that is the entry's own id");
    if (!("passion" in e)) out.push("a grew_from with no passion (an entry grows on one about the same passion)");
  }
  if (typeof e.id !== "string" || !/^c-[0-9a-f]{12}$/.test(e.id)) out.push("no id (c- and 12 hex)");
  else if (typeof e.claim === "string" && Array.isArray(e.sources) && e.sources.every((s) => s && typeof s.url === "string") && e.id !== entryId(e.claim, e.sources.map((s) => s.url))) out.push("an id that is not the hash of its claim and source addresses");
  if (typeof e.claim !== "string" || e.claim.trim().length < 12) out.push("no claim");
  else if (e.claim.length > MAX_CLAIM) out.push(`a claim over ${MAX_CLAIM} characters`);
  else if (DEICTIC_RE.test(e.claim.trim())) out.push("a claim that does not stand on its own (it opens on a pointer such as \"it\" or \"the model\")");
  else if (/^["“‘'][a-z]/.test(e.claim.trim())) out.push("a claim that does not stand on its own (a quoted fragment with nothing it is about)");
  else if (!standsAlone(e.claim)) out.push("a claim that does not stand on its own (under 5 words, or it names nothing)");
  if (typeof e.lang !== "string" || !LANG_RE.test(e.lang)) out.push("no language (lang: a BCP 47 tag such as en)");
  else if (!LANGS.includes(e.lang.split("-")[0])) out.push(`a language these rules cannot read yet (${e.lang}; they read ${LANGS.join(", ")})`);
  if (!VERDICTS.includes(e.verdict)) out.push(`a verdict that is not ${VERDICTS.join(", ")}`);
  if (typeof e.finding !== "string" || !e.finding.trim()) out.push("no finding (what the check found)");
  else if (e.finding.length > MAX_FINDING) out.push(`a finding over ${MAX_FINDING} characters`);
  else if (e.verdict === "PARTLY" && (e.finding.match(/[A-Za-z0-9]+/g) || []).length < 6) out.push("a PARTLY finding that does not say which part (6 words or more)");
  if (!Array.isArray(e.sources) || e.sources.length === 0) out.push("no source");
  else {
    if (e.sources.length > MAX_SOURCES) out.push(`more than ${MAX_SOURCES} sources`);
    e.sources.forEach((s) => sourceProblems(s).forEach((p) => out.push(p)));
  }
  if (!CHECKERS.includes(e.checked_by)) out.push("a checker that is not one of the roles (never a name)");
  if (!realDay(e.checked)) out.push("no day it was checked (checked: YYYY-MM-DD)");
  else if (Array.isArray(e.sources) && e.sources.some((s) => realDay(s?.fetched) && s.fetched > e.checked)) out.push("a source fetched after the day it was checked");
  for (const p of historyProblems(e)) out.push(p);
  if (!Array.isArray(e.words) || e.words.length < 3 || e.words.some((w) => typeof w !== "string" || !/^[a-z0-9][a-z0-9-]{2,30}$/.test(w))) out.push("fewer than 3 match words (lower-case words, 3 to 31 letters)");
  for (const field of ["claim", "finding"]) for (const p of textProblems(e[field], opts)) out.push(`${field}: ${p}`);
  if (Array.isArray(e.words)) for (const p of textProblems(e.words.join(" "), opts)) out.push(`words: ${p}`);
  return out;
}

/** Every reason an entry's history may not stand: none, a row that is not a dated verdict by a role, rows out of date
 *  order, or a last row that is not the entry's own verdict, day checked and checker. */
export function historyProblems(e) {
  const h = e && e.history;
  if (!Array.isArray(h) || h.length === 0) return ["no history (each check: its date, verdict and checker role)"];
  const out = [];
  h.forEach((r, i) => {
    const at = `(row ${i + 1})`;
    if (!r || typeof r !== "object" || Array.isArray(r)) { out.push(`a history row that is not an object ${at}`); return; }
    for (const k of Object.keys(r)) if (!HISTORY_KEYS.includes(k)) out.push(`a history field that is not in v1 (${k}) ${at}`);
    if (!realDay(r.date)) out.push(`a history row with no date ${at}`);
    if (!VERDICTS.includes(r.verdict)) out.push(`a history row whose verdict is not ${VERDICTS.join(", ")} ${at}`);
    if (!CHECKERS.includes(r.by)) out.push(`a history row whose checker is not one of the roles (never a name) ${at}`);
    const prev = i ? h[i - 1] : null;
    if (prev && realDay(prev.date) && realDay(r.date) && r.date < prev.date) out.push(`a history row out of date order ${at}`);
  });
  const last = h[h.length - 1];
  if (last && typeof last === "object") {
    if (VERDICTS.includes(e.verdict) && last.verdict !== e.verdict) out.push("a verdict that disagrees with the last history row");
    if (realDay(e.checked) && last.date !== e.checked) out.push("a last history row whose date is not the day it was checked");
    if (CHECKERS.includes(e.checked_by) && last.by !== e.checked_by) out.push("a last history row whose checker is not checked_by");
  }
  return out;
}

/** The hash the file carries and every chanio recomputes: sha256 of JSON.stringify(entries), hex. */
export function entriesHash(entries) { return createHash("sha256").update(JSON.stringify(entries)).digest("hex"); }

export const TOP_KEYS = ["commons", "version", "status", "built", "count", "entries_sha256", "entries"];
/** Every reason a whole commons file may not stand. */
export function commonsProblems(doc, opts = {}) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["the file is not a JSON object"];
  const out = [];
  for (const k of Object.keys(doc)) if (!TOP_KEYS.includes(k)) out.push(`a top-level field that is not in v1 (${k})`);
  if (doc.commons !== "chanio commons") out.push('commons is not "chanio commons"');
  if (doc.version !== VERSION) out.push(`version is not ${VERSION}`);
  if (!STATUSES.includes(doc.status)) out.push(`status is not ${STATUSES.join(" or ")}`);
  if (!realDay(doc.built)) out.push("no built day (YYYY-MM-DD)");
  if (!Array.isArray(doc.entries)) return [...out, "no entries array"];
  if (doc.entries.length > MAX_ENTRIES) out.push(`more than ${MAX_ENTRIES} entries`);
  if (doc.count !== doc.entries.length) out.push(`count (${doc.count}) is not the number of entries (${doc.entries.length})`);
  if (doc.entries_sha256 !== entriesHash(doc.entries)) out.push("entries_sha256 is not the hash of the entries");
  const ids = new Set();
  doc.entries.forEach((e, i) => {
    for (const p of entryProblems(e, opts)) out.push(`entry ${i + 1}${e && e.id ? ` (${e.id})` : ""}: ${p}`);
    if (e && e.id) { if (ids.has(e.id)) out.push(`entry ${i + 1}: the id ${e.id} is used twice`); ids.add(e.id); }
  });
  // grew_from (2026-11-24): the entry it grew on is in this same file, about the same passion, and following grew_from
  // from any entry ends at one that grew on nothing (no loop).
  const byId = new Map(doc.entries.filter((e) => e && typeof e.id === "string").map((e) => [e.id, e]));
  doc.entries.forEach((e, i) => {
    if (!e || typeof e.grew_from !== "string" || !ENTRY_ID_RE.test(e.grew_from) || e.grew_from === e.id) return;
    const at = `entry ${i + 1}${e.id ? ` (${e.id})` : ""}`;
    const parent = byId.get(e.grew_from);
    if (!parent) { out.push(`${at}: a grew_from that names no entry in this file (${e.grew_from})`); return; }
    if (!parent.passion || !e.passion || parent.passion.key !== e.passion.key) out.push(`${at}: a grew_from whose entry is about another passion (${e.grew_from})`);
    const seen = new Set([e.id]);
    for (let x = parent; x && typeof x.grew_from === "string"; x = byId.get(x.grew_from)) {
      if (seen.has(x.id)) { out.push(`${at}: a grew_from that loops back to itself`); break; }
      seen.add(x.id);
    }
  });
  return out;
}

/* ── Giving, and the review that comes before anything is accepted (2026-11-24) ───────────────────────────────────────
   Build step 2 of Obsidian Vault/40-Technology/chanio-passions-grow-together-decided-2026-11-24.md, and "giving is by
   signature, never automatic" in chanio-pooling-commons-decided-2026-11-23.md. A person picks one question and the answer
   that came back, sees the exact text, and signs it with their member key (starter/members.mjs). Their device runs its
   own filters first (`chanio give` in the starter); this is the commons' own net, the same rules as an entry:

   gift    { v: 1, type: "gift", q, answer, sources: [{ url }], lang, date, key, sig, passion?, grew_from?, card? }
           signed by key over members.mjs message("gift", …). card, when the giver has one, is their member card.
   review  { v: 1, type: "review", gift, verdict, claim, finding, date, key, sig }
           gift is giftHash(the gift); the reviewer writes the claim as one sentence that stands on its own, and the finding.

   A gift becomes an entry only when (acceptProblems is empty):
     - the gift passes giftProblems and its signature checks out, and its giver is a member (a card from a root key);
     - two reviewers listed in REVIEWERS, from two different groups (reviewers who usually disagree: the Community Notes
       bridging rule in the 9/28 note), each signed a review of this exact gift, agreeing on the verdict and the claim;
     - no reviewer is the giver, and the entry it makes passes entryProblems.
   REVIEWERS is empty, so nothing is accepted: who reviews is decided by the members, one member one vote, once there are
   members (ROOTS in starter/members.mjs is empty too). tests/commons.test.mjs shows the rule accepts a good gift when
   reviewers are given to it, so "nothing accepted" is the empty list, not a broken rule. */
export const GIFT_KEYS = ["v", "type", "q", "answer", "sources", "lang", "date", "key", "sig"];
export const GIFT_OPTIONAL = ["passion", "grew_from", "card"];
export const REVIEW_KEYS = ["v", "type", "gift", "verdict", "claim", "finding", "date", "key", "sig"];
export const GIFT_SOURCE_KEYS = ["url"];
export const MAX_Q = 280;
export const MAX_ANSWER = 1500;
/** Who may review, each { key, group }. Empty until the members choose reviewers. */
export const REVIEWERS = Object.freeze([]);
async function membersMod() {
  if (!globalThis.crypto?.subtle) { try { globalThis.crypto = (await import("node:crypto")).webcrypto; } catch { /* below */ } }
  for (const rel of ["../starter/members.mjs", "./members.mjs"]) { try { return await import(new URL(rel, import.meta.url).href); } catch { /* next */ } }
  return null;
}
/** sha256, hex, of the gift as signed (members.mjs canon, sorted keys, its sig included): what a review names. */
export async function giftHash(g) {
  const M = await membersMod();
  return createHash("sha256").update(M ? M.canon(g) : JSON.stringify(g)).digest("hex");
}
/** Every reason a gift's shape and words may not stand (no signature check; giftSigProblems does that). */
export function giftProblems(g, opts = {}) {
  if (!g || typeof g !== "object" || Array.isArray(g)) return ["a gift that is not an object"];
  const out = [];
  for (const k of Object.keys(g)) if (!GIFT_KEYS.includes(k) && !GIFT_OPTIONAL.includes(k)) out.push(`a gift field that is not in v1 (${k})`);
  for (const k of GIFT_KEYS) if (!(k in g)) out.push(`a gift with no ${k}`);
  if (g.v !== 1 || g.type !== "gift") out.push("not a version 1 gift");
  if (typeof g.q !== "string" || g.q.trim().length < 12) out.push("no question (12 characters or more)");
  else if (g.q.length > MAX_Q) out.push(`a question over ${MAX_Q} characters`);
  if (typeof g.answer !== "string" || !g.answer.trim()) out.push("no answer");
  else if (g.answer.length > MAX_ANSWER) out.push(`an answer over ${MAX_ANSWER} characters`);
  if (!Array.isArray(g.sources) || !g.sources.length) out.push("no source (a reviewer reads the answer against its sources)");
  else {
    if (g.sources.length > MAX_SOURCES) out.push(`more than ${MAX_SOURCES} sources`);
    // A gift's source is an address only: the Mac that gives it never fetches the page. The day a reviewer reads it is
    // the entry's "fetched" day (entryFromGift).
    g.sources.forEach((s) => {
      if (!s || typeof s !== "object" || Array.isArray(s)) { out.push("a source that is not an object"); return; }
      for (const k of Object.keys(s)) if (!GIFT_SOURCE_KEYS.includes(k)) out.push(`a gift source field that is not in v1 (${k})`);
      sourceProblems({ url: s.url, fetched: "2000-01-01" }).forEach((p) => out.push(p));
    });
  }
  if (typeof g.lang !== "string" || !LANG_RE.test(g.lang)) out.push("no language (lang: a BCP 47 tag such as en)");
  else if (!LANGS.includes(g.lang.split("-")[0])) out.push(`a language these rules cannot read yet (${g.lang})`);
  if (!realDay(g.date)) out.push("no day it was given (date: YYYY-MM-DD)");
  if ("passion" in g) for (const p of passionProblems(g.passion, opts)) out.push(p);
  if ("grew_from" in g) {
    if (typeof g.grew_from !== "string" || !ENTRY_ID_RE.test(g.grew_from)) out.push("a grew_from that is not an entry id (c- and 12 hex)");
    if (!("passion" in g)) out.push("a grew_from with no passion (an entry grows on one about the same passion)");
  }
  for (const field of ["q", "answer"]) for (const p of textProblems(g[field], opts)) out.push(`${field}: ${p}`);
  return out;
}
/** Every reason the gift's signature or card may not stand. */
export async function giftSigProblems(g, { roots } = {}) {
  const M = await membersMod();
  if (!M) return ["members.mjs could not be loaded, so the signature was not checked"];
  const out = [];
  if (!M.keyOk(g?.key)) return ["the gift's key is not a member key"];
  if (!(await M.verifySig(g.key, M.message("gift", g), g.sig))) out.push("the gift is not signed by its key (or it changed after it was signed)");
  if (!g.card) out.push("the giver is not a member yet (no member card)");
  else {
    if (!M.sameKey(g.card.key, g.key)) out.push("the card is for another key");
    const c = await M.checkCard(g.card, roots || M.ROOTS);
    if (!c.ok) out.push(`the giver is not a member yet (${c.why})`);
  }
  return out;
}
/** The entry an accepted gift becomes: the reviewers' claim and finding, the gift's sources (each fetched on the day of
 *  the last review, since the reviewers read them), its passion and grew_from. */
export function entryFromGift(g, reviews) {
  const r = reviews[reviews.length - 1], day = reviews.map((x) => x.date).sort().pop();
  const e = { id: entryId(r.claim, g.sources.map((s) => s.url)), claim: r.claim, lang: g.lang, verdict: r.verdict, finding: r.finding, sources: g.sources.map((s) => ({ url: s.url, fetched: day })), checked_by: CHECKERS[1], checked: day, history: [{ date: day, verdict: r.verdict, by: CHECKERS[1] }], words: matchWords(r.claim) };
  if (g.passion) e.passion = g.passion;
  if (g.grew_from) e.grew_from = g.grew_from;
  return e;
}
// Words an entry is matched by: the claim's own words that are not everyday English, lower case, up to 12.
function matchWords(claim) {
  const ws = (String(claim).toLowerCase().match(/[a-z0-9][a-z0-9-]{2,30}/g) || []).filter((w) => !COMMON_WORDS || !COMMON_WORDS.has(w));
  return [...new Set(ws)].slice(0, 12);
}
/** Every reason a gift is not accepted into the commons with these reviews. Empty means it is. */
export async function acceptProblems(g, reviews, { reviewers = REVIEWERS, roots, extraNames = [] } = {}) {
  if (!reviewers.length) return ["nothing is accepted until reviewers exist (REVIEWERS is empty)"];
  const out = [...giftProblems(g, { extraNames }), ...(await giftSigProblems(g, { roots }))];
  const M = await membersMod();
  if (!M) return [...out, "members.mjs could not be loaded"];
  const h = await giftHash(g);
  const good = [];
  for (const [i, r] of (Array.isArray(reviews) ? reviews : []).entries()) {
    const at = `review ${i + 1}`;
    if (!r || typeof r !== "object" || Object.keys(r).sort().join() !== [...REVIEW_KEYS].sort().join()) { out.push(`${at}: not a version 1 review`); continue; }
    if (r.v !== 1 || r.type !== "review") { out.push(`${at}: not a version 1 review`); continue; }
    if (r.gift !== h) { out.push(`${at}: it reviews another gift, or this one changed after it was reviewed`); continue; }
    const who = reviewers.find((x) => M.sameKey(x.key, r.key));
    if (!who) { out.push(`${at}: its key is not one of the reviewers`); continue; }
    if (M.sameKey(r.key, g.key)) { out.push(`${at}: the giver cannot review their own gift`); continue; }
    if (!(await M.verifySig(r.key, M.message("review", r), r.sig))) { out.push(`${at}: not signed by its reviewer`); continue; }
    if (!VERDICTS.includes(r.verdict) || !realDay(r.date)) { out.push(`${at}: no verdict or no day`); continue; }
    good.push({ r, group: who.group });
  }
  const keys = new Set(good.map((x) => x.r.key.pub));
  if (keys.size < 2) out.push("fewer than two reviewers signed it");
  else if (new Set(good.map((x) => x.group)).size < 2) out.push("its reviewers are all from one group (it needs two who usually disagree)");
  if (good.length >= 2 && (new Set(good.map((x) => x.r.verdict)).size > 1 || new Set(good.map((x) => x.r.claim)).size > 1)) out.push("its reviewers do not agree on the verdict and the claim");
  if (!out.length) for (const p of entryProblems(entryFromGift(g, good.map((x) => x.r)), { extraNames })) out.push(`the entry it makes: ${p}`);
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const file = process.argv[2];
  if (!file) { console.error("usage: node commons/check.mjs <file.json>"); process.exit(2); }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { console.log(`FAIL ${file}: ${e.message}`); process.exit(1); }
  const problems = commonsProblems(doc);
  for (const p of problems.slice(0, 200)) console.log(`FAIL ${p}`);
  if (problems.length > 200) console.log(`… and ${problems.length - 200} more`);
  console.log(problems.length ? `${problems.length} problem(s) in ${file}` : `ok ${file}: ${doc.count} entries, ${doc.status}, built ${doc.built}`);
  process.exit(problems.length ? 1 : 0);
}
