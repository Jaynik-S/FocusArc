# Asset provenance

Source and license notes live here so Vite does not copy documentation into the production payload.

## Fonts

- **Fraunces variable TTF:** unmodified official Google Fonts binary from <https://github.com/google/fonts/tree/main/ofl/fraunces>, downloaded 2026-10-26. Headings use softness 55 and wonk 1.
- **Nunito Sans Latin variable WOFF2:** official Google Fonts CSS API binary from `fonts.gstatic.com/s/nunitosans/v19/`; source project: <https://github.com/google/fonts/tree/main/ofl/nunitosans>.
- Both fonts are served locally with no runtime font-service request. Their SIL Open Font License files remain adjacent to the shipped binaries under `frontend/public/fonts/`.

## Interface material

`frontend/public/materials/gouache-paper.webp` is a neutral grayscale material generated with the built-in image tool on 2026-10-26. The generated PNG was losslessly encoded to WebP with FFmpeg; decoded RGBA frame hashes were identical and delivery size decreased from 3,032,613 to 1,879,550 bytes. The original PNG remains outside the shipping asset directory.

Generation prompt:

> Create one production material texture asset for a cozy illustrated productivity app. A square 1024 by 1024 seamless, edge-to-edge neutral grayscale gouache-on-fine-paper texture. This is only a material swatch: no composition, objects, stars, leaves, clouds, lettering, borders, vignettes, lighting direction, highlights, symbols, or illustrations. The entire image is an even middle gray, with delicate authentic fine paper tooth, tiny soft pigment granules, and broad barely visible overlapping dry-brush traces. Restrained local value variation around 50% gray, approximately 42–58% grayscale, perfectly neutral with equal red/green/blue. Uniform illumination and detail across all edges, suitable for seamless repeat. Quiet and refined, not distressed, dirty, scratched, rough, high-contrast, digital noise, or fabric weave. Intended for a soft-light material overlay on interface surfaces; text must remain readable. Deliver the finished full-bleed texture only.

## Screensavers

`master-screensaver.png` and `master-screensaver-2.png` through `master-screensaver-5.png` are unmodified copies of the five supplied clean masters. They are the production Canvas sources registered in `frontend/src/utils/screensaverWallpapers.ts`; live timer text and controls are separate HTML/CSS/SVG.

