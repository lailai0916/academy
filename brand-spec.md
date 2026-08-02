# lailai's Academy — brand spec

## Direction

`lailai's Academy` is a quiet learning workspace: focused enough for daily practice,
but broad enough to hold planning, words, poetry, and future modules.

The first version reuses the visual language of [lailai's Home](https://lailai.one):
clean surfaces, one blue accent, system typography, restrained motion, and system-driven
light/dark appearance.

## Assets

- Logo: `public/brand/logo.svg` (copied from the existing lailai brand asset)
- Favicon: `public/brand/favicon.ico`

## Tokens

- Primary: `#1d9bf0`
- Primary dark: `#0e81d2`
- Light surface: `#ffffff`
- Light canvas: `#f6f8fa`
- Dark surface: `#171b1f`
- Dark canvas: `#101316`
- Large radius: `20px`
- Medium radius: `14px`
- Base spacing: `4px`, composed into an 8-point rhythm
- Display/body font: SF Pro when available, then Inter/system sans-serif

## Interaction rules

- Use border and color changes for cards; no whole-card hover lift.
- Keep motion short and functional: `160–240ms` for feedback and progress.
- Follow `prefers-reduced-motion` through CSS media queries.
- Keep AI responses explicitly marked as local preview until an API is connected.
