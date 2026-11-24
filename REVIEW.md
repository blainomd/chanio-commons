# Reviewing a gift

A gift is one question and the answer that came back, which a person picked from their own chanio and signed with their
member key. Nothing in a gift is accepted until people review it. The rules below are code in
`rules/check.mjs` (`giftProblems`, `giftSigProblems`, `acceptProblems`, `entryFromGift`). This page says the same
thing in words, and where they differ, the code is the rule.

## What a gift is

```
{ v: 1, type: "gift", q, answer, sources: [{ url }], lang, date, key, sig, passion?, grew_from?, card? }
```

- `q` and `answer` are plain text. The giver's own Mac kept the gift home if it held a name, a health or crisis word, a
  key, an email or a phone number, or had no public source (`chanio give`). The same text rules run here again.
- `sources` are addresses only. The giver's Mac never fetches a page, so it never says when one was read. The day a
  reviewer reads it is the day the entry records.
- `key` and `sig` are the giver's member key and its signature over the gift. `card`, if there is one, is the chain of
  in-person vouches that makes the key a member.
- `passion` is the topic the gift belongs to: lower-case words joined by hyphens, and a Wikidata id where one exists.

## What a review is

```
{ v: 1, type: "review", gift, verdict, claim, finding, date, key, sig }
```

- `gift` is the sha256 of the gift exactly as it was signed. A review of a gift that changed afterwards counts for nothing.
- `claim` is one sentence that stands on its own, written by the reviewer from the gift. `verdict` is CONFIRMED, PARTLY
  or WRONG, and `finding` says what the sources say. A checked-and-wrong answer is worth keeping.
- The reviewer signs it with their own member key.

## When a gift becomes an entry

All of these, or it does not:

1. The gift passes the text rules, and its signature checks out against its key.
2. The giver is a member: a card whose vouches lead back to a root key.
3. Two reviewers from the list of reviewers each signed a review of this exact gift.
4. The two come from two different groups. Groups are made of people who usually disagree: an answer stands when people
   who usually disagree agree on it.
5. Neither reviewer is the giver.
6. The two agree on the verdict and on the claim.
7. The entry it makes passes every entry rule.

## Who reviews

Nobody yet. The list of reviewers (`REVIEWERS` in `rules/check.mjs`) is empty, and so is the list of root keys
(`ROOTS` in `rules/members.mjs`). So today no gift is accepted, and no key is a member. The members will decide who
reviews, one member one vote, once there are members. Nothing about that exists yet.

`tools/check.test.mjs` and chanio.com's `tests/commons.test.mjs` show the rule saying yes. Given two test reviewers from
two groups, a good gift is accepted, so "nothing is accepted" comes from the empty list, not from a broken rule. Each way
a gift should fail, it fails for its own reason. These include:

- one review, or the same reviewer twice;
- two reviewers from one group;
- the giver reviewing their own gift;
- a reviewer who is not on the list;
- a review of another gift, or a review signed by someone else;
- reviewers who disagree.
