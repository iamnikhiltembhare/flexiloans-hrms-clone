# Contributing

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run lint     # oxlint
```

## Branching

- `main` - always builds and runs
- `feat/<short-name>` - new features
- `fix/<short-name>` - bug fixes

Open a pull request into `main`. Keep `npm run build` and `npm run lint` clean.

## Project layout

```
src/
  components/          Layout, Sidebar, Topbar, Logo, Modal, Toast, ui.jsx kit
  context/
    AuthContext.jsx    Session + permission check (can())
    DataContext.jsx    Shared mutable state + toasts + notifications
  data/
    accounts.js        Roles, permissions and seeded logins
    mock.js            All seed data
  lib/download.js      CSV and file download helpers
  pages/               One file per module
    dashboards/        Role-specific dashboards
```

## Conventions

- Plain JSX, no TypeScript. Function components and hooks only.
- Styling is Tailwind utilities plus the component classes in `src/index.css`
  (`.card`, `.btn-primary`, `.input`, `.th`, `.td`, ...). Prefer those over
  ad-hoc colour values so the brand tokens stay in one place.
- Brand tokens live in `tailwind.config.js`. Navy `#1B365D` for structure,
  cyan `#00B4D8` for actions, Inter for text, DM Mono for numeric data.
- New module? Add the page, a nav entry in `Sidebar.jsx` with the permission it
  needs, and a guarded route in `App.jsx`.
- Data changes go through `DataContext` so every view stays in sync.

## Known limits of this build

- No backend: state is in memory and resets on reload.
- Credentials are in the client bundle. This is a prototype, not real
  authentication. Any production version needs a server-side login.
- Exported files and payslips contain placeholder content.
- All employee records are fabricated.
