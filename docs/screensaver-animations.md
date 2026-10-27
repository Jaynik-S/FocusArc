# Animated screensaver worlds

The original illustration files remain intact. A transparent Canvas animates selected parts of the recolored painting as well as atmospheric effects, between the base artwork and timer controls. Static pixel recoloring still runs only when source/HEX changes; animation never sends work to that worker.

## Scene direction

| Wallpaper ID | Ambient motion | Landmarks and occasional moments |
|---|---|---|
| `space` | Visible cosmic dust and independently timed star pulses | Meteors every roughly 8–16 seconds; broad light pulses flowing along the painted rocket trail |
| `forest` | Larger wandering fireflies and floating pollen | Rippling painted water, flowing waterfalls, stronger warm lantern breathing and water sparkles |
| `sky-garden` | Larger tumbling petals and drifting magical motes | Flowing painted waterfalls and three light arcs circulating around the celestial ornament |
| `winter` | Deeper, more visible snowfall with varied sizes and speeds | Painted aurora curtains sway beneath moving light ribbons; ice reflections shimmer; igloo lighting stays warm |
| `village` | Fireflies, motes and visibly drifting river mist | Painted river/waterfalls move; warm windows/lanterns flicker and reflections sparkle |

Characters, buildings and the timer stay fixed. Selected water/aurora regions reuse the actual recolored texture, with small flowing displacements feathered into the base image. The whole wallpaper does not pan or zoom. A soft quiet region behind the timer reduces particle intensity without hiding the environment.

## Runtime and visible-frame synchronization

1. The existing selection hook supplies a catalog definition. Every timer start/resume chooses again, excluding the previous wallpaper. Ticks, HEX edits, ordinary rerenders and day changes do not choose again; refresh restores the saved choice.
2. `ScreensaverWallpaper.tsx` prepares static artwork through the existing source+HEX cache. Its `onVisibleFrame` callback reports `{source, color, artwork}` for the **committed** Canvas frame. `artwork` is the existing display Canvas, not a second decoded image or cached DOM node. The existing `onVisibleSource` API remains available.
3. `Screensaver.tsx` resolves the animation ID and text ink from that visible source. During an in-place HEX edit, the old scene and palette remain paired with the retained image. Successful commits update palette before paint. New activations wait in the normal timer view until the exact selected frame is ready; see [entrance transitions](screensaver-transitions.md).
4. `ScreensaverEnvironment.tsx` keeps one deterministic scene model per visible ID. HEX changes replace the palette and repaint the current instant without restarting motion. The component key changes only when the actually visible wallpaper ID changes, preventing an old scene buffer from appearing over a new painting.
5. A ref stores elapsed animation time. Timer ticks do not regenerate particles or restart the loop. Exit or a hidden tab freezes the mounted scene; tab visibility changes continue its clock. Timer resume selects a new wallpaper, starting a fresh animation clock when that image commits. Animation state is decorative and is not saved to the server.

`screensaverLandscape.ts` defines source-coordinate polygons around water, waterfalls, ice and aurora. It draws narrow strips from the committed Canvas with bounded, time-varying displacement, clipped to those landmarks and faded vertically at the edges. It performs no image decoding, pixel reads, recoloring or extra worker jobs per frame. Before a committed frame exists, the environment stays inactive. A failed in-place HEX render retains the last complete artwork and its matching environment palette.

The canvas is `aria-hidden` and `pointer-events: none`. Existing controls, keyboard behavior, session ownership and shared study time remain in their existing components.

## Coordinate and color conventions

All five originals are **1672 × 941**. `coverTransform` uses `max(viewWidth / 1672, viewHeight / 941)` and centered offsets, matching the background's `object-fit: cover`. Draw in original-image coordinates, not screen coordinates. Profile anchors use fractions of the original width/height. Cropped landmarks and their effects disappear together at narrow aspect ratios.

`environmentPalette` derives ambient accents and petals from the displayed six-digit HEX. Bright sky-garden artwork receives darker accents for contrast. Cream stars/snow and warm lamps keep appropriate neutral/warm highlights. This is a small animation palette, separate from the static artwork's Oklab pixel mapper; adding an effect never requires a table of timer colors.

## Extending an environment

- **Particle behavior or population:** edit the profile and `particlePosition` in `frontend/src/utils/screensaverAnimation.ts`. Seeded randomness gives each scene repeatable variation without consuming wallpaper-selection randomness.
- **An anchored light:** add its fractional source-image position and radius to the scene's `lights`. The shared renderer supplies gentle, staggered flicker.
- **Stars/reflections:** add artwork anchors to the corresponding arrays. Each receives different timing.
- **A custom feature:** add a small scene-specific drawing block in `frontend/src/utils/drawScreensaverEnvironment.ts`, using the supplied palette/time and balanced Canvas `save`/`restore`. Examples are the rocket's cubic trail, the temple's orbital glint and the winter aurora.
- **Movement within the painting:** add a polygon in `frontend/src/utils/screensaverLandscape.ts` and select `ripple`, `fall`, `ice` or `aurora`. Keep characters/buildings outside it. Check moving edges against the original image at both wide and narrow sizes.
- **New artwork:** add its catalog entry and animation profile, inspect its landmarks and contrast, and adapt the shared source-coordinate dimensions if its aspect/resolution differs. Do not copy timer or animation lifecycle code.

Keep elements sparse, stagger their phases and speeds, and fade special events in/out. Check several seconds of actual movement over both light and dark artwork; a single screenshot cannot establish animation quality.

## Resource policy

The renderer targets 30 drawing updates per second and caps backing-store DPR at 2. It uses bounded particle populations (54–140 per scene), small gradients/paths and clipped texture strips, with no image filters or per-frame React state. `ResizeObserver` resizes only the overlay; it does not recolor the artwork.

Inactive screensavers and hidden documents cancel their RAF callback. Resume excludes the hidden interval to avoid jumping forward. Reduced-motion preference clears/hides the overlay and schedules no frames; the complete recolored illustration and controls remain. Cleanup cancels RAF, disconnects the observer and removes resize, visibility and media-query listeners. Canvas failure leaves artwork and controls usable.

## Repeating verification

Stronger dynamic-wallpaper version verified on 2026-10-26:

- **125 frontend tests passed**, including source/HEX races, committed artwork handoff, fallback after a painted frame, scene identity, bounded/feathered landscape displacement, protected character/timer anchors, deterministic particles, cover geometry, palette extremes, hidden-time exclusion, native preference caching and cleanup. TypeScript/Vite production build passed.
- Real Chrome against the **built app**: all five scenes × sage `#A8D5BA`, dark purple `#42216F`, white, vivid `#FF5733` and black produced nonempty overlays. Timed frame hashes changed, timer ticks did not request static recoloring, source/HEX pairs remained synchronized, same-source color updates retained the Canvas, and a different visible scene replaced it. Actual artwork strip draws were detected for all four landscape scenes. Inspected desktop frames and narrow layouts; no browser errors.
- Native reduced-motion emulation cleared effects and stopped drawing, then resumed correctly. Hidden-document and Exit checks stopped drawing; 320×568 backing-store sizing passed. Unit tests additionally verified DPR capping and unmount listener/RAF/observer cleanup.
- The local Docker frontend was rebuilt separately with `docker compose up -d --build --no-deps web`; localhost:5173 serves the new bundle and the existing localhost:8005 API health check remains OK. No API/session behavior changed in this refinement.
- All five original root PNGs still match their public copies byte-for-byte (SHA-256). No source-artwork, backend, schema or dependency changes.

Observed at 900×700 with browser instrumentation and screenshots running:

| Scene | Drawing updates/s | Average draw (ms) | 95th percentile (ms) |
|---|---:|---:|---:|
| Space | 28.4 | 0.38 | 0.7 |
| Forest | 28.3 | 0.89 | 1.8 |
| Sky garden | 28.5 | 0.65 | 1.4 |
| Winter | 28.0 | 0.90 | 1.7 |
| Village | 27.4 | 0.81 | 1.6 |

These measure the Canvas drawing call on this machine, not total browser/compositor cost or a cross-device performance guarantee. The renderer targets 30fps; the browser controls scheduling.

```powershell
cd frontend
npm.cmd test
npm.cmd run build
```

With local Vite on port 5175:

```powershell
cd .. # Return to the repository root after the frontend commands above.
playwright-cli.cmd -s=animation open http://localhost:5175/screensaver/master-screensaver.png --browser=chrome
playwright-cli.cmd -s=animation run-code --filename=scripts/verify_screensaver_animations.js
```

The browser script uses an isolated mock API, captures timed frame sequences and screenshots in five HEX themes per world under ignored `.deployment-private/`, compares moving frame hashes, measures draw cost/rate, checks stable worker-job counts, source/palette pairing, stable identity during HEX updates, a different scene on resume, reduced motion, hidden/exit stopping and narrow layouts. The automated browser exposes all tabs as visible, so the document-hidden branch uses a temporary property override with a dispatched visibility event; unit tests independently cover its clock and cancellation behavior. Reduced-motion checks use native browser emulation.

The motion loop caches the initial media preference and updates it from change events. Reading native `MediaQueryList.matches` on every frame suppressed change delivery in a reproducible Chrome integration case; the event-driven version passes native reduce/resume checks and has a regression test for a single initial read.

To test the production bundle, run `npm.cmd run preview -- --host localhost --port 5176 --strictPort` **from `frontend`**, then add `?production=1` to the initial Vite image URL. An optional `&scene=forest` (or `?scene=forest`) runs one world. The existing `scripts/verify_screensaver.js` exercises real persisted timers against the disposable local API on port 8002; it never targets production.
