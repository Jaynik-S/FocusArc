# Five screensavers randomized on every start or resume

All five supplied illustrations use the existing selective Canvas/Oklab recoloring engine. The active timer's exact HEX still supplies hue, chroma and lightness; the images keep their painted texture, shading and protected cream details. No image-specific pixel-processing parameters were needed after visual validation.

![Five artworks in sage, purple, gold and white](screenshots/screensaver-wallpapers-comparison.png)

## Activation boundaries

Each timer start or resume chooses again, independently of the timer's identity. The previous choice is excluded to avoid consecutive repeats:

| Action | Wallpaper behavior |
|---|---|
| First timer activation | Uniform choice among all five |
| Pause, then Play on the same timer | Choose uniformly among the other four |
| Exit, re-entry, timer ticks, HEX edits or resize | Keep the image; recolor only when HEX changes |
| Start a different timer | Choose uniformly among the other four |
| Pause/Stop or successful reset | Return to the normal view; choose again on the next start |
| New Toronto study day while continuing to run | Keep the image |
| Refresh | Restore the saved image; the normal interface stays visible until the next activation |

Excluding the previous image prevents consecutive repeats. Each remaining image has the same probability, with symmetric long-run chances across all five. Randomness runs only when a running activation changes, including under React StrictMode. A paused-to-running transition also chooses again if an activation ID is reused.

The last choice is stored as `{wallpaperId}` under the account's `screensaverWallpaper` browser-storage key. Old records containing day/timer grouping are still readable, but those fields no longer affect selection. Choices are local presentation preferences, not server-synchronized artwork assignments; separate devices may choose different images. Shared timers, HEX colors and saved sessions remain authoritative on the server. When storage is unavailable, the current mounted app still remembers the previous choice; refresh persistence is best-effort.

## File map and data flow

- `frontend/src/utils/screensaverWallpapers.ts`: centralized stable IDs, labels, source paths and overlay ink; `chooseScreensaverWallpaper` samples the eligible list. Expand the catalog and add a clean source image to support more artwork.
- `frontend/public/screensaver/master-screensaver*.png`: unmodified copies of all five supplied 1672×941 images: Starfield, Moonlit forest, Sky garden, Winter lake and Lantern village. Original root files remain untouched.
- `frontend/src/hooks/useScreensaverWallpaper.ts`: reads/validates the account-scoped last choice and selects on start/resume. A ref records the observed active ID before choosing, preventing StrictMode effect replay from drawing twice. Mounting with an already-running timer restores the saved choice without another random draw.
- `frontend/src/context/TimerRuntimeContext.tsx`: retains timer/reset behavior; the obsolete wallpaper-specific reset counter was removed.
- `frontend/src/components/MainLayout.tsx`: supplies the shared active session to the selection hook, then passes the selected definition to `Screensaver`.
- `Screensaver.tsx`, `ScreensaverWallpaper.tsx` and `screensaver.css`: pass source and HEX through the existing worker/cache. Overlay ink follows the committed Canvas before paint. New activations wait for the exact selected frame, then run an independent random entrance; see [readiness and transitions](screensaver-transitions.md). Sky garden uses dark ink and a light backing for its bright sky; the other scenes retain cream ink. Timer commands and automatic activation remain in the shared runtime.
- `screensaverRecolor.ts`, `screensaverRenderer.ts` and the worker retain the shared mapping, eight-entry source+HEX Blob cache, async race protection and idle cleanup. The master path is now centralized in the catalog and re-exported for compatibility. No per-image mapping branches or new dependencies were added.

The previous complete frame remains visible while another is prepared. Returning to a cached source+HEX needs no new pixel work. Cold source loads remain asynchronous; their first preparation/encode takes measurable time rather than blocking the timer UI.

## Original artwork validation on 2026-10-26

Activation-only randomizer update: **125 frontend tests and the production build passed**. Unit checks cover every start/resume, repeated same-timer pauses, replacement active IDs, no draws on rerenders/day/reset changes, refresh, StrictMode, legacy storage and unavailable storage. Built-app Chrome checks started each of the five wallpapers and verified a different scene on resume; all 25 scene/HEX combinations, animation/source pairing, controls and reduced motion passed with zero browser errors. The local Docker frontend on localhost:5173 was rebuilt and the existing API health check remained OK.

- **112 frontend tests passed**; TypeScript/Vite production build passed.
- Twenty real-worker outputs (five images × sage `#A8D5BA`, dark purple `#42216F`, gold `#E9B44C`, white `#FFFFFF`) were generated and visually inspected. Four distinct image hashes per source and normalized source+HEX cache reuse verified. Sampled cream pixels remained byte-identical per image: **192,771 / 149,348 / 326,496 / 159,369 / 184,269**.
- Inspected all five overlays at 900×700, including white/neutral and dark-purple variants, plus narrow layouts. Sky garden's dark overlay preserves readability without a large panel. Its visible-source callback also fixes initial-fallback/retained-frame contrast races.
- Real local API: each of the five first-choice intervals selected its expected scene in an isolated profile. Pause/resume, Exit/refresh/re-entry, stored artwork, live HEX edits, unchanged running-session identity during color changes, and 320×568 controls passed. Timer switches and successful resets excluded the previous image. **Zero browser errors.**
- Existing two-profile timer checks passed: shared activation/time, persisted +10/−5, normal refresh/dismissal, reporting routes, offline/reconnect, reduced motion, no work on ticks/resize, and functional selected-artwork fallback with Worker disabled.
- Production build smoke-tested all five assets and the bundled worker at localhost:5176 with an isolated mock API: 1672×941 canvases, expected overlay ink, no CSS filters and no browser errors.
- Independent review found and re-reviewed the fallback/ink race; no outstanding findings remained. Full tests and browser verification ran in the parent environment.

## Repeatable checks

With Vite on localhost:5175:

```powershell
playwright-cli.cmd -s=wallpapers open http://localhost:5175 --browser=chrome
playwright-cli.cmd -s=wallpapers run-code --filename=scripts/verify_screensaver_wallpapers.js
```

This generates `.deployment-private/screensaver-wallpapers-comparison.png` without an API. For real timer/selection flows, start the disposable local API on port 8002 and run `scripts/verify_screensaver_rotation.js` or the existing `scripts/verify_screensaver.js`. They create disposable accounts and never target production. Keep source screenshots/reports in the ignored `.deployment-private/` directory.

![Sky garden overlay at 900×700](screenshots/screensaver-sky-garden-900.png)

The original five-wallpaper feature has three commits: catalog/artwork comparison; study selection and overlay integration; final browser checks and documentation. That stage had no backend, schema, dependency or animation changes, and no production deployment. A subsequent [animation layer](screensaver-animations.md) adds scene-specific movement while retaining this selection and static recoloring pipeline.
