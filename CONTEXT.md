# Domain Context

## Subject

One of the six Zhejiang Gaokao areas served by Academy: Chinese, mathematics, English, physics,
chemistry or technology. A subject groups courses and memory modules but does not prescribe one
shared teaching method for all of them.

## Course

A reviewed sequence that teaches a bounded subject goal through prerequisite checks, explanations,
questions, practice, an independent assessment and later retesting. Course teaching has its own
state and must not be represented as an FSRS learning card.

## Course goal

An observable ability that the student should demonstrate independently. Goals connect curriculum
scope, prerequisites, teaching steps, assessment evidence and later review.

## Lesson step

One reviewed unit inside a course, such as a prerequisite check, explanation, worked example,
question, practice item or assessment. A lesson step has a stable position even when the student
opens and later closes a question branch.

## Lesson run

One student's resumable progress through a course. It records the current step, answers,
assistance and assessment evidence without changing the reviewed course definition.

## Question branch

A student-initiated discussion attached to a lesson step. Closing the branch returns the student to
the same course position.

## Assistance record

The hints, explanations or revealed answers used before an answer. It is part of the evidence used
to distinguish guided success from independent mastery.

## Learning evidence

An immutable observation from an answer, assessment or delayed retest. Plans may use evidence to
choose later work, but generated explanations do not rewrite the reviewed answer or score rule.

## Plan task

One schedulable course, assessment or memory-review task. The planning module composes these task
kinds while preserving the state and completion rules of their source modules.

## Memory training

The existing vocabulary and classical-poetry subsystem. It uses active recall, mistakes, delayed
tests and FSRS scheduling for repeatable memory items. It remains part of Academy but is not the
model for continuous subject courses.

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

The student's FSRS state for one repeatable memory content identity. Publishing a version with a
changed semantic fingerprint resets that card; non-semantic changes preserve it. Course goals and
lesson progress use course evidence instead of learning cards.

## Study session

An ordered memory-training task that pins every content identity to the exact content version shown.
An incorrect item can return once after at least two intervening retrievals; later administrative
edits cannot change its prompts, answers or result history. A continuous course uses a lesson run.

## Review event

An immutable answer record attached to both a learning card and the content version used for the
question. An answer to a superseded version remains in history but does not update current mastery.

## Authentication session

One revocable browser login stored as a hashed random token. Students can inspect masked device and
network details, revoke another session, or invalidate every other session by changing the password.

## Learning profile

The student's current grade, exam-score target and daily item capacity. A new account must complete
this profile before entering the learning workspace so plans and diagnostics do not start from silent
defaults.
