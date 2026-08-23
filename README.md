# FLOX

> Map the work. Move with clarity.

FLOX is a local-first UML activity diagram editor for designing process flows
in the browser. It combines React, TypeScript, React Flow, Zustand, Zod, and
Tailwind CSS in an accessible workspace with portable, versioned diagram data.

Projects stay on the user's device by default. No account or server is needed
for editing, validation, JSON import/export, or SVG/PNG export. Google Drive
connection is optional and requested only when a user chooses to upload and
share a diagram.

## Features

- UML activity, decision, initial, final, fork, and join nodes
- Structural swimlanes with role-aware layout and management
- Routed control-flow and object-flow connectors with guard labels
- Multi-process diagrams with process-level and workspace export
- Undo/redo, multi-select, copy/paste, duplicate, keyboard movement, zoom, and pan
- Versioned JSON import/export with schema migration and validation
- SVG and PNG export at multiple scales with transparent-background support
- Local IndexedDB persistence with a localStorage fallback
- Light, dark, and custom application themes
- Keyboard, focus, responsive, and screen-reader-oriented interaction coverage
- Optional Google Drive upload and sharing with the narrow `drive.file` scope

## Technology

- React 19 and TypeScript
- Vite 7
- React Flow (`@xyflow/react`)
- Zustand and Zod
- Tailwind CSS 4 and Radix UI primitives
- Vitest, Testing Library, Playwright, and axe-core
- Optional Node.js API and Docker Compose stack for legacy/self-hosted deployments

## Requirements

- Node.js 20.19 or newer (or Node.js 22.12+)
- npm
- Docker only when validating or running the container deployment

## Installation

From the repository root:

```bash
npm ci
npm ci --prefix web
```

The API currently uses only Node.js built-in modules, so it has no separate
dependency installation step.

## Development

Start the web app and API together:

```bash
npm run dev
```

Open `http://localhost:4173`. Vite proxies `/api` requests to the API on port
4174. To run the processes separately:

```bash
npm run dev:web
npm run dev:server
```

The app does not require the API for its current browser-local project flow.

### Optional Google Drive setup

Copy `web/.env.example` to `web/.env.local`, create your own Google Web OAuth
client, and set:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Register the exact development and deployment origins in Google Cloud. Never
put an OAuth client secret in the frontend. See
[docs/self-hosting.md](docs/self-hosting.md) for the complete configuration.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and the local API |
| `npm run dev:web` | Start only Vite |
| `npm run dev:server` | Start only the Node API |
| `npm run typecheck` | Check the TypeScript project |
| `npm test` | Run web and server test suites |
| `npm run build` | Create the production web build in `web/dist` |
| `npm run preview` | Preview the production build locally |
| `npm run test:e2e` | Run Edge, WebKit, and mobile browser tests |
| `npm run test:e2e:firefox` | Run the separate Firefox browser gate |
| `npm run verify` | Run type checking, tests, and production build |
| `npm run verify:release` | Run the full browser and Docker-aware release gate |

See [docs/verification.md](docs/verification.md) for the browser matrix and
environment-specific gates.

## GitHub Pages deployment

The repository includes a GitHub Actions workflow that builds and deploys the
static application on every push to `main`. It supports both project sites
(`/repository-name/`) and user/organization sites at the domain root, and adds
a fallback for direct navigation to client-side routes.

After publishing the repository:

1. Open **Settings > Pages**.
2. Set **Build and deployment** to **GitHub Actions**.
3. Push to `main` or manually run **Deploy GitHub Pages**.

Optionally define the repository Actions variable `VITE_GOOGLE_CLIENT_ID` to
enable Drive integration in that deployment. Full instructions are in
[docs/github-pages.md](docs/github-pages.md).

GitHub Pages deploys only the static local-first app; it does not host the Node
API. The core editor and all local/file export workflows remain available.

## Self-hosting with Docker

```bash
docker compose up --build -d
```

Open `http://localhost:8080`. The Compose stack builds the web application,
starts the Node API, and keeps server data in the named
`activity-studio-data` volume. Internet-facing deployments should terminate
HTTPS in front of the web container and set `COOKIE_SECURE=true`.

See [docs/self-hosting.md](docs/self-hosting.md) for configuration, backup,
restore, and security guidance.

## Architecture

```text
web/
  src/
    auth/             optional Google authorization
    components/       application and reusable UI
    diagram/          canvas, routing, and SVG/PNG export
    domain/           schema, notation, migration, layout, validation
    pages/            routed application screens
    persistence/      IndexedDB/localStorage repositories
    store/            Zustand commands and document state
  e2e/                browser, accessibility, and visual coverage
  public/             static assets

server/
  src/                optional HTTP API, auth, storage, and security controls
  test/               API and persistence regression coverage

assets/brand/         shared brand tokens
deploy/               container reverse-proxy configuration
docs/                 operations, verification, security, and design records
```

Diagram documents are the domain boundary. The canvas and SVG/PNG exporters
share notation, routing, geometry validation, and label-placement behavior so
the saved and exported result remains consistent.

## Data and privacy

- Projects are stored locally in IndexedDB, with localStorage as a fallback.
- Connecting Google does not move the local workspace to a FLOX server.
- Drive authorization is requested only on user action and uses `drive.file`.
- Access tokens are kept in memory rather than persistent browser storage.
- Every project remains exportable as portable JSON, SVG, or PNG.

Browser storage can be cleared by the browser or device owner. Export important
projects regularly; browser-local storage is not a backup service.

## Testing and quality

Focused tests cover schema migration, validation, persistence, command history,
process/swimlane management, routing, canvas/export parity, guard-label safety,
accessibility, responsive behavior, visual regression, API path safety, CSRF,
ownership, rate limiting, and revision conflicts.

GitHub Actions runs `npm run verify` for pushes and pull requests targeting
`main`. Keep visual snapshot changes intentional and reviewed.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing changes. Report
security issues according to [SECURITY.md](SECURITY.md), not in public issues.

## License

FLOX is licensed under the [Apache License 2.0](LICENSE). It permits commercial
and private use, modification, and redistribution while retaining copyright,
license, and attribution notices.
