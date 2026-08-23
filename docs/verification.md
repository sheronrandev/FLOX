# Release verification

`npm run verify:release` performs type checking, focused web and server tests,
the production build, Edge/WebKit/mobile browser workflows, accessibility
scans, visual regression checks, and Docker acceptance when Docker is present.

## Browser matrix

- Microsoft Edge/Chromium: editing, persistence, export, accounts, sharing,
  revision restore, accessibility, keyboard, and visual snapshots.
- Playwright WebKit: the same functional and accessibility workflows.
- Mobile Edge profile: functional workflows, responsive overflow, hidden
  minimap, and 16-pixel connection anchors.
- Firefox: configured as `npm run test:e2e:firefox`, but the downloaded browser
  cannot initialize its headless software compositor in the current sandboxed
  Windows environment. It fails before loading application code. Run this gate
  on CI/Linux or an unrestricted Windows worker.

## Remaining environment gate

Docker is not installed in the current workspace. `npm run test:docker` exits
with an explicit skip in that case. Where Docker is available it validates the
Compose model, performs clean image builds, starts both healthy services,
checks `/api/ready` through the web proxy, and tears the stack down.

Visual snapshot files are stored beside the Playwright visual specification.
Update them intentionally with `npm --prefix web run test:e2e:update` after a
reviewed design change.
