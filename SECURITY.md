# Security policy

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Use the
repository owner's private contact method or GitHub private vulnerability
reporting after the repository is published. Include the affected version,
reproduction steps, impact, and any suggested mitigation.

## Supported version

Security fixes target the current `main` branch until versioned releases are
introduced.

## Deployment notes

- Never commit `.env` files or credentials.
- Google OAuth client IDs are deployment identifiers, not client secrets, but
  each deployment should use its own authorized origins.
- GitHub Pages hosts only the static, browser-local application.
- Internet-facing container deployments should use HTTPS and secure cookies.

See [docs/security-review.md](docs/security-review.md) for the implementation
review and [docs/self-hosting.md](docs/self-hosting.md) for deployment controls.
