# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

FocusArc is primarily for individual students working in a relatively small desktop window while studying. They need a course timer that remains easy to read and control without competing for attention.

## Product Purpose

FocusArc tracks study time by course. Users create course-specific timers, run one active study session at a time, review session history and schedules, and use lightweight statistics to understand where their time goes.

## Positioning

FocusArc combines an always-visible, course-colored focus timer with compact history, schedule, and statistics views in one distraction-free workspace.

## Operating Context

The primary operating context is an approximately 900 x 700 desktop window kept beside study material. The active timer is the primary working surface; history, schedule, and statistics are secondary review tools.

## Capabilities and Constraints

- Preserve timer creation, editing, archiving, starting, stopping, time adjustment, selection, totals reset, authentication, routing, persistence, and reporting behavior.
- Preserve custom timer HEX colors and their use in timer identity and data displays.
- Preserve the Timers, History, Schedule, and Stats information architecture unless a small usability improvement does not change behavior.
- Stats includes an analytics Overview and the original Reports. Overview shares course/date filters across its activity calendar, hourly distribution, weekly trends, and consistency metrics; archived courses remain available for historical reporting.
- Keep the full interface usable without horizontal scrolling at 900 x 700 and adapt to narrower desktop/tablet widths.
- Keep the existing React 18, TypeScript, Vite, and CSS architecture. Analytics extends the authenticated API while preserving existing timer, authentication, reporting, and persistence contracts.

## Brand Commitments

- Product name: FocusArc.
- The experience is soft, whimsical, cozy, playful, and slightly dreamy while remaining clean, compact, and practical. Layered material and expressive framing give the working interface the screensavers' personality.
- Keep dark-first presentation with a fully styled warm light theme.
- Midnight navy and warm paper, soft Fraunces headings, Nunito Sans controls, an open arc-and-star mark, and functional clock geometry connect everyday UI to the illustrated screensaver atmosphere. The inset folio, painted navigation windows, arched clock case, contoured playback plaque, and round adjustment knobs provide differentiated shapes and gentle depth.
- Preserve arbitrary custom timer HEX colors. Exact course color carries the progress gauge, selected course medallion, and principal action; the course frame stays neutral. Neutral mixtures carry quiet emphasis and focus, with contrast-selected action text and medallion star.
- Keep screensaver artwork in the screensaver experience; normal routes translate its softness through authored SVG frames, delicate orbital rules, and a real neutral gouache-paper material without wallpaper backgrounds or literal scenes.
- The confirmed cozy redesign replaces the earlier Linear/lavender identity. DESIGN.md records the implemented system; DESIGN-linear.app.md remains an archival reference.

## Evidence on Hand

- Existing application code and behavior under frontend/, including the shared theme in frontend/src/styles.css and runtime accent/contrast handling.
- Product description and technical constraints in README.md.
- User-provided screensaver atmosphere references and confirmation: "Keep dark-first, with a warm light theme."
- Implemented direction contract in .impeccable/surfaces/frontend-src-styles-css.md; current tokens and component examples in DESIGN.md and .impeccable/design.json.
- Authored SoftFrame, ClockHousing, OrnamentRule, navigation, and course-medallion geometry; self-hosted official Fraunces variable TTF and Nunito Sans with provenance and SIL Open Font Licenses under frontend/public/fonts/; unchanged original screensaver artwork.
- Neutral gouache-paper material under frontend/public/materials/: built-in image generation prompt and sidecar provenance, lossless WebP delivery with verified identical decoded pixels, and no scene or wallpaper crop in the working interface.
- Implementation and verification record in docs/ui-redesign.md, with dark/light compact-window screenshots and the scoped finish-review outcome.
- DESIGN-linear.app.md documents the superseded visual reference for historical context.

## Product Principles

- Keep the current timer state understandable at a glance.
- Make frequent controls effortless in a compact window.
- Let course colors carry identity without overwhelming the interface.
- Keep secondary information available but visually quiet.
- Prefer stable, accessible interaction over decorative motion.

## Accessibility & Inclusion

Maintain keyboard access, visible focus states, semantic controls, readable contrast, reduced-motion support, and layouts that do not clip or require horizontal scrolling at supported widths.
