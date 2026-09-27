# FocusArc compact frontend redesign

## Objective

Replace the existing frontend visual system with a compact, Linear-inspired productivity interface while preserving all routes, data flow, timer behavior, authentication, and backend contracts. The primary acceptance viewport is 900 x 700, with additional support for 1280 x 800, 1440 x 900, and narrower desktop/tablet widths.

## Visual direction

Use `DESIGN-linear.app.md` as the binding visual authority. The dark theme uses a near-black canvas, stepped charcoal surfaces, fine cool-gray borders, off-white text, and `#5e6ad2` as the single application accent. Timer colors remain user-controlled HEX values and appear only where they identify a timer or its data. The light theme translates the same hierarchy into cool white and gray surfaces.

Typography uses a compact system sans stack with tabular numerals for timers and durations. Headings remain modest; the active timer is the only intentionally large text. Corners stay between 6 and 12 pixels, shadows are rare, and state changes use short color/transform transitions with a reduced-motion fallback.

## Application shell

The desktop shell has a narrow fixed-width sidebar and a flexible content region. The sidebar contains product identity and account controls, primary navigation, a compact timer list, theme control, and totals reset. At 900 x 700 it must keep navigation, the timer list, and active timer details usable without horizontal overflow. At narrower widths it becomes a compact top/side composition without removing controls.

## Timer workspace

The timer route is an operational workspace rather than a dashboard. A compact status header identifies the selected course and active state. The circular timer remains central and scales with available height and width using CSS `clamp()`. The elapsed time uses tabular numerals. Primary start/stop and secondary time-adjustment controls remain adjacent and visible; edit and archive remain available but visually subordinate. User timer colors drive the dial progress and course identity while controls and focus states retain the global lavender accent.

## Supporting surfaces

History, Schedule, and Stats use a shared page header, panel, form, chip, row, and data-bar language. Dense information is separated by surface changes and hairlines instead of large cards or heavy shadows. Authentication and confirmation modals use the same tokens and focus treatment. Loading, empty, error, disabled, hover, active, and keyboard-focus states must remain legible.

## Responsive behavior

- 900 x 700: all core timer controls and active information visible; compact sidebar; no horizontal scroll.
- 1280 x 800 and 1440 x 900: increase breathing room and timer scale without oversized typography or empty margins.
- Narrow desktop/tablet: reduce sidebar width and spacing, then collapse navigation/timer list into a compact layout while retaining access to every action.
- Long timer names and account names truncate safely; data rows wrap or reflow without clipping.

## Implementation boundaries

Prefer shared CSS tokens and existing semantic class names. Make only targeted JSX changes needed for semantics, responsive grouping, accessible labels, or icon treatment. Do not change hooks, contexts, routes, API calls, business logic, persistence, or backend code.

## Verification

Add structural UI tests for the shell and key timer controls before JSX changes. Run the frontend test suite and production build. Inspect rendered screenshots at 900 x 700, 1280 x 800, 1440 x 900, and a narrower desktop/tablet viewport. Check visual consistency, contrast, focus states, overflow, clipping, reduced motion, and obvious regressions.
