# Security review notes

> Trace trust boundaries from imported diagram to deployed service.

[Documentation hub](README.md) · [Security policy](../SECURITY.md) ·
[Self-hosting](self-hosting.md)

## Automated coverage

The server suite checks password hashing, session invalidation, CSRF and origin
boundaries, UUID path validation, owner isolation, viewer/editor permissions,
request content type and size limits, malformed JSON, revision races, atomic
write recovery, and backup restoration. Diagram schemas reject unknown fields,
oversized collections, unsafe style tokens, dangling references, and foreign
formats.

The API does not accept arbitrary file paths or multipart uploads. Diagram
imports happen in the browser and pass through the strict versioned schema
before replacing the open document. Server writes validate the same constrained
document shape independently.

## Dependency audit

As of 2026-08-07, npm reports a high-severity React Router advisory affecting
RSC action processing in versions 7.12.0 through 8.2.0. This application uses
React Router 7.18.2 only as a client-side BrowserRouter: it has no React Server
Components, data-router actions, server-action deserialization, or React Router
server runtime. The affected code path is therefore not exposed here. Earlier
7.11.0 releases have a larger set of client/SSR advisories, so downgrading is
not safer. Track upstream and upgrade when a release outside the advisory range
is available.

This assessment is scoped to the current architecture and is not a substitute
for an independent penetration test before exposure to untrusted public users.
