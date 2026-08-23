# Scaling decisions

> Measure the constraint, preserve the domain boundary, then deepen the system.

[Documentation hub](README.md) · [Architecture](../README.md#architecture-at-a-glance) ·
[Self-hosting](self-hosting.md)

FLOX currently targets one self-hosted API instance backed by a
durable local volume. This keeps privacy, backups, and failure recovery easy to
understand.

Do not add realtime collaboration only because projects can be shared. The
current optimistic revision protocol supports asynchronous editors and makes
conflicts explicit. Consider realtime transport only after user research shows
that simultaneous editing is a frequent workflow, then define presence,
operation ordering, reconnect, and conflict semantics before choosing a
WebSocket or CRDT implementation.

Do not replace the file repository simply because project count grows. Measure:

- sustained and peak writes per second;
- lock wait duration per owner;
- project-list latency and revision-directory size;
- backup duration and restore verification time;
- need for more than one API replica.

Introduce a domain-shaped project repository and a MySQL adapter when a single
durable volume or API process becomes the measured availability/concurrency
bottleneck. The generic JSON store is already isolated, but project services
still know its record layout, indexes, and lock keys; extract that seam before
adding a second persistence implementation. The HTTP and React interfaces can
then remain unchanged.
