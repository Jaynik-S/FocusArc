# FocusArc UI design

The working interface translates the screensavers' curved enclosures, layered surfaces, fine painted texture, small luminous landmarks and calm central clearing into a productivity workspace. The midnight-blue and warm-paper themes now use a framed sidebar, compact navigation windows, course medallions and an arched clock housing. Fraunces gives headings a soft illustrated voice; Nunito Sans keeps controls and time readable. Dark mode remains the default; the account's saved theme still wins.

[Dark preview](screenshots/ui-dark-900.png) · [Light preview](screenshots/ui-light-900.png). Both are unedited 900 × 700 screenshots of the local production build using the synthetic fixtures in `scripts/verify_rebrand.js`, captured on 2026-10-26 (America/Toronto). They contain no account data.

## Implementation

- `frontend/src/styles.css` defines the shared theme, type, spacing and component rules for the sidebar, timer, authentication, forms, dialogs, History, Schedule and both Stats views. The design system is recorded in [DESIGN.md](../DESIGN.md) and `.impeccable/design.json`.
- `BrandMark.tsx` supplies the decorative SVG used by the sidebar and authentication screen. `PrimaryNav.tsx` keeps the four routes in compact icon-and-text windows. The favicon uses the same arc-and-star geometry.
- `SoftFrame.tsx` draws the softly contoured native-control surface used by navigation, course selection and Play. `ClockHousing.tsx` supplies the layered arched clock surround. Both use React's existing `useId` for unique SVG material patterns. `OrnamentRule.tsx` repeats a small curved line-and-star motif between functional groups. All three are decorative geometry; the existing native links, buttons and labels remain the interactive elements.
- `MainLayout.tsx` derives `--app-accent` from the selected timer, falling back to the active timer. The medallion, progress and principal-action face retain that HEX as their base; neutral material does not choose a palette. Mixed ink supplies readable focus and quieter filters. `getContrastColor` uses true black when neither the existing dark ink nor white reaches 4.5:1, covering vivid red and middle gray without changing their HEX.
- `Sidebar.tsx` uses a neutral painted frame and a contrasting star medallion for the selected course, with exact-color dots for the others. Its inset folio and two-row navigation leave enough room for course names, totals and footer controls.
- `TimersPage.tsx` preserves the hourly progress fraction, open SVG bezel, twelve ticks and star endpoint. The readout keeps its original text semantics while reducing the colon weight. Round adjustment knobs flank a contoured Play/Pause plaque. Existing start, pause, adjustment, empty-selection guards and screensaver behavior remain intact.
- `DayTimeline.tsx` gives sessions too short for an inline label separate, normal-sized selection rows. `SessionBlock.tsx` keeps their original timeline geometry and accessible time range while omitting clipped inline text. Both selection paths open the existing session adjustment controls; adjacent short sessions remain individually selectable.
- Fonts are served from `frontend/public/fonts/`; adjacent license files and `asset-provenance.md` record their official sources. The unmodified Fraunces variable font uses softness 55 and wonk 1 for headings; no font service is contacted at runtime. No package dependency or backend/schema change was added.
- `frontend/public/materials/gouache-paper.webp` is a neutral material generated with the built-in image tool. It was losslessly encoded from PNG with identical decoded RGBA hashes, reducing delivery size by about 38%. Its exact prompt and provenance are retained in `asset-provenance.md`. Soft-light blending and lower-contrast ambient treatment supply paper tooth without scenes, objects, wallpaper crops or procedural noise. The original screensavers are untouched.

## Compact layouts

The primary layout is 900 × 700: a 208px column containing a 200px inset sidebar, and an approximately 316px framed clock with its actions visible together. Dense review pages scroll inside the main area. Short desktop windows compact navigation and the dial; narrow windows use a horizontal course list and vertical page scrolling. Native controls and keyboard focus retain their semantics.

## Verification

The current artistic refinement passed all 129 frontend tests and the production build. The final Docker frontend passed the isolated browser check with 30 captures and no uncaught page errors. This includes actual display-font/material loading, compact housing bounds, sampled action and selected-course contrast in both themes, visible keyboard focus and field tab order, short-session selection, and Play → screensaver → Exit → Pause. This is a Chromium UI regression check rather than a full accessibility audit.

A fresh Impeccable full review inspected all 30 captures, the original artwork, the rejected flat version and the current source. Typography, material, ground, artwork translation and all five direction-contract promises matched. Its only material finding was stale system documentation. After DESIGN.md, its sidecar and PRODUCT.md were reconciled, the reviewer scored that finding **resolved**, identified no batch regressions and returned `disposition: ship`. The follow-up verdict covers the scored documentation closeout; the earlier full review supplies the visual assessment.

The single detector pass reported a Fraunces familiarity warning. The independent reviewer accepted the type's suitability in the actual render; the warning is a contextual choice, not an undisclosed clean scan. The new material's provenance scan reports one raster and no missing records.

From `frontend/`:

```powershell
npm.cmd test
npm.cmd run build
```

The isolated visual/interaction check uses synthetic data and intercepts API calls; it does not write to an account. With the local Docker app running, from the project root:

```powershell
playwright-cli.cmd -s=rebrand open http://localhost:5173
playwright-cli.cmd -s=rebrand run-code --filename=scripts/verify_rebrand.js
playwright-cli.cmd -s=rebrand close
```

The script captures 30 viewport images under `.impeccable/review/`: all normal routes and create/edit/reset/validation dialogs in both themes, adjacent short sessions, authentication, running/empty/error states, a long course name, 1440 × 900, 900 × 700, 900 × 400, 390 × 844 and 320 × 568. It asserts compact layout bounds, exact accent propagation and text contrast for black, white, vivid red, middle gray and a custom blue, short-session marker geometry and selection targets, and Play → screensaver → Exit → Pause. Generated captures and browser logs are ignored by Git. Inspect the returned `errors` array as well as the command output.

To refresh the locally served app after changing source:

```powershell
docker compose up -d --build --no-deps web
```

Open [the local app](http://localhost:5173). This rebuilds the web service without restarting the API or database.
