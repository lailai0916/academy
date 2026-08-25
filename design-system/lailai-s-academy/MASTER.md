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

- Header height: `56px`; content width: `1120px` maximum.
- Brand logos have no border, ring, or decorative shadow.
- Inputs and selects use shared control geometry, a custom chevron, and unified states.
- Keep the hero to a moderate two-column layout with a real product preview.
- Headline maximum: `2.75rem` desktop and `2rem` mobile.
- State product scope directly: textbook version, available subjects, and learning metrics.
- Use sections only when they add new information.
- Keep calls to action limited to login and invite registration.

## Authenticated Application

- The `56px` top bar spans the viewport. It contains location, global search, notifications, theme,
  and account access; it never becomes a second primary navigation row.
- Sidebar width: `240px`; application content width: `1280px` maximum.
- Page titles use `1.75–2.1rem`; section titles use `17px`.
- Group primary navigation by Learning, Community, Account, and System. Do not mix global actions
  into the sidebar.
- Dashboard prioritizes today's plan, current review focus, long-term metrics, recent results, and a
  compact activity trend.
- Global search must return real routes, textbook content, and public profiles. Empty search buttons
  are not permitted.
- Desktop uses the fixed sidebar. Mobile keeps the top bar and opens the same grouped navigation in
  a drawer; do not duplicate page content or force all functions into a bottom bar.

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
