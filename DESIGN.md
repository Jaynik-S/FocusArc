---
name: FocusArc
description: A cozy desk clock for study, with midnight blues, warm paper, and each course's own color.
colors:
  "canvas": "#0b1424"
  "sidebar-surface": "#101f34"
  "surface-1": "#15263d"
  "surface-2": "#1d3250"
  "surface-3": "#2c4666"
  "surface-hover": "#233c5c"
  "border": "#344f70"
  "border-strong": "#6e94bb"
  "text-primary": "#edf4ff"
  "text-secondary": "#d4e3f5"
  "text-muted": "#afc6e1"
  "text-subtle": "#a2bbd8"
  "primary-soft": "#edf4ff12"
  "danger": "#f09d91"
  "danger-soft": "#f09d9114"
  "overlay": "#030a17cc"
  "case-shadow": "#020b1a70"
  "light-canvas": "#faf4e8"
  "light-sidebar-surface": "#eee3d2"
  "light-surface-1": "#fffaf1"
  "light-surface-2": "#efe2d0"
  "light-surface-3": "#dfccb4"
  "light-surface-hover": "#e9d8c1"
  "light-border": "#cbb69b"
  "light-border-strong": "#98785d"
  "light-text-primary": "#20334d"
  "light-text-secondary": "#354b64"
  "light-text-muted": "#40546d"
  "light-text-subtle": "#445770"
  "light-primary-soft": "#20334d0c"
  "light-danger": "#a8433f"
  "light-danger-soft": "#a8433f0d"
  "light-overlay": "#07172b70"
  "light-case-shadow": "#34445a25"
  "action-ink-dark": "#111827"
  "action-ink-light": "#ffffff"
  "action-ink-black": "#000000"
typography:
  headline:
    fontFamily: "\"Fraunces\", Georgia, serif"
    fontSize: "clamp(1.6rem, 2.8vw, 1.9rem)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "\"Fraunces\", Georgia, serif"
    fontSize: "1.2rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  subtitle:
    fontFamily: "\"Fraunces\", Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "\"Nunito Sans\", \"Segoe UI\", sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "\"Nunito Sans\", \"Segoe UI\", sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
  control:
    fontFamily: "\"Nunito Sans\", \"Segoe UI\", sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
  timer:
    fontFamily: "\"Nunito Sans\", \"Segoe UI\", sans-serif"
    fontSize: "clamp(2.65rem, 7vw, 4.1rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.035em"
rounded:
  "xs": "3px"
  "sm": "7px"
  "md": "10px"
  "lg": "16px"
  "navigation": "16px 8px"
  "course-row": "15px 8px"
  "panel": "18px 12px 20px 12px"
  "sidebar": "30px 12px 24px 12px"
  "auth": "38px 14px 28px 14px"
  "modal": "24px 12px 24px 12px"
  "timer-action": "16px"
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
    backgroundColor: "var(--app-accent, var(--text-primary))"
    textColor: "var(--app-accent-contrast, var(--canvas))"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.8rem"
    typography: "{typography.control}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.8rem"
    typography: "{typography.control}"
  button-secondary-hover:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.8rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0.4rem 0.8rem"
    typography: "{typography.control}"
  text-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  nav-item-active:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.navigation}"
    padding: "8px"
  chip-active:
    backgroundColor: "color-mix(in srgb, var(--app-accent, var(--text-muted)) 18%, transparent)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.3rem 0.65rem"
  panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.panel}"
    padding: "{spacing.4}"
  timer-row-active:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.course-row}"
    padding: "0.6rem 0.65rem"
  timer-action:
    backgroundColor: "transparent"
    textColor: "var(--accent-contrast, #fff)"
    rounded: "{rounded.timer-action}"
    padding: "0 1.3rem"
    height: "3rem"
---
# Design System: FocusArc

## Overview

**Creative North Star: "The Cozy Desk Clock"**

FocusArc feels like a small painted desk clock beside a student's reading: cozy, whimsical, softly magical, and easy to use. Fraunces lettering, deep midnight blue, warm paper, layered curved frames, and delicate orbital rules translate the illustrated screensavers' personality into working interface materials.

The normal workspace keeps practical information and controls clear. An inset folio sidebar contains four navigation windows and neutral painted course frames; the selected course's exact color appears in its medallion, functional progress gauge, and contoured playback plaque. A real neutral gouache-paper texture gives the housing and panels a tactile surface. Dark mode is the default; warm paper light mode preserves the same hierarchy. Native controls, readable numerals, and gentle state changes keep this material world practical in a compact window.

**Key Characteristics:**
- Midnight blue and warm paper themes with layered painted surfaces and compact working density.
- Soft Fraunces headings paired with readable Nunito Sans controls and tabular time.
- Exact saved course colors on the progress gauge, selected course medallion, and principal actions.
- Authored curved SVG frames, an arched clock housing, round adjustment knobs, and delicate arc-and-star details.

## Colors

Midnight blue and warm paper neutrals surround a user-controlled course accent. The frontmatter records the source HEX values for both themes; the same CSS custom properties change with the root theme attribute. Colors with a light- prefix are the alternate theme, not a second simultaneous palette.

### Primary

- **Course Color:** runtime data, not a fixed color primitive. The selected timer supplies --app-accent and --app-accent-contrast on the application shell; when that selection is unavailable, the active timer is the fallback. Valid six-digit HEX values remain exact.
- **Readable Course Mixture:** the shell's --primary mixes course color at 35% with primary ink in dark mode, or 24% in light mode. --primary-soft mixes 18% course color with transparency. These serve focus, selected filters, navigation icons, and quiet emphasis. Without a course accent, source-defined neutral fallbacks apply.
- **Action Ink:** the relative-luminance helper chooses action-ink-dark or action-ink-light by their contrast against the exact course color. When neither reaches 4.5:1, action-ink-black provides the required contrast without altering the HEX. Authentication, outside the accented shell, uses primary ink for its button fill and canvas for its button text.
- **Selected Course Frame:** selection uses a neutral surface-2 SVG fill, a readable mixed-ink outline, and primary text. Its medallion retains the exact selected HEX with a contrast-selected star. Unselected courses use small exact-color dots. History session rows retain their 5% course tint and 20% border mixture; chart color remains tied to its data.

### Neutral

- **Midnight Blue Ground / Warm Paper Ground** (canvas / light-canvas): workspace backgrounds.
- **Desk Edge** (sidebar-surface and its light counterpart): a distinct sidebar plane.
- **Enamel Layers** (surface-1, surface-2, surface-3, surface-hover and their light counterparts): panel faces, fields, tracks, and available tonal steps.
- **Soft Seams** (border / border-strong and their light counterparts): fine separation and stronger interactive boundaries.
- **Moonlit Ink** (text-primary, text-secondary, text-muted, text-subtle and light counterparts): headings, body, quiet controls, and metadata.
- **Neutral Wash / Dimmed Ground** (primary-soft / overlay and light counterparts): neutral selection fallback and modal backdrop.
- **Case Shade** (case-shadow and its light counterpart): the folio, housing, and playback plaque's soft offset shadows.
- **Soft Coral / Brick Error** (danger / light-danger and their soft washes): error feedback and destructive hover.

**The Course Color Rule.** Preserve the selected timer's valid six-digit HEX on its progress gauge, selected course medallion, and principal actions. Keep the course frame neutral; derive quiet emphasis and focus colors by mixing the course color with theme neutrals. Never replace the user's choice with a fixed or artificially saturated palette.

The sidecar's eight-step tonal strips are synthesized OKLCH inspection aids. They are not additional runtime palette primitives; source HEX and alpha values above remain canonical.

## Typography

**Display Font:** Fraunces, with Georgia and serif fallbacks.
**Body Font:** Nunito Sans, with Segoe UI and sans-serif fallbacks.

**Character:** Fraunces gives headings and the wordmark soft, expressive lettering at weight 500, with optical sizing and variable axes SOFT 55 / WONK 1. Nunito Sans keeps buttons, forms, metadata, and the clock practical. Both fonts are self-hosted under the SIL Open Font License: the official unmodified Fraunces variable TTF supplies weights 100 to 900; Nunito Sans WOFF2 supplies 400 to 700. Font provenance is recorded in `docs/asset-provenance.md`.

### Hierarchy

- **Headline:** the responsive page-title role; timer course names use their own clamp(1.75rem, 3.5vw, 2.1rem) and a 1.15 line height, with the functional Ready/Running state and an orbital rule immediately below.
- **Title / Subtitle:** secondary headings in the frontmatter. Modal titles use 1.25rem, and analytics section titles use 1rem.
- **Body:** the default operational text, with page descriptions limited to 65ch where present.
- **Label / Control:** compact, mixed-case form labels, filters, navigation, and buttons. Metadata uses 0.6875rem, with 0.625rem or 0.5625rem reserved for dense timeline and chart annotations.
- **Timer:** the large tabular elapsed-time role. Smaller muted colons (0.7em) with slight spacing and vertical alignment soften the reading while retaining semantic text. Responsive width and short-height rules reduce the scale without changing the numeral family or weight.

**The Legible Clock Rule.** Use Nunito Sans with tabular numerals for elapsed time and durations. Let Fraunces provide personality in headings while keeping operational labels easy to scan.

## Layout

The desktop shell uses a 13rem (208px) sidebar column and a flexible main region. Within that column, the folio is 200px wide with an 8px outer margin and height calc(100vh - 16px). It holds brand, account controls, four icon-and-text navigation windows in a two-by-two grid with 6px gaps, a scrollable course list, and theme/day-end actions. Main content has its own viewport-height vertical scrolling; standard pages are capped at 68rem. Shared spacing follows the source's quarter-rem steps in the frontmatter.

The primary working window is 900 x 700. The short-height rule produces a 280px dial within an approximately 316px-wide arched housing, with course, status, Today, playback, adjustment, and editing actions grouped together. The timer control row is capped at 20rem, with 3rem adjustment columns, a 7rem to 8rem playback column, and 1rem gaps. Main padding is normally responsive from 1.25rem to 2.25rem, with 1.25rem at widths up to 900px and 1rem vertical padding in short desktop windows.

At 720px and below, the sidebar becomes a top section, navigation and course selection become horizontal rows, and the page scrolls vertically. At 480px and below, panel padding tightens, filters become single-column, and navigation icons yield space to text. Desktop windows below 740px and 540px height have separate compaction rules. Analytics has its own 520px container query that stacks charts and calendar bands. The supported minimum page width is 20rem.

These are the current shell and timer arrangements, not mandatory compositions for every future surface. Preserve clear landmarks and compact usability when extending other routes.

## Elevation & Depth

Depth combines tonal layers, fine outlines, real paper tooth, and soft offset shadows. A low-contrast soft-light material sits across the ambient field; the folio, clock case, panels, and dialogs carry more visible material at different scales. The neutral gouache-paper WebP is a generated material, not scene art; its prompt and image provenance are recorded in `docs/asset-provenance.md`. The modal sits over an eight-pixel blurred, dimmed overlay. Focus remains a visible outline.

### Shadow Vocabulary

- **Folio Lift:** 0 8px 24px var(--case-shadow); lifts the inset sidebar from the ambient field.
- **Clock Housing:** drop-shadow(0 10px 15px var(--case-shadow)); follows the authored case silhouette.
- **Playback Plaque:** drop-shadow(0 4px 5px var(--case-shadow)); follows the contoured action frame.
- **Modal Focus:** 0 16px 48px #00000030; separates a dialog from the workspace.

**The Painted Material Rule.** Build depth with neutral gouache-paper tooth, tonal layers, fine inset outlines, and soft silhouette-following shadows. Keep the ambient field lower contrast than the framed objects so the timer and controls remain clear.

## Shapes

Buttons and fields use compact md corners, small error surfaces use sm, and schedule markers use xs. Larger surfaces have differentiated corners: the folio, panels, authentication, and dialogs use their own four-corner profiles recorded in the frontmatter. The folio adds an outline inset 5px with correspondingly smaller corners. Navigation and course controls retain rounded native hit areas, but an authored softly faceted SVG contour provides their visible frame.

The dial is a true circle with an open outer bezel and face inset 1.15rem. A custom arched case extends 18px beyond each side of the dial, with an inner tracing and small curved flourishes at its base. The playback button's native background is transparent: its visible exact-HEX shape comes from the SVG frame, with paint disabled on that action to preserve the chosen color. Circular 48px adjustment knobs and the smaller round theme control contrast with these contours. Course medallions, four-point stars, and orbital dividers supply small points of light. Twelve dial ticks emphasize the quarter hours, and a star marks the actual progress endpoint.

## Components

### Buttons

Compact, tactile controls use a 2.25rem minimum height. Primary actions use the exact course HEX and contrast-selected text when the shell supplies an accent; secondary actions use surface-2 and a border; ghost actions remain quiet until hover. Hover changes tone or brightness, presses move down 1px, and disabled buttons retain their geometry at reduced opacity. The contoured Play/Pause action is 3rem high with a 7rem minimum width; adjacent painted 3rem circular knobs carry two-line value/min labels, stronger outlines, and a course-color hover mixture.

### Inputs / Fields

Labels sit above filled, bordered inputs with md corners and a 2.4rem minimum height. Hover strengthens the border. Focus uses primary ink/course mixture for border and a one-pixel outline, switching the field to surface-1. Error feedback uses the danger wash and border mixture. Native select styling follows the same neutral material language.

### Navigation

The sidebar brand pairs Fraunces with the open arc, clock hand, and small star. Four painted navigation windows combine authored SVG icons above mixed-case labels; the active window has a mild course wash, stronger frame, tinted icon, and small position dot. Course selection uses a neutral painted frame with a separate exact-HEX medallion and contrasting star. Unselected courses keep small exact-color dots. Totals remain tabular below each name. Fine orbital rules divide the folio's sections. Narrow layouts preserve text labels while adapting row orientation.

### Chips

Filters are compact bordered surface controls with md corners and a 1.875rem minimum height. Selection adds the shell's course wash, a mixed primary border, and primary ink. Rows wrap where needed.

### Cards / Containers

Panels use surface-1, a soft-light paper material, a fine mixed border, their differentiated four-corner profile, and space-4 padding. Headers and body spacing follow the same rhythm. Session rows tint their surface and border from their own course color; weekly reports use divided rows. Analytics retains compact chart and summary structures.

### Timer Dial

SVG rings render the hourly progress fraction with an exact-color stroke and star endpoint, a readable edge, an open bezel, and twelve ticks with stronger quarter hours. The painted arched housing and circular inset face frame medium-weight tabular time above Today. The selected course, functional state, and orbital rule sit above; adjustment knobs and contoured Play/Pause controls sit directly below. The clock scales with available width and height. The normal interface uses neutral material rather than screensaver scene imagery.

### Schedule Sessions

Timeline geometry uses 0.6px per minute with an 8px minimum marker. Markers shorter than 28px omit inline text; separate 2.25rem minimum-height selection rows above the timeline carry the course and full time range. Both paths select the same session and open its existing adjustment controls. Accessible names and selected outlines remain available without sacrificing temporal position.

### Authentication / Dialogs

Authentication uses the same mark, Fraunces lettering, paper material, asymmetric frame, and compact form rhythm. Dialogs use their own four-corner profile, a stronger seam, bounded internal scrolling, and a restrained 180ms entrance from 4px below at 0.99 scale. Shared control transitions use 160ms cubic-bezier(0.16, 1, 0.3, 1); reduced-motion preference cuts transitions and animation durations to 0.01ms.

## Do's and Don'ts

### Do:

- **Do** keep the timer, course name, and playback controls usable together at 900 x 700.
- **Do** preserve exact user HEX values, contrast-selected action text, tabular time, keyboard focus, and reduced-motion behavior.
- **Do** use real neutral paper tooth, layered curved frames, soft offset depth, and compact spacing consistently across routes and states.
- **Do** keep short Schedule sessions accurate in the timeline and provide readable selection rows when labels cannot fit.

### Don't:

- **Don't** restore Linear-style lavender as a fixed global accent or the old corporate visual identity.
- **Don't** use screensaver wallpapers as normal workspace backgrounds.
- **Don't** add generic decorative clutter that competes with the course, elapsed time, or controls.
- **Don't** force text into timeline markers too short to contain it.
- **Don't** replace authored frames and differentiated corners with uniform generic rounded rectangles or saturate user HEX values to make the interface livelier.
