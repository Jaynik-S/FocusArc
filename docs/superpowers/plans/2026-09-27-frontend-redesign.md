# FocusArc Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a compact Linear-inspired FocusArc frontend optimized for a 900 x 700 desktop window without changing application behavior.

**Architecture:** Keep the existing React component and route structure. Establish the visual system in shared CSS custom properties, make small semantic JSX adjustments where the current markup blocks responsive or accessible styling, and verify each route through automated tests, a production build, and viewport screenshots.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, vanilla CSS

**Spec:** `docs/superpowers/specs/2026-09-27-frontend-redesign-design.md`

## Global Constraints

- Treat `DESIGN-linear.app.md` as the primary visual authority.
- Preserve routes, hooks, contexts, API contracts, timer logic, persistence, and backend behavior.
- Preserve custom timer HEX colors.
- Optimize first for 900 x 700, then 1280 x 800, 1440 x 900, and narrower desktop/tablet widths.
- Use compact spacing, subtle borders, minimal shadow, visible focus states, and reduced-motion support.

---

### Task 1: Lock shell and timer semantics with tests

**Files:**
- Create: `frontend/tests/ui-redesign.test.tsx`
- Modify: `frontend/src/components/MainLayout.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/routes/TimersPage.tsx`

**Interfaces:**
- Consumes: existing router, timer context, and component props.
- Produces: stable landmarks and accessible labels used by responsive styling and UI tests.

- [ ] Write tests that render the authenticated shell and assert the navigation landmark, main landmark, timer list label, selected timer heading, elapsed timer output, and start/stop/time-adjustment controls.
- [ ] Run `npm test -- --run tests/ui-redesign.test.tsx` from `frontend/` and confirm the new landmark/label assertions fail for the expected missing semantics.
- [ ] Add only the semantic wrappers, labels, and grouping hooks required by the tests; leave event handlers and state flow unchanged.
- [ ] Re-run `npm test -- --run tests/ui-redesign.test.tsx` and confirm it passes.

### Task 2: Establish the shared design system and compact shell

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/components/PrimaryNav.tsx`
- Modify: `frontend/src/components/TopBar.tsx`

**Interfaces:**
- Consumes: existing class names plus Task 1 landmarks.
- Produces: color, type, spacing, radius, elevation, control, sidebar, and shell tokens shared by every route.

- [ ] Add a CSS-token contract test that reads `styles.css` and asserts the Linear accent, layered dark surfaces, focus ring token, compact sidebar token, and 900px responsive breakpoint exist.
- [ ] Run the focused test and confirm it fails because the new token contract is absent.
- [ ] Replace the root theme values and shell/navigation/control rules with the approved token system, including light-theme equivalents, custom selection/scrollbar/caret styling, focus-visible states, and reduced-motion behavior.
- [ ] Re-run the focused test and full frontend suite.

### Task 3: Redesign the operational timer workspace

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/routes/TimersPage.tsx`
- Modify: `frontend/src/components/TimerFormModal.tsx`
- Modify: `frontend/src/components/EndDayButton.tsx`

**Interfaces:**
- Consumes: selected timer, active session, elapsed values, and handlers unchanged from the current route.
- Produces: compact responsive timer stage, scalable dial, course-color treatment, and consistent modal/actions.

- [ ] Extend UI tests to assert that custom timer color remains exposed to the dial and timer identity through CSS custom properties or inline color values.
- [ ] Run the focused test and confirm it fails against the old timer markup.
- [ ] Introduce presentation-only CSS variables/grouping, then style the timer stage and modal controls without changing runtime behavior.
- [ ] Re-run focused and full frontend tests.

### Task 4: Unify History, Schedule, Stats, and authentication

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/routes/HistoryPage.tsx`
- Modify: `frontend/src/routes/SchedulePage.tsx`
- Modify: `frontend/src/routes/StatsPage.tsx`
- Modify: `frontend/src/components/AuthScreen.tsx`
- Modify: `frontend/src/components/DayTimeline.tsx`
- Modify: `frontend/src/components/SessionBlock.tsx`

**Interfaces:**
- Consumes: existing page data and handlers.
- Produces: shared page headers, panels, fields, filters, rows, timelines, bars, and auth surfaces.

- [ ] Add accessibility assertions for page headings, date inputs, error alerts, and dialog naming where current markup is incomplete.
- [ ] Run the focused tests and confirm the new assertions fail for the expected markup gaps.
- [ ] Apply targeted semantic fixes and shared styling; remove JSX inline typography declarations when the shared class can own them.
- [ ] Re-run focused and full frontend tests.

### Task 5: Verify responsive quality and release safety

**Files:**
- Modify if defects are found: `frontend/src/styles.css` and affected frontend components only.
- Create: `.impeccable/review/user-900.png`
- Create: `.impeccable/review/desktop-1280.png`
- Create: `.impeccable/review/desktop.png`
- Create: `.impeccable/review/tablet.png`

**Interfaces:**
- Consumes: completed frontend build.
- Produces: test/build evidence and viewport captures for final review.

- [ ] Run `npm test -- --run` and `npm run build` from `frontend/`.
- [ ] Start the app with representative data and capture 900 x 700, 1280 x 800, 1440 x 900, and a narrower desktop/tablet viewport in one inspection round.
- [ ] Batch-fix overflow, clipping, hierarchy, focus, contrast, and responsive defects shown by the captures.
- [ ] Rebuild and perform one confirmation capture round.
- [ ] Run the Impeccable detector once on changed frontend targets, resolve mechanical findings, and submit screenshots and the direction contract to the finish reviewer.
