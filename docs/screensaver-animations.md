# Animated screensaver worlds

The original illustrations remain intact. A transparent Canvas adds movement between the recolored artwork and the timer controls. Static pixel recoloring still runs only when source/HEX changes; animation never sends work to that worker.

## Scene direction

| Wallpaper ID | Ambient motion | Landmarks and occasional moments |
|---|---|---|
| `space` | Slow cosmic dust and independently timed star twinkles | Short, tapered meteors at irregular intervals; small glints following the painted rocket trail |
| `forest` | Wandering, breathing fireflies and floating pollen | Warm light at the character's lantern and smaller lamps; intermittent water sparkles |
| `sky-garden` | Tumbling petals and drifting magical motes | Moving glint and short shimmer arc around the painted celestial ornament |
| `winter` | Continuous snowfall with depth-dependent sizes and speeds | Restrained moving aurora ribbons, warm igloo light, occasional snow and ice glints |
| `village` | Fireflies, motes and slow mist over the river | Individually flickering warm windows/lanterns and intermittent reflections |

The illustration itself does not rotate, deform or scroll. Existing painted stars and lights stay present while small animated highlights vary above them. A soft quiet region behind the timer reduces particle intensity without hiding the environment.

## Runtime and visible-frame synchronization

1. The existing selection hook supplies a catalog definition. Same-timer pause/resume retains the wallpaper; switching timers or crossing the established day/reset boundaries chooses another.
2. `ScreensaverWallpaper.tsx` prepares static artwork through the existing source+HEX cache. Its new `onVisibleFrame` callback reports `{source, color}` for the **committed** Canvas frame. The existing `onVisibleSource` API remains available.
3. `Screensaver.tsx` resolves the animation ID and text ink from that visible source. During asynchronous recoloring, the old scene and palette remain paired with the retained image. Successful commits update palette before paint; raw fallback uses the original artwork's blue palette.
4. `ScreensaverEnvironment.tsx` keeps one deterministic scene model per visible ID. HEX changes replace the palette and repaint the current instant without restarting motion. The component key changes only when the actually visible wallpaper ID changes, preventing an old scene buffer from appearing over a new painting.
5. A ref stores elapsed animation time. Timer ticks do not regenerate particles or restart the loop. Exit/pause freezes the mounted scene; same-world resume continues it. Refresh or a different scene starts a fresh animation clock. Animation state is decorative and is not saved to the server.

The canvas is `aria-hidden` and `pointer-events: none`. Existing controls, keyboard behavior, session ownership and shared study time remain in their existing components.

## Coordinate and color conventions

All five originals are **1672 × 941**. `coverTransform` uses `max(viewWidth / 1672, viewHeight / 941)` and centered offsets, matching the background's `object-fit: cover`. Draw in original-image coordinates, not screen coordinates. Profile anchors use fractions of the original width/height. Cropped landmarks and their effects disappear together at narrow aspect ratios.

`environmentPalette` derives ambient accents and petals from the displayed six-digit HEX. Bright sky-garden artwork receives darker accents for contrast. Cream stars/snow and warm lamps keep appropriate neutral/warm highlights. This is a small animation palette, separate from the static artwork's Oklab pixel mapper; adding an effect never requires a table of timer colors.

## Extending an environment

- **Particle behavior or population:** edit the profile and `particlePosition` in `frontend/src/utils/screensaverAnimation.ts`. Seeded randomness gives each scene repeatable variation without consuming wallpaper-selection randomness.
- **An anchored light:** add its fractional source-image position and radius to the scene's `lights`. The shared renderer supplies gentle, staggered flicker.
- **Stars/reflections:** add artwork anchors to the corresponding arrays. Each receives different timing.
- **A custom feature:** add a small scene-specific drawing block in `frontend/src/utils/drawScreensaverEnvironment.ts`, using the supplied palette/time and balanced Canvas `save`/`restore`. Examples are the rocket's cubic trail, the temple's orbital glint and the winter aurora.
- **New artwork:** add its catalog entry and animation profile, inspect its landmarks and contrast, and adapt the shared source-coordinate dimensions if its aspect/resolution differs. Do not copy timer or animation lifecycle code.

Keep elements sparse, stagger their phases and speeds, and fade special events in/out. Check several seconds of actual movement over both light and dark artwork; a single screenshot cannot establish animation quality.

## Resource policy

The renderer targets 30 drawing updates per second and caps backing-store DPR at 2. It uses bounded particle populations (30–80 per scene), small gradients and paths, with no image filters or per-frame React state. `ResizeObserver` resizes only the overlay; it does not recolor the artwork.

Inactive screensavers and hidden documents cancel their RAF callback. Resume excludes the hidden interval to avoid jumping forward. Reduced-motion preference clears/hides the overlay and schedules no frames; the complete recolored illustration and controls remain. Cleanup cancels RAF, disconnects the observer and removes resize, visibility and media-query listeners. Canvas failure leaves artwork and controls usable.

## Repeating verification

Verified on 2026-10-26:

- **123 frontend tests passed**, including source/HEX races, fallback after a painted frame, scene identity, deterministic particles, cover geometry, palette extremes, hidden-time exclusion, native preference caching and cleanup. TypeScript/Vite production build passed.
- Real Chrome against the **built app**: all five scenes × sage `#A8D5BA`, dark purple `#42216F`, white, vivid `#FF5733` and black produced nonempty overlays. Timed frame hashes changed, timer ticks did not request static recoloring, source/HEX pairs remained synchronized, same-world resumes retained the Canvas, and a different visible scene replaced it. Inspected timed frames, themed views and narrow layouts.
- Native reduced-motion emulation cleared effects and stopped drawing, then resumed correctly. Hidden-document and Exit checks stopped drawing; 320×568 backing-store sizing passed. Unit tests additionally verified DPR capping and unmount listener/RAF/observer cleanup.
- Final real local API run with independent Tokyo/Los Angeles browser profiles passed shared timer activation/time, persisted +10/−5, pause/resume, Exit/Escape/refresh, remote HEX updates without a new session, reporting routes, offline/reconnect, 320×568 and 900×400 controls, and Worker-disabled fallback, with zero browser errors.
- All five original root PNGs still match their public copies byte-for-byte (SHA-256). No source-artwork, backend, schema or dependency changes.

Observed at 900×700 with browser instrumentation and screenshots running:

| Scene | Drawing updates/s | Average draw (ms) | 95th percentile (ms) |
|---|---:|---:|---:|
| Space | 27.7 | 0.29 | 0.5 |
| Forest | 27.4 | 0.45 | 0.8 |
| Sky garden | 27.3 | 0.28 | 0.6 |
| Winter | 27.4 | 0.33 | 0.7 |
| Village | 29.0 | 0.41 | 0.8 |

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

The browser script uses an isolated mock API, captures timed frame sequences and screenshots in five HEX themes per world under ignored `.deployment-private/`, compares moving frame hashes, measures draw cost/rate, checks stable worker-job counts, source/palette pairing, same-world identity, reduced motion, hidden/exit stopping and narrow layouts. The automated browser exposes all tabs as visible, so the document-hidden branch uses a temporary property override with a dispatched visibility event; unit tests independently cover its clock and cancellation behavior. Reduced-motion checks use native browser emulation.

The motion loop caches the initial media preference and updates it from change events. Reading native `MediaQueryList.matches` on every frame suppressed change delivery in a reproducible Chrome integration case; the event-driven version passes native reduce/resume checks and has a regression test for a single initial read.

To test the production bundle, run `npm.cmd run preview -- --host localhost --port 5176 --strictPort` **from `frontend`**, then add `?production=1` to the initial Vite image URL. An optional `&scene=forest` (or `?scene=forest`) runs one world. The existing `scripts/verify_screensaver.js` exercises real persisted timers against the disposable local API on port 8002; it never targets production.
