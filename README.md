# lailai's Academy

`lailai's Academy` is a small learning workspace for turning long-term goals into
daily practice.

The v0 includes:

- a daily learning dashboard;
- a local preview of the AI planner flow;
- Words, Poems, and Review module surfaces;
- local task persistence through `localStorage`;
- GitHub Actions deployment to GitHub Pages.

## Development

```bash
npm install
npm run dev
```

For a production-like local build:

```bash
VITE_BASE_PATH=/academy/ npm run build
npm run preview
```

The repository is configured for `lailai0916/academy` and publishes to:

`https://lailai0916.com/academy/`

The default project-page address, `https://lailai0916.github.io/academy/`, redirects
to the same deployment.

## AI boundary

The planner currently generates a clearly marked local preview. A future API can be
connected through `VITE_API_BASE_URL`; secrets must stay on a server-side boundary.

## Design

See [`brand-spec.md`](brand-spec.md) for the visual system and asset inventory.
