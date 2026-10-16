# ServEm — Functional Requirements

Each requirement is stated as: the action, who may take it, the precondition, and what the
refusal looks like. "Indistinguishable" means the refusal is byte-for-byte the same as the
answer for a thing that does not exist, so it cannot be used to confirm existence.

---

## Accounts and sessions

| ID | Function | Actor | Precondition | Refusal |
|---|---|---|---|---|
| F-A1 | Create an account | anyone | unique email, password ≥ 8 characters | field errors, 400 |
| F-A2 | Sign in | anyone | stored scrypt hash matches | generic 401, never "no such account" |
| F-A3 | Sign in with Google/Apple | anyone | PKCE `state` and `nonce` match, single use | 400 with the reason |
| F-A4 | Sign out | signed-in | — | 401 |
| F-A5 | End other sessions | signed-in | — | 401 |
| F-A6 | Download account data | signed-in | — | 401 |
| F-A7 | Change password | signed-in with a password | current password matches | 400 |

## Customer jobs

| ID | Function | Actor | Precondition | Refusal |
|---|---|---|---|---|
| F-J1 | Create a job (draft) | signed-in | valid facts, category in the registry, city in the coverage list | 400 with field errors |
| F-J2 | Edit a job | the owner | status is draft/open/offer_received | 409 once booked |
| F-J3 | Publish a job | the owner | stored draft re-validates | 409 if already published/booked |
| F-J4 | Cancel a job | the owner | status is editable | 409 once booked; live offers are withdrawn in the same transaction |
| F-J5 | Attach media | the owner | ≤ 6 files, ≤ 3 MB each, allowlisted type, bytes match the declared type, job editable | 400 invalid, 409 too many/in frozen |
| F-J6 | Remove media | the owner | same as F-J5 | 404 for anyone else, 409 once booked |
| F-J7 | Read media | owner, eligible ServMate, assigned ServMate | media authorization follows the job | 404, indistinguishable from absent |

## Discovery and offers

| ID | Function | Actor | Precondition | Refusal |
|---|---|---|---|---|
| F-D1 | List eligible jobs | ServMate | active profile, category match, area match, no block, job open and unexpired | empty feed, never a filtered leak |
| F-D2 | Filter the feed | ServMate | filters apply to the authorized set only | an over-broad filter returns fewer rows, never more |
| F-D3 | Read a job's detail | owner, eligible ServMate, assigned ServMate | as F-D1 | 404, identical to absent |
| F-D4 | Submit an offer | eligible ServMate | job open, not the owner, no live offer on that job | 404 ineligible, 409 already offered |
| F-D5 | Withdraw an offer | the offering ServMate | offer pending | 404 |
| F-D6 | Decline an offer | the job's owner | offer pending, job not booked | 404/409 |
| F-D7 | Accept an offer | the job's owner | offer pending, provider still eligible | 409, or 201 with a booking |
| F-D8 | Change a job's category | the owner | job editable | pending offers become `category_changed`, never deleted |

Accepting an offer is one transaction: the booking is written with a frozen snapshot of the
amount, scope and schedule, the other live offers are withdrawn, and the job is booked.

## Bookings and reviews

| ID | Function | Actor | Precondition | Refusal |
|---|---|---|---|---|
| F-B1 | Start work | the assigned ServMate | status `confirmed` | 404 for anyone else, 409 in the wrong state |
| F-B2 | Report work finished | the assigned ServMate | status `in_progress` | as F-B1 |
| F-B3 | Confirm completion | the booking's customer | status `completion_pending` | as F-B1; the ServMate cannot skip the customer |
| F-B4 | Cancel a booking | the booking's customer | status open | 409 once completed |
| F-B5 | Review the work | the booking's customer | status `completed`, not already reviewed | 404 for anyone else, 409 for a second review, 400 for a rating outside 1–5 |

## Provider console

| ID | Function | Actor | Precondition | Refusal |
|---|---|---|---|---|
| F-P1 | Enable capability | signed-in | — | idempotent |
| F-P2 | Update profile facts | ServMate | own profile; lengths and area validated | 400 field errors, 403 without capability |
| F-P3 | Save categories and coverage | ServMate | every id in the registry | 400 |
| F-P4 | Create a listing | ServMate | valid facts | 400; created as a draft |
| F-P5 | Edit a listing | the owner | valid facts | 404 for another provider; never touches an agreed booking |
| F-P6 | Publish/withdraw a listing | the owner | exists | 404 |
| F-P7 | Delete a listing | the owner | no live booking references it | 409 while work is in progress |
| F-P8 | Add portfolio work | ServMate | title; optional image; optional completed booking that is theirs and completed | 404 for a claim that does not hold, 409 when full |
| F-P9 | Remove portfolio work | the owner | exists | 404 |
| F-P10 | Post/withdraw an update | ServMate | body 1–600 characters | 400 |

## Trust, safety and attention

| ID | Function | Actor | Precondition | Refusal |
|---|---|---|---|---|
| F-T1 | Block an account | signed-in | target exists, not self | 400 self, 404 unknown; idempotent |
| F-T2 | Unblock | the blocker | target exists | 404 |
| F-T3 | List own blocks | the blocker | — | 401 |
| F-T4 | Report an account, job or message | signed-in | exactly one target, known reason; entitled to see the target | 400 invalid, 404 not entitled, 409 duplicate |
| F-T5 | Read own notifications | signed-in | — | 401 |
| F-T6 | Mark read | signed-in | owns the notification | 404 for someone else's |

**A block is symmetric in effect and private in fact.** Once either side blocks the other, the
job disappears from the other's feed and detail — but only the account that placed the block can
see it, and no endpoint answers "who blocked me".

**A report changes nothing about visibility.** It is a record with a status; a moderator decides
what happens next.
