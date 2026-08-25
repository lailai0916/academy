# lailai's Academy Design System

## Product Intent

Academy is a Chinese high-school self-study platform. It should feel credible, precise, and calm.
The interface serves learning decisions; it does not motivate through slogans or explain obvious UI.

## Visual Direction

- Use the system font stack and one restrained blue accent.
- Use solid neutral surfaces, fine separators, and measured contrast.
- Use Lucide outline icons throughout the product.
- Do not use gradients, translucent cards, playful education fonts, or saturated palettes.
- Do not use giant marketing headlines or whole-card hover movement.
- Light, dark, and system themes must preserve the same hierarchy.

## Information Architecture

Academy has two distinct surfaces:

1. Public website: product scope, learning system, method, community, login, and invite registration;
2. Authenticated application: daily plan, learning, social features, profile, settings, and admin.

The public root route is `/`. The learning dashboard is `/dashboard`. Login and registration are
standalone forms and never double as the product homepage.

## Public Website

- Header height: `60px`; content width: `1120px` maximum.
- Keep the hero to a moderate two-column layout with a real product preview.
- Headline maximum: `3.35rem` desktop and `2.75rem` mobile.
- State product scope directly: textbook version, available subjects, and learning metrics.
- Use sections only when they add new information.
- Keep calls to action limited to login and invite registration.

## Authenticated Application

- Sidebar width: `220px`; application content width: `1080px` maximum.
- Page titles use `1.75–2.1rem`; section titles use `17px`.
- Navigation labels are nouns: Today, Learn, Classmates, Profile, Admin, and Settings.
- Dashboard prioritizes today's plan, long-term metrics, and recent results.
- Theme preferences live in Settings; the sidebar does not contain a theme card.
- Desktop uses the sidebar; mobile uses a `64px` header and four-item bottom navigation.

## Components

- Panels use a `1px` separator and `10–16px` radius according to hierarchy.
- Buttons use direct verbs and no promotional text.
- Empty states name what is absent in one short sentence.
- Forms keep visible labels, inline errors, and concrete recovery steps.
- Metrics use tabular numerals and short definitions.

## Motion

- Control feedback: `140ms`; surface transitions: `220ms`.
- Motion communicates open, close, selection, and progress only.
- Do not animate whole cards or run decorative scroll reveals.
- Respect `prefers-reduced-motion` globally.

## Copy

- Use Simplified Chinese in the product.
- Write direct, professional labels and status text.
- Remove slogans, motivational filler, rhetorical questions, and developer-facing implementation notes.
- Do not tell students what they should feel or restate what the interface already shows.
- Use one product term for each concept across pages and API messages.

## Accessibility and QA

- Text contrast must meet WCAG AA.
- Every control needs a visible focus state and accessible name.
- Mobile touch targets must be at least `44px`.
- Support Chinese input method composition without accidental submission.
- Verify `375px`, `768px`, `1024px`, and `1440px` widths.
- Verify both themes, keyboard navigation, no horizontal overflow, and no console errors.
