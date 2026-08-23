# FLOX security policy

> Keep the report private. Make the fix reviewable. Protect the flow end to end.

[Project overview](README.md) · [Security review](docs/security-review.md) ·
[Self-hosting guide](docs/self-hosting.md)

## Supported versions

| Version | Support status |
| --- | --- |
| Latest GitHub release | Supported |
| `main` | Receives fixes for the next release |
| Older releases | Upgrade to the latest release before requesting a fix |

## Report a vulnerability privately

Do **not** disclose a suspected vulnerability in a public issue, pull request,
discussion, or social post.

Use **GitHub private vulnerability reporting** from the repository's Security
tab when it is available. If that channel is unavailable, contact the repository
owner privately through a verified profile channel.

Include enough detail to reproduce and assess the report:

- affected FLOX version, commit, or deployment mode;
- affected browser, operating system, or server environment;
- clear reproduction steps or a minimal proof of concept;
- expected and observed behavior;
- security impact and realistic attack conditions;
- suggested mitigation, if known;
- whether the issue has been shared anywhere else.

Please avoid accessing other people's data, degrading a public service, or
publishing proof-of-concept material while a report is being assessed.

## What happens next

The maintainer will aim to:

1. acknowledge a complete report;
2. reproduce and classify the issue;
3. agree on a remediation and disclosure plan;
4. prepare and verify a fix;
5. publish an advisory or release when appropriate.

Response timing depends on severity and maintainer availability. A report is
not considered resolved until the affected flow has been tested and the fix is
available through a supported release or deployment update.

## Security boundaries

### Browser-local application

- Projects stay in IndexedDB, with localStorage as a fallback, unless a user
  explicitly exports or shares them.
- Diagram imports pass through the versioned schema before replacing the open
  document.
- Google Drive is optional, uses `drive.file`, and keeps access tokens in memory.
- OAuth client IDs identify a deployment; client secrets must never be placed in
  frontend code.

### Self-hosted deployment

- Never commit `.env` files, credentials, private keys, or production backups.
- Terminate HTTPS before exposing the service and set `COOKIE_SECURE=true`.
- Do not expose API port 4174 directly to the internet.
- Restrict, encrypt, and test backups because they can contain account and
  private diagram data.
- Use environment-specific OAuth clients and authorized origins.

The implementation-oriented threat and dependency notes are maintained in
[docs/security-review.md](docs/security-review.md). Deployment controls and
backup guidance are in [docs/self-hosting.md](docs/self-hosting.md).

## Safe research

Good-faith research that follows this policy, avoids privacy violations and
service disruption, and allows reasonable time for remediation is welcomed.
This policy does not authorize testing against infrastructure or accounts you
do not own or have explicit permission to assess.
