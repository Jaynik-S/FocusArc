---
name: FocusArc
description: A calm, compact study workspace built around a course-colored focus timer.
colors:
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#191a1b"
  surface-hover: "#1d1e20"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  ink: "#f7f8f8"
  ink-secondary: "#d0d6e0"
  ink-muted: "#8a8f98"
  linear-lavender: "#5e6ad2"
  linear-lavender-hover: "#737fdf"
  linear-lavender-soft: "rgba(94, 106, 210, 0.14)"
  danger: "#e16b66"
  danger-soft: "rgba(225, 107, 102, 0.1)"
  light-canvas: "#f7f7f8"
  light-surface-1: "#ffffff"
  light-surface-2: "#f1f1f3"
  light-surface-3: "#e9e9ec"
  light-surface-hover: "#e5e5e9"
  light-hairline: "#dedee3"
  light-hairline-strong: "#c9c9d0"
  light-ink: "#17171a"
  light-ink-secondary: "#34343a"
  light-ink-muted: "#66666f"
  light-ink-subtle: "#5d5d66"
  light-lavender: "#5360c8"
  light-lavender-hover: "#4652b6"
  light-lavender-soft: "rgba(83, 96, 200, 0.1)"
  light-danger: "#b73f3b"
  light-danger-soft: "rgba(183, 63, 59, 0.08)"
typography:
  headline:
    fontFamily: '"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(1.45rem, 2.4vw, 1.85rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Inter Variable", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: '"Inter Variable", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
  timer:
    fontFamily: '"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "clamp(2.65rem, 8vw, 4.6rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.04em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.linear-lavender}"
    textColor: "{colors.light-surface-1}"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.75rem"
  button-primary-hover:
    backgroundColor: "{colors.linear-lavender-hover}"
    textColor: "{colors.light-surface-1}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.75rem"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.75rem"
  text-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.45rem 0.625rem"
  nav-item-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 0.75rem"
    height: "2rem"
  chip-active:
    backgroundColor: "{colors.linear-lavender-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.3rem 0.65rem"
  panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  timer-row-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0.45rem 0.5rem"
---

# Design System: FocusArc

## Overview

**Creative North Star: "The Quiet Instrument"**

FocusArc behaves like a precise desk timer: present, readable, and composed. Its compact workspace supports an individual studying beside other material, with the active timer as the single point of emphasis. The atmosphere is calm, distraction-free, and quietly luxurious through alignment and restraint.

The interface takes Linear's near-black layers, fine cool-gray borders, restrained lavender, and clean type as a visual authority, then applies them to a personal study tool. Course colors give timers their own identity without turning the surrounding controls into decoration. Light mode preserves the same hierarchy with cool white and gray surfaces.

**Key Characteristics:**
- Compact, product-focused hierarchy for a small desktop window.
- Flat layered surfaces separated by hairlines.
- One interface accent, with user-defined course colors confined to timer identity and data.
- Short, subtle state transitions and visible keyboard focus.

## Colors

The palette is a stepped neutral field with one restrained lavender application accent. The frontmatter contains the implemented dark and light values; runtime theme selection swaps the corresponding CSS custom properties.

### Primary

- **Linear Lavender** (`linear-lavender`, CSS `--primary`): primary application actions, navigation indication, selection, and focus. The light theme uses `light-lavender` through the same CSS property.
- **Lavender Hover and Wash** (`linear-lavender-hover`, `linear-lavender-soft`): interaction and selected-filter states, with light equivalents.

### Neutral

- **Near-Black Canvas** (`canvas`, CSS `--canvas`): the dark workspace ground; `light-canvas` is its light counterpart.
- **Charcoal Layers** (`surface-1`, `surface-2`, `surface-3`, `surface-hover`): sidebar and panels, fields and selected items, recessed tracks, and hover surfaces respectively. Light equivalents preserve the sequence.
- **Cool Hairlines** (`hairline`, `hairline-strong`): quiet separation and stronger interactive borders; light counterparts follow the same roles.
- **Off-White Ink** (`ink`, `ink-secondary`, `ink-muted`): heading, body, and secondary text. `ink-muted` also supplies the dark subtle-text role. Light mode has distinct `light-ink-subtle`.
- **Muted Danger** (`danger`, `danger-soft`): deletion hover and error surfaces, with darker light-theme values for legibility.

**The One Accent Rule.** Lavender identifies interface action and focus; user-selected HEX colors identify a timer, its dial, its primary timer control, and related data only.

## Typography

**Display Font:** Inter Variable with SF Pro Display and system sans fallbacks.
**Body Font:** Inter Variable with SF Pro Text and system sans fallbacks.

**Character:** Dense, clear, and measured. Text hierarchy depends on modest size changes and weight; elapsed time is the only deliberately large type. Timer and duration figures use tabular numerals.

### Hierarchy

- **Timer:** large display role with compact tracking and tabular numerals, centered in the dial.
- **Headline:** page title; restrained enough to leave room for working controls.
- **Title:** panel and modal heading.
- **Body:** default operational text.
- **Label:** form labels, filter chips, and compact metadata; small uppercase labels use expanded tracking where the implementation calls for it.

**The Legible Clock Rule.** Keep elapsed time stable through tabular numerals and make it visually dominant only in the timer workspace.

## Layout

The desktop shell uses a fixed sidebar (`--sidebar-w: 13.5rem`) and a flexible content region. The sidebar holds identity, account control, navigation, timer selection, theme control, and day-end action. Main content uses the implemented `--space-1` through `--space-8` rhythm, with compact panels and rows rather than oversized cards.

The primary acceptance window is 900 × 700. At 900px width the sidebar narrows to 12.5rem; a short-height rule compacts the timer dial and vertical gaps below 740px. At 720px and below, the sidebar becomes a top section with horizontal navigation and timer list. At 480px and below, panels and filters tighten or become single-column. The layout has no horizontal page scroll, and long names truncate safely.

## Elevation & Depth

Surfaces are flat at rest. Stepped background tones and 1px borders establish containment and hierarchy. The only structural shadow is the modal's `0 16px 48px rgba(0, 0, 0, 0.24)`, which protects dialog focus over the dimmed, blurred workspace. The focus ring (`0 0 0 3px rgba(94, 106, 210, 0.35)`) is an interaction signal rather than elevation.

**The Hairline Rule.** Prefer a surface step and fine border to a raised card shadow.

## Shapes

Controls and rows use the implemented small radius scale (`xs`, `sm`, `md`, `lg`) rather than ornamental outlines. Buttons and inputs use `md`; navigation uses `sm`; panels and modals use `lg`. The circular timer dial, course dots, slim data bars, and pill-shaped primary timer control are purposeful exceptions.

## Components

### Buttons

Compact controls have a minimum 2rem height and restrained 160ms state transitions. Primary uses lavender with white text; secondary uses a layered surface and hairline; ghost stays quiet until hover. Active presses move 1px. Disabled controls remain visible at reduced opacity. The timer's Play/Pause button is a course-colored pill, while adjustment and edit actions stay subordinate. Keyboard focus uses the shared lavender ring.

### Inputs / Fields

Labels sit above cool layered inputs with a hairline border. Hover strengthens the border; focus shifts the border to lavender and the fill to the panel surface, with the shared ring. Errors use the muted danger color and its soft background.

### Navigation

The sidebar's compact nav items sit in a tight vertical list; hover adds a surface layer, and the active item adds a slim lavender mark. On narrow widths, they form a horizontal row with an underline-style active mark. Timer selection follows the same density with a course-color dot and tabular total.

### Chips

Filters are small bordered surface controls. The selected state uses a lavender wash and a mixed lavender border; wrapping rows preserve access at smaller widths.

### Cards / Containers

Panels use the first surface layer, a hairline border, `lg` corners, and `--space-4` padding. Panel headers have their own bottom hairline. Session rows and weekly summaries use compact inner layers; course color enters session rows only as a low-strength tint and border mix.

### Timer Dial

The dial is a circular conic progress track driven by the selected course's HEX color. An inset canvas face keeps the elapsed time legible, with a readable course-color mix for the timer name and digits. Its width and type scale with available width and height, keeping the controls visible in the 900 × 700 working window.

### Dialogs

Modal forms sit on a dimmed, blurred overlay, using the panel color, stronger border, restrained shadow, and short entrance motion. A header hairline and compact fields preserve the surrounding design language. Reduced-motion preference cuts animations and transitions to near-zero duration.

## Do's and Don'ts

### Do:

- **Do** keep the timer readable and controllable at 900 × 700.
- **Do** use the stepped surfaces, hairlines, and compact spacing rhythm for secondary views.
- **Do** preserve visible keyboard focus, tabular time values, and reduced-motion behavior.
- **Do** use a course's chosen HEX only for that timer's identity, primary control, and related data.

### Don't:

- **Don't** add decorative gradients, glows, or shadows to resting surfaces.
- **Don't** use course colors as global control or navigation accents.
- **Don't** enlarge secondary headings or cards until they compete with the active timer.
