# Screensaver transitions

Every start/resume chooses an entrance independently from the wallpaper. The normal timer stays visible and usable until the selected source has been recolored to the current normalized HEX, decoded, and painted. Timer commands and session ownership remain in the shared runtime.

## Readiness and cancellation

The old flow opened the overlay immediately, while `useScreensaverWallpaper` selected in a later effect and `ScreensaverWallpaper` retained its previous canvas. That exposed old pixels during the next image's asynchronous work.

`useScreensaverWallpaper` now tags its choice with the active session ID and commits selection in a guarded layout effect. `MainLayout` only requests an entrance when that tag matches the running session. The guard keeps StrictMode from drawing twice.

`Screensaver` assigns each requested activation a sequence. A fresh activation gets a fresh scene/canvas, and readiness resets before children render. `ScreensaverWallpaper` reports a visible frame only after `createImageBitmap` resolves and `drawImage` commits its pixels. The source and normalized HEX must both match before admission. `MainLayout` makes the normal interface inert only after that admission, rather than while artwork is loading.

Pausing or exiting disables pending wallpaper work. Both rendering and bitmap decoding have cancellation checks; decoded obsolete bitmaps are closed. Rapid resume replaces the preparation scene and immediately hides that new scene until ready, so an interrupted exit cannot expose an empty or stale frame.

Once admitted, a HEX edit retains the last complete frame until the replacement commits. Its source, palette, and artwork reference update together, keeping the existing environment animation synchronized. A rendering failure before admission leaves the normal timer available with a retry explanation. An in-place failure retains the last correct frame. Unrecolored source art is no longer a fallback.

The existing worker, source preparation, eight-entry Blob cache, request deduplication, idle release and timeout are reused without changes.

## Entrance effects

| Effect | Implementation | Timing |
| --- | --- | --- |
| Dreamy portal / watercolor bloom | Three overlapping feathered ellipse masks expand from the normal dial's measured center. Their slightly offset proportions soften the contour; a 5px blur sharpens to the finished artwork. | 800ms |
| Layered parallax | The existing wallpaper moves/scales from a deeper offset while the existing ambient canvas settles from a nearer offset. No image segmentation or duplicate full-size images are needed. | 800–900ms |
| Magical stardust | A feathered horizontal mask reveals the artwork behind a soft light wave and 32 small glowing motes. Each mote disperses and fades as the continuing environment animation takes over. Its color mixes the exact timer HEX with warm cream. | 850ms reveal; motes finish within about 1.03s |

Timer information and controls arrive toward the end of the entrance. Exit is available throughout. Pause, adjustments, Escape, focus trapping and synchronization errors use the existing commands. Focus is captured before admission makes the normal view inert, then restored after exit; if starting already blurred/disabled Play, the normal view supplies an available focus target.

`useScreensaverTransition` selects with a separate random draw: each of the three has probability 1/3 initially, then each of the two alternatives has probability 1/2. This avoids consecutive repeats and preserves symmetric long-run odds. The choice is held for the activation, so ticks, ordinary rerenders and HEX changes do not redraw or replay it. Particle geometry is deterministic and consumes no random draws.

Exits use a separate **180ms opacity fade**, preserving the current entrance pose instead of reversing it. The normal timer controls become available immediately. Reduced motion removes the spatial effects, masks, particles and ambient motion, and uses a **100ms fade** instead.

## Files

- `hooks/useScreensaverWallpaper.ts`: activation-tagged wallpaper choice and persistence.
- `hooks/useScreensaverTransition.ts`: independent, non-repeating entrance choice.
- `components/MainLayout.tsx`: requested versus actually visible screensaver state.
- `components/Screensaver.tsx`: activation readiness, admission, controls and layer composition.
- `components/ScreensaverWallpaper.tsx`: decoded-frame commits and cancellation.
- `components/ScreensaverStardust.tsx`: bounded decorative particle geometry.
- `components/screensaver.css`: entrance masks, depth movement, particles, quick exit and reduced-motion override.

No dependencies, backend changes, schema changes or migrations were added.

## Verification

```powershell
cd frontend
npm.cmd test
npm.cmd run build
```

For browser verification, start Vite on `localhost:5175`, then:

```powershell
playwright-cli.cmd -s=entrances open http://localhost:5175
playwright-cli.cmd -s=entrances run-code --filename=scripts/verify_screensaver_transitions.js
```

For the same checks against built assets, also start `npm.cmd run preview -- --host 127.0.0.1 --port 5176 --strictPort`, and navigate the test tab to `http://localhost:5175/?production=1` before running the script. Vite supplies the artwork catalog; the tested app runs from port 5176.

The harness mocks only API traffic in isolated browser contexts. It uses real images, the recoloring worker, Canvas and CSS. It checks all 15 artwork/entrance combinations with five HEX values, delayed cold loads, synchronized overlays, unchanged entrance counts on ticks/HEX edits, pause/resume, interrupted entrances, manual/keyboard exit, prompt restoration of normal controls and reduced motion. Screenshots stay under ignored `.deployment-private/`. API command assertions verify frontend command wiring; they do not replace real-backend integration tests.

Verification on 2026-10-27: **138 frontend tests** and the production build passed. The 15-case production matrix reported no browser errors or visible frame/palette mismatches. At 900×700 on the test machine, median requestAnimationFrame intervals were approximately 16.7ms. These are local timing samples, not a guarantee for every GPU/device. The final production matrix also verifies keyboard focus after both manual exit and pausing during an entrance. The Impeccable mechanical detector reported no findings in the changed screensaver UI.
