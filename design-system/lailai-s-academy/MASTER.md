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

- Keep the top bar and left navigation as the application frame, but do not reproduce GFSSM's
  hard enterprise grid. GFSSM is an information-architecture reference, not Academy's visual skin.
- The `60px` top bar uses a solid neutral surface and a soft edge. It contains location,
  global search, notifications, theme, and account access; it never becomes a second primary
  navigation row.
- The top bar stays solid and neutral. Current-location text has no colored dot, gradient, or other
  decorative marker.
- The sidebar is an inset `224px` navigation surface with rounded outer corners. It must not use a
  dark decorative shadow, full-height hard divider, or a separate vertical active indicator.
- Application content width: `1240px` maximum, with generous gutters and a quiet reading rhythm.
- Page titles use `1.75–2.1rem`; section titles use `17px`.
- Group primary navigation by Learning, Community, Account, and System. Do not mix global actions
  into the sidebar.
- The sidebar footer contains the logout action only; do not repeat the product description there.
- Dashboard prioritizes today's plan, current review focus, long-term metrics, recent results, and a
  compact activity trend.
- An unfinished learning session appears consistently on the dashboard and learning center with its
  subject, mode, progress, and one direct resume action.
- Academy's identity comes from learning state: due reviews, memory stability, textbook progress,
  and a precise daily-plan completion ring. Generic SaaS metric-card repetition is secondary.
- Global search must return real routes, textbook content, and public profiles. Empty search buttons
  are not permitted.
- Desktop uses the fixed sidebar. Mobile keeps the top bar and opens the same grouped navigation in
  a drawer; do not duplicate page content or force all functions into a bottom bar.

## Components

- Panels use a soft `1px` separator and `12–18px` concentric radius according to hierarchy. Content
  panels stay solid; translucency is reserved for application chrome and overlays.
- Buttons use direct verbs and no promotional text.
- Empty states name what is absent in one short sentence.
- Forms keep visible labels, inline errors, and concrete recovery steps.
- Metrics use tabular numerals and short definitions.
- Learning-session exit distinguishes pause from end. Ending requires a focused confirmation;
  pausing keeps the remaining queue available from the dashboard.

## Motion

- Control feedback: `140ms`; surface transitions: `220ms`.
- Motion communicates open, close, selection, and progress only.
- Do not animate whole cards or run decorative scroll reveals.
- Press feedback may use a subtle `0.98–0.985` scale. Frequently used navigation selection should
  rely on calm color interpolation rather than movement.
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
