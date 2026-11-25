# Contributing to the chanio commons

There are three ways to help: propose a checked answer, review one, or improve the tools. All three happen in public,
from your own account.

## Propose a checked answer

You need Node 22 or later and a copy of this repo.

1. **Read the sources yourself.** A proposal says you read each source on the day you give. A model's summary of a page
   is not a reading of it.
2. **Write the proposal.**

   ```bash
   node tools/propose.mjs \
     --claim "One sentence that stands on its own, about a thing, not a person." \
     --source https://example.org/the-page@2026-11-24 \
     --verdict CONFIRMED \
     --finding "What the page says, in your own words." \
     --words three,match,words \
     --not-paid-work
   ```

   `--not-paid-work` is your word that this was not made as paid work for anyone, and not under a promise to keep it
   confidential. Without it, nothing is written. It works out the id, writes `proposals/<id>.json`, and lists every reason
   it may not stand. If it lists any, it writes nothing.
3. **Check the whole repo.** `node tools/check.mjs` must end with "everything stands".
4. **Open a pull request** from your own account, one proposal per pull request.

Prefer the browser? Open an issue with the "Propose a checked answer" form. A maintainer turns it into a proposal file
with the same tool, and your issue is linked from the pull request.

### What gets refused, and why

| Refused | Why |
|---|---|
| A named person, or a title with a name ("Senator …") | The commons is about things, not people. |
| Health or crisis content | Health stays on each person's own device; a crisis gets a person, never a file. |
| A price or a fee | Prices change and sell; the commons does neither. |
| No source, or a source behind a login or with a tracking link | Anyone must be able to read what you read. |
| A claim that opens on "it", "this" or "the model" | A claim must stand on its own, years later, for a stranger. |
| A language other than English, for now | The name, health and crisis rules are English word lists; a language is added when its own rules exist. |
| No `not_paid_work: true`, or anything but `true` | Checked answers made as paid work, or under a promise to keep them confidential, belong by contract to whoever paid. The commons takes only what is yours to give. |

The rules are `rules/check.mjs`. They are a copy of the rules chanio.com runs. To change a rule, propose the change
in chanio.com's `commons/check.mjs`; a pull request here that edits `rules/` without that sync fails `tools/check.mjs`.

## Give a question you asked (on a Mac with chanio)

Built, and off at first. A question a bigger AI answered for you is recorded on your Mac when its answer is filed.

```bash
chanio give on
chanio give list
chanio give 1 --source https://example.org/the-page --passion open-data
```

`chanio give <n>` shows the exact text that would be signed. It keeps the pair home if it holds a name, a health or
crisis word, a key, an email or a phone number, or has no public source. It signs with your member key only when you say
yes in your own terminal, and then the gift waits in `~/chanio/give/queue`. Nothing is sent: there is nowhere to send it
until reviewers exist. Delete the file to take it back.

## Review a proposal

Read the sources. Say in the pull request whether the claim holds, holds in part (and which part), or does not, and why.
Disagreeing is the useful part. A proposal is merged once a reviewer who did not write it has read every source.

### Review a gift

A gift is reviewed by two people from two groups who usually disagree, neither of them the giver, each signing the same
verdict and the same one-sentence claim with their own member key. [REVIEW.md](REVIEW.md) has the shapes and the seven
conditions; `rules/check.mjs` (`acceptProblems`) is the rule. Nobody reviews yet: the list of reviewers is empty, so no
gift is accepted. The members will choose who reviews, once there are members.

## Improve the tools

`tools/` is plain Node with no dependencies. Every change to `tools/check.mjs` comes with a case in
`tools/check.test.mjs` that fails before the change and passes after it.

## Credit

Your account is on your pull request. When chanio's member keys are switched on, an entry can carry the key of the
person who checked it, and their name only if they choose to add it. Credit is a record, never a payment, and nobody
gets better answers for giving: everyone downloads the same file.
