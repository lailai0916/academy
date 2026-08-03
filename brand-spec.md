# lailai's Academy — brand spec

## Direction

`lailai's Academy` is a quiet learning workspace: focused enough for daily practice,
but broad enough to hold planning, words, poetry, and future modules.

The workspace follows the visual language already used across lailai's sites: a centered
top navigation, compact page headers, a small Bento grid for the desk view, and solid
catalog-style cards. It uses a neutral Apple-inspired system: cool white and near-black
surfaces, system typography, restrained motion, and a small blue action accent.

The reference vocabulary is intentionally shared rather than decorative:

- Personal site: centered Bento composition and compact brand navigation.
- lailai's Tools: four-column utility cards with icon chips and restrained borders.
- GFSSM: concise in-app headers, predictable form spacing, and quiet application chrome.

## Assets

- Logo: `public/brand/logo.svg` (copied from the existing lailai brand asset)
- Favicon: `public/brand/favicon.ico`

## Tokens

- Primary: `#0071e3`
- Primary dark: `#0066cc`
- Light surface: `#ffffff`
- Light canvas: `#f5f5f7`
- Dark surface: `#2c2c2e`
- Dark canvas: `#1c1c1e`
- Large radius: `16px`
- Medium radius: `12px`
- Small radius: `9px`
- Base spacing: `4px`, composed into an 8-point rhythm
- Display/body font: SF Pro when available, then Inter/system sans-serif

## Interaction rules

- Use border and shadow changes for cards; avoid decorative gradients and whole-card hover lifts.
- Keep motion short and functional: `160–240ms` for feedback and progress.
- Follow `prefers-reduced-motion` through CSS media queries.
- Keep AI responses explicitly marked as local preview until an API is connected.
