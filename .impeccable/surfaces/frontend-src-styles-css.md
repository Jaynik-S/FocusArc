---
version: 1
slug: "frontend-src-styles-css"
primary_target: "frontend/src/styles.css"
related_targets: ["frontend/src/components/Sidebar.tsx","frontend/src/routes/TimersPage.tsx"]
---

# FocusArc working interface

Mode: Operate. Scope: the shared app shell, all normal routes, authentication, forms, dialogs, theme states and compact layouts. Screensaver artwork remains its own experience. Keep every timer, session, analytics and account interaction intact.

## Direction contract

THESIS: A cozy desk clock for a student working beside their reading; the clock and the chosen course are the primary landmarks. Replace the corporate black-panel treatment with soft material contrast and purposeful illustrated detail.

OWN-WORLD: Midnight navy and warm paper, a real neutral gouache-paper material, layered curved frames and delicate orbital rules. Fraunces soft-serif headings give an elegant illustrated voice; Nunito Sans keeps controls and time legible. The sidebar is an inset framed folio with four compact navigation windows and course medallions. The clock has a painted arched housing, a circular functional dial and star endpoint, and a softly contoured playback plaque between two adjustment knobs. Exact timer HEX remains the base of its medallion, progress and principal action. These are interface shapes and materials, not scenes or pasted wallpaper.

STORY: Choose a course in a 208px sidebar, see today's elapsed time at once, then Play. History, Schedule and Stats retain the same information and actions in quieter, consistent surfaces.

FIRST VIEWPORT: At 900×700, a 208px column holds a softly framed inset sidebar, account, four icon/text navigation windows in two rows, course list and theme/reset footer. An approximately 316px-wide framed clock occupies the main field; its course title and functional state sit above, with the three controls directly below. The complete timer workspace fits vertically. Dense routes scroll within main content; no horizontal page overflow.

FORM: Candidate 4, a small enamel desk clock translated into a compact web workspace; seed da3066ad. Code-led implementation, no generated comp as authority. Preserve the user's pinned soft, whimsical, cozy aesthetic and dark-first preference with a fully styled warm light mode.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Concept record

Grounded directions in order: lantern observatory; a clothbound field journal; Japanese study stationery; enamel desk clock; an illustrated astronomy guide; seed-packet typography; a ceramic studio's compact workbench.

Dealt challengers were assessed against the pinned audience and task. The type specimen and star atlas hold product-clarity or affinity respectively, but the desk clock makes the study action clearer without becoming a visualization tool. Developer-console styling is the discarded incumbent; airport/boarding-pass systems over-prioritize scanning; coded catalog sleeves obscure timer labels. Keep their discipline, not their styling: specimen legibility, console destructive-action separation, boarding-pass persistent state, atlas spatial precision, catalog rhythm, and signage's clear icon/text pairing.

User confirmed: keep dark-first, with a warm light theme. FocusArc name and behavior stay intact. No hardcoded artwork palette or wallpaper backgrounds in the normal UI.

Polish request: keep this visual world, replace washed-out mixtures with clearer color landmarks, and refine generic rounding into differentiated, purposeful shapes. Prioritize the 900×700 workspace and preserve exact timer HEX values.

Current goal: correct the prior interface's overly flat, basic finish. Translate the screensavers' layered arches, curved framing, soft painted tooth, small points of light and calm central clearing into the working interface. Retain the confirmed space-blue theme and warm light option. New material provenance: `frontend/public/materials/`; no scene, character or wallpaper crop is used in normal UI.
