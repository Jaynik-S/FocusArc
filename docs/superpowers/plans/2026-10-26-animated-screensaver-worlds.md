# Animated screensaver environments

Preserve the existing static recoloring worker/cache, random selection and timer/session ownership. Add an independent decorative Canvas between artwork and controls. No backend changes, dependencies, moving source-image patches or unrelated UI redesign.

## Motion thesis

- Space: varied anchored star twinkles, slow cosmic dust, rare tapered meteors and small glints following the painted rocket trail.
- Forest: organic fireflies/pollen around the landscape, warm lantern breathing and occasional light sparkles.
- Sky garden / celestial temple: a moving glint along the painted orrery, restrained orbital shimmer, drifting petals and magical motes.
- Winter: snow at several depths, slow light ribbons aligned to the northern lights, and small ice/water glints.
- Village: warm anchored window/lantern flicker, fireflies, narrow river mist and intermittent water reflections.

Keep motion moderately visible and calm, with a quiet region behind timer text. Image-coordinate landmarks use the same centered cover transform as the artwork. Palette accents derive from the displayed HEX; warm lighting and cream stars stay natural. Never rotate or warp the original painting.

## Three implementation stages

1. **Scene model and drawing**: deterministic seeded particles, cover geometry, theme palette and shared drawing helpers with distinct scene profiles/landmarks. Test determinism, cover alignment, bounded particles, color extremes and special-event scheduling before committing.
2. **Runtime integration**: independent 30fps Canvas loop with preserved elapsed animation time, capped DPR, responsive sizing and cleanup. Stop on hidden screensaver/tab or reduced motion. Extend visible-frame reporting to include actual displayed HEX so effects and ink switch together with retained frames/fallbacks. Test races, lifecycle, resource cancellation and controls; commit.
3. **Visual verification and refinement**: run all five worlds with multiple HEX colors in real Chrome, inspect motion clips/frame sequences at 900×700 and narrow sizes, measure frame cost, verify stop/resume/reduced motion/no recoloring per tick and production bundle. Refine intensity/anchors where needed, document effects and limitations, then commit.

## Budget and evidence

Use at most about 90 small particles, a few landmark effects and one occasional event per scene. Draw at 30fps, cap Canvas DPR at 2, use no per-frame React state or expensive image filters. Source artwork remains untouched; reduced motion retains the complete original illustrated scene.

- Inspected current catalog, rendering/cache pipeline, visible-source callback, timer overlay, lifecycle, CSS, tests and existing five artworks. All images remain the 1672×941 originals previously validated. The bright sky garden needs darker ambient accents; original cream stars and warm lanterns are protected by the art pipeline.
- Stage 1: 116 frontend tests and production build passed. Real Canvas smoke drew every profile at 900×700 over a recolored scene; no drawing errors. Inspected initial temple/winter frames. Scene drawing uses a timer quiet-zone, bounded particle fields and original-image landmarks; no pixel work or animation loop has been added to the static worker.
