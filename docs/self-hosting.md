# Self-hosting FLOX

## Local development

Use Node.js 20 or newer. Start the API and Vite together:

```bash
npm run dev
```

Projects remain in browser storage for every user. The bundled Node API is
retained for legacy deployments, but the current sharing workflow uses an
optional Google Drive connection instead of moving the workspace server-side.

## Google Drive sharing

Create a Google OAuth client for each environment instead of reusing a client
owned by another organization:

1. In the Google Cloud project, enable the Google Drive API.
2. Open **Google Auth Platform > Audience**. Choose **External** when people
   will connect consumer Gmail accounts or accounts outside your Google
   Workspace organization. An **Internal** app rejects those accounts with
   `403: org_internal`. See Google's [app audience documentation](https://support.google.com/cloud/answer/15549945).
3. While the app has **Testing** publishing status, add every developer's
   Google account under **Test users**. Testing authorizations expire after
   seven days, so publish the app when it is ready for ongoing use.
4. Under **Clients**, create an OAuth client with application type **Web
   application**. Add every exact app origin to **Authorized JavaScript
   origins**. Typical local origins are `http://localhost:4173` for Vite and
   `http://localhost:8080` for the container. Add the deployed HTTPS origin
   separately; origins include the scheme and port and do not include a path.
5. Under **Data Access**, register `openid`, `email`, `profile`, and
   `https://www.googleapis.com/auth/drive.file`. FLOX requests only these
   scopes; Google classifies [`drive.file` as a recommended, non-sensitive scope](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Copy `web/.env.example` to `web/.env.local` and set the new Web client ID:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Restart Vite after changing the value. Without it, all local editing and
JSON/SVG/PNG exports continue to work; the Google connection button clearly
reports that Drive sharing is not configured. Authorization uses
`openid email profile` and `https://www.googleapis.com/auth/drive.file`.

## Container deployment

```bash
docker compose up --build -d
```

Compose reads `VITE_GOOGLE_CLIENT_ID` from a root `.env` file or the shell
environment and embeds it into the web build. For example:

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Rebuild the `web` image whenever this value changes. There is deliberately no
built-in OAuth client fallback: an organization-restricted client would make
Google sign-in fail for other deployments.

The web container listens on port 8080 and proxies same-origin API requests to
the API container. The named `activity-studio-data` volume is the only durable
server state.

For access beyond a trusted local network, place a TLS reverse proxy in front
of port 8080 and set `COOKIE_SECURE=true`. Do not expose API port 4174 directly.

## Configuration

- `ACTIVITY_STUDIO_DATA`: storage directory; `/data` in the container.
- `SESSION_HOURS`: session lifetime, from 1 to 720 hours.
- `MAX_PROJECTS_PER_USER`: project quota, from 1 to 1000.
- `MAX_DOCUMENT_BYTES`: per-project JSON limit, from 100 KB to 10 MB.
- `REVISION_RETENTION`: default snapshots retained per project, from 5 to 200.
- `COOKIE_SECURE`: set `true` when the public endpoint uses HTTPS.
- `SHUTDOWN_TIMEOUT_MS`: graceful shutdown deadline, from 1 to 60 seconds.
- `HOST` and `PORT`: API bind address and port.

## Storage layout

```text
data/
  storage.json
  accounts.json
  users/<user-uuid>.json
  sessions/<session-uuid>.json
  memberships/<user-uuid>.json
  projects/<user-uuid>/_index.json
  projects/<user-uuid>/<project-uuid>.json
  revisions/<owner-uuid>/<project-uuid>/<revision>.json
```

Passwords are stored as salted scrypt hashes. Session cookie secrets are
hashed before storage. Project paths only accept UUIDs. Writes use a temporary
file in the destination directory followed by an atomic rename, and mutations
for one user are serialized to prevent overlapping file updates.

Storage format upgrades run before the HTTP server starts. The readiness route
`/api/ready` reports the active storage version; `/api/health` provides a basic
liveness response. HTTP request logs are emitted as one JSON object per line
with request ID, method, path, status, and duration, without request bodies.

## Backup and restore

Stop the API before a filesystem-level backup so the indexes and records form
one consistent snapshot. Copy or archive the complete data directory/volume,
then restart the API. To restore, stop the API, restore the complete snapshot
into an empty data directory, and start it again.

For a non-container installation, the included command creates a new backup
directory with a manifest and a complete data copy:

```bash
npm --prefix server run backup -- /path/to/new-backup-directory
```

Startup parses every JSON record and refuses to serve if it finds malformed
data, preventing silent operation on a damaged backup. Keep backups encrypted
and access-restricted: they contain account emails, password hashes, active
session hashes, and private diagrams.

## Collaboration and history

Project owners can grant registered accounts viewer or editor access. Viewers
cannot mutate diagrams, restore revisions, change retention, delete projects,
or manage members. Editors can save and restore diagram revisions but cannot
manage access or retention. Every successful save creates an immutable
snapshot; restoring a snapshot creates a new head revision and retains the
previous head.

See [scaling.md](scaling.md) for the measured thresholds that should drive any
future move to realtime collaboration or MySQL.
