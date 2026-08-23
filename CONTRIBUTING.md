# Contributing to FLOX

Thank you for helping improve FLOX. Keep changes focused, preserve the
local-first data model, and include regression coverage for behavior changes.

## Development setup

1. Install Node.js 20.19 or newer (or Node.js 22.12+).
2. Run `npm ci` and `npm ci --prefix web`.
3. Start the development environment with `npm run dev`.
4. Before opening a pull request, run `npm run verify`.

## Pull requests

- Explain the user-visible outcome and the reason for the change.
- Add or update focused tests for changed behavior.
- Keep canvas rendering and SVG/PNG export behavior aligned.
- Do not commit `.env` files, generated builds, test reports, or local exports.
- Update documentation when commands, configuration, or behavior change.

Visual changes should include screenshots and intentional snapshot updates.
Security reports should follow [SECURITY.md](SECURITY.md), not a public issue.
