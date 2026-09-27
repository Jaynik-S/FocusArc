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
- Keep the full interface usable without horizontal scrolling at 900 x 700 and adapt to narrower desktop/tablet widths.
- Keep the existing React 18, TypeScript, Vite, and CSS architecture; do not change backend contracts or data handling for the redesign.

## Brand Commitments

- Product name: FocusArc.
- The experience is calm, minimal, compact, and distraction-free.
- Dark-first presentation with an optional light theme.
- The supplied `DESIGN-linear.app.md` is the primary visual reference: near-black layered surfaces, fine borders, restrained lavender accent, clean typography, minimal shadow, and subtle interaction.

## Evidence on Hand

- Existing application code and behavior under `frontend/`.
- Product description and technical constraints in `README.md`.
- Linear design analysis and tokens in `DESIGN-linear.app.md`.
- User-provided reference screenshot in the redesign request.

## Product Principles

- Keep the current timer state understandable at a glance.
- Make frequent controls effortless in a compact window.
- Let course colors carry identity without overwhelming the interface.
- Keep secondary information available but visually quiet.
- Prefer stable, accessible interaction over decorative motion.

## Accessibility & Inclusion

Maintain keyboard access, visible focus states, semantic controls, readable contrast, reduced-motion support, and layouts that do not clip or require horizontal scrolling at supported widths.
