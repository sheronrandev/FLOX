# FLOX frontend workflow

This document records how the ten-phase frontend workflow is applied to the
current FLOX application. It is a release baseline, not a parallel redesign
specification.

## 1. Product definition

- Product: private, local-first UML activity diagram editor.
- Primary audience: product, engineering, operations, and process teams.
- Critical task: create a diagram, model a process, validate it, and export or
  share it without surrendering local ownership.
- Primary success action: create and edit the first diagram.
- Product promise: **Map the work. Move with clarity.**

## 2. Architecture decision

FLOX remains a React 19 + Vite + TypeScript application. React Flow owns the
diagram viewport, Zustand owns document command state, Zod owns document
validation, and the repository boundary owns local/server persistence.

The existing feature-oriented folders remain authoritative:

```text
src/pages/          route composition
src/components/     application and shared UI
src/diagram/        canvas-specific rendering and routing
src/domain/         portable document and validation rules
src/persistence/    local and server repository boundaries
src/store/          editor commands and history
src/hooks/          reusable interaction behavior
```

## 3. Visual direction

The target is **calm technical clarity**: high information confidence, restrained
teal accents, generous but efficient spacing, and surfaces that feel precise
rather than decorative. The dashboard may use subtle depth and translucent
surfaces; the editor canvas remains visually quiet so diagrams carry the focus.

The interface should not combine unrelated trends. Animation communicates state
and hierarchy only. Diagram editing performance takes priority over ornamental
motion.

## 4. Design system

The brand source is `assets/brand/design-tokens.css`. Static brand colors use
OKLCH, while user-editable theme values remain hexadecimal because native color
inputs produce hexadecimal values. Components consume semantic variables such
as `--primary`, `--surface`, `--border`, and `--destructive`.

Component structure follows:

```text
base → variant → size → state → local override
```

Focus, motion, radii, and shadows are shared tokens. Page-specific CSS must not
introduce a second brand palette.

## 5. Component foundations

- Use native buttons, links, inputs, headings, landmarks, and labels first.
- Icon-only controls require programmatic names; decorative icons are hidden
  from assistive technology.
- Dialogs contain focus, close with Escape, and restore focus to their trigger.
- Loading controls expose `aria-busy`; loading regions expose status semantics.
- Reusable interaction behavior belongs in hooks or UI primitives rather than
  being duplicated by pages.

## 6. Primary vertical slice

The reference slice is:

```text
workspace → new diagram → editor → add nodes → validate → export/share
```

Every change to this slice must retain loading, empty, error, success,
read-only, offline, and conflict behavior where applicable.

## 7. Accessibility remediation packet

- Surface: dashboard, settings dialog, and routed editor flow.
- Workflow type: release readiness and remediation.
- Primary packet: `keyboard-focus`.
- Follow-up packet: `routed-navigation-feedback`.
- Primary owner: frontend application.

Highest-risk gaps addressed in this pass:

1. Settings did not contain focus or restore it to the opener.
2. Escape behavior was not explicit.
3. Client-side route changes did not update the page title or provide a focus
   and announcement cue.
4. The application had no skip-to-content path.

Automated checks are an input, not proof of complete accessibility. Release
verification still requires keyboard-only completion, useful screen-reader
announcements, zoom/reflow, contrast, and reduced-motion review.

## 8. Responsive and motion policy

- The dashboard collapses to one column without horizontal scrolling.
- Primary actions become full-width on narrow phones.
- Editor connection targets remain enlarged for coarse pointers.
- Motion is limited to opacity and transform where possible.
- `prefers-reduced-motion: reduce` removes non-essential animation and
  transitions.

## 9. Verification gates

Run:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The browser gate includes Chromium/Edge, WebKit, and a mobile Chromium profile.
Firefox and Docker retain their documented environment-specific gates.

## 10. Release and measurement

Before release, review the primary slice using keyboard-only input and at 200%
zoom, confirm the route announcement strategy with a screen reader, inspect
light and dark themes, and compare intentional screenshot changes. After
release, monitor JavaScript errors, persistence failures, Core Web Vitals,
accessibility regressions, and bundle growth.
