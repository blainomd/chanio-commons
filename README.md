# chanio commons

Ask once, for everyone.

When one person checks an answer, nobody after them should have to ask a big AI the same question again. The chanio
commons is one public file of checked answers. Every chanio downloads it the same way, and each person's own device
matches it to their own notes. Nothing about the person leaves their device to do that.

This repo is where anyone can propose a checked answer and read the rules that judge it.

## What is here

| Folder | What it holds |
|---|---|
| `rules/` | The rules every entry must pass, as code (`check.mjs`), and the shape of the file (`v1.schema.json`). They are a byte-for-byte copy of the rules chanio.com runs; `rules/FROM.txt` says which commit. |
| `starter/` | Two files the rules read, at the same paths as in chanio.com: `members.mjs` (member keys and signatures) and `common-words.txt` (the 10,000 most common English words, which tell a claim that names its subject from one that does not). Copied with the rules and checked by the same hashes. |
| `REVIEW.md` | How a gift (one question and its answer, signed by the person who asked) is reviewed, and when it becomes an entry. |
| `proposals/` | One file per proposed answer, named by its id. Empty until the first proposal is merged. |
| `published/` | The commons file chanio.com serves (`v1.json`), byte for byte, and its sha256 (`SHA256SUMS`). It changes only when a new file is approved by its exact bytes and published there. |
| `examples/` | One worked proposal that passes the rules. |
| `tools/` | `propose.mjs` writes a proposal from what you read; `check.mjs` is what every pull request must pass; `check.test.mjs` proves the check refuses what it should. |

## What a proposal is

One answer a person checked by reading the sources themselves:

- **the claim:** one sentence that stands on its own, about a thing, not a person;
- **the verdict:** CONFIRMED, PARTLY (and which part) or WRONG. A checked-and-wrong answer is worth keeping;
- **the finding:** what the sources say, in your own words;
- **the sources:** public https pages, each with the day you read it;
- **match words:** three or more words a person's notes might use for the same thing.

The id is the hash of the claim and its sources, so it does not change when someone rechecks it later.

## What the rules refuse

A named person, health or crisis content, a price, a claim with no source, a claim that only makes sense in a
conversation ("it was released last week"), a source behind a login or a tracking link, and a language the rules cannot
read yet (English only, for now). The code refuses these, before any person reads the proposal.

## What this repo never holds

Anyone's memory, notes or questions. A name the contributor did not choose to add. Money.

## Taking part

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `node tools/propose.mjs …`, then open a pull request from your own
account. Nothing in this repo sends anything for you.

## Where it stands (2026-11-24)

- **Built:** the rules, the check every pull request runs, and the tool that writes a proposal. On a person's Mac, chanio
  already uses the commons file before any bigger AI: a question the file settles stays home, and one that goes out
  carries what is known so far.
- **Built, and off:** giving. On a Mac, `chanio give` shows one question a bigger AI answered for that person, exactly as
  it would be signed, keeps it home if it holds a name, a health or crisis word, a key or no public source, and signs it
  with their member key only on their yes. It waits on that Mac. Nothing is sent, and nothing is accepted: the rules
  accept a gift only when two reviewers from two groups sign it, and the list of reviewers is empty ([REVIEW.md](REVIEW.md)).
- **Published (2026-11-24):** the first commons file, at chanio.com/commons/v1.json: 139 checked answers (119 confirmed,
  8 in part, 12 wrong), approved by its exact sha256 (543666e1…, in `published/SHA256SUMS`). `published/v1.json` is the
  same bytes.
- **Built (2026-11-25):** the build that reads merged proposals, chanio.com's `commons/next.mjs`. It reads
  `proposals/*.json` from `main` with git, never a working folder or an open pull request. It also reads gifts that two
  reviewers from two groups accepted. Every one is checked again, its `not_paid_work` word included, and the result is a
  staged file that is never served. A new commons file is published only when its exact bytes are approved. No proposal
  has been merged and no reviewer exists yet, so nothing is staged.
- **Planned, with no date:** chanio is meant to belong to the people who use it, one person, one vote, and an AI never
  gets a vote. None of that exists yet: no co-op, nothing to join.

## License

Not chosen yet. This repo stays private until it is. The likely answer is an open-source license for the code and the
CC0 public-domain dedication for entries, so a checked answer can also be given to Wikidata, which takes only CC0.
`starter/common-words.txt` keeps its own license, CC BY-SA 4.0, and names its sources in its first lines.
