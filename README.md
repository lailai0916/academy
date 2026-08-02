<div align="center">
  <h1>lailai's Academy</h1>
  <p><strong>English</strong> · <a href="README.zh-Hans.md">简体中文</a></p>
  <p>
    <img
      src="https://img.shields.io/github/actions/workflow/status/lailai0916/academy/deploy.yml?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/last-commit/lailai0916/academy?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/languages/top/lailai0916/academy?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/repo-size/lailai0916/academy?style=flat-square"
    />
    <img
      src="https://img.shields.io/badge/code_style-prettier-ff69b4?style=flat-square"
    />
    <img
      src="https://img.shields.io/github/license/lailai0916/academy?style=flat-square"
    />
  </p>
</div>

## Project Introduction

`lailai's Academy` is a personal learning workspace that turns long-term goals into daily
practice through a dashboard, review modules, and a local AI-planner preview.

## Project Features

🧭 **Daily dashboard** — Keep the next small set of learning tasks visible and editable.

🧠 **Planner preview** — Turn a learning goal into a short, clearly marked local plan.

📖 **Learning modules** — Switch between Words, Poems, and Review without leaving the workspace.

💾 **Local persistence** — Store task progress in the browser through `localStorage`.

🌐 **Bilingual interface** — Use English by default or switch to Simplified Chinese in place.

🚀 **GitHub Pages deployment** — Build with Vite and publish through GitHub Actions.

## Getting Started

Clone the repository, initialize the skill submodule, and install dependencies:

```bash
git clone https://github.com/lailai0916/academy.git
cd academy
git submodule update --init
npm install
npm run dev
```

Build and preview the GitHub Pages version locally:

```bash
VITE_BASE_PATH=/academy/ npm run build
npm run preview
```

The deployed app is available at [lailai0916.com/academy](https://lailai0916.com/academy/).

## Project Structure

```bash
academy/
├── .github/                        # GitHub collaboration and deployment workflows
│   └── workflows/                  # GitHub Actions deployment workflow
│       └── deploy.yml              # Build and publish the Vite app to Pages
├── public/                         # Static assets copied to the deployment root
│   └── brand/                      # Academy brand assets
│       ├── favicon.ico             # Browser icon
│       └── logo.svg                # Academy logo
├── src/                            # React application source
│   ├── App.tsx                     # Dashboard, planner, and learning modules
│   ├── main.tsx                    # React entry point
│   └── styles.css                  # Shared responsive theme styles
├── brand-spec.md                   # Visual tokens and asset inventory
├── index.html                      # Vite HTML entry
├── package.json                    # Scripts and dependencies
└── vite.config.ts                  # Base path and React plugin configuration
```

The planner currently generates a local preview. A future API can be connected through
`VITE_API_BASE_URL`; secrets must stay on a server-side boundary.

## License

This project's code is licensed under [MIT License](https://github.com/lailai0916/tools/blob/main/LICENSE).
