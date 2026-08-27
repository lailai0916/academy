# Domain Context

## Content identity

A stable learning object keyed across imports and revisions. Learning cards attach to the content
identity so non-semantic corrections do not discard a student's progress.

## Content version

An immutable, reviewed snapshot of one content identity. It contains the textbook metadata,
canonical payload, source, lifecycle status and semantic fingerprint at a specific revision number.

## Published version

The content version visible to students and eligible for plans. A newer draft can coexist with the
published version until an administrator approves it.

## Content decision

The administrator action recorded by a content version: import, edit, publish, archive, restore or
seed. Each decision records its actor, time and optional reason.

## Import batch

One reviewed set of content mutations with source, edition, preview fingerprint and per-item
results. A rollback is a compensating decision; it never deletes the original audit record.

## Learning card

The student's FSRS state for one content identity. Publishing a version with a changed semantic
fingerprint resets that card; non-semantic changes preserve it.

## Study session

An ordered learning task that pins every content identity to the exact content version shown. Later
administrative edits cannot change its prompts, answers or result history.

## Review event

An immutable answer record attached to both a learning card and the content version used for the
question. An answer to a superseded version remains in history but does not update current mastery.
