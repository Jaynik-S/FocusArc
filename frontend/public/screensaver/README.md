# Space wallpapers

Production PNGs are text-free edits of the supplied local `mock-screensaver-blue.png`, `mock-screensaver-orange.png` and `mock-screensaver-purple.png`. Generated with the built-in image generation tool on 2026-10-25/26, then visually inspected. The original references remain untouched. No additional clean assets are required.

`src/utils/screensaverTheme.ts` selects the closest authored hue, applies a restrained hue rotation of at most 24° when within 40°, and otherwise uses the original palette. Neutral colors use a desaturated blue. This preserves the painted shading, texture and warm highlights; distant colors intentionally use the closest available illustration. Add further palettes to that configuration for wider color coverage.

The artwork is a separate static layer. UI text, planet ornament, controls, and transitions are HTML/CSS/SVG rendered by `Screensaver.tsx`; none are baked into the PNGs. No celestial animation is implemented.

## Generation prompts

Blue:
> Use case: precise-object-edit. Edit target: the supplied blue FocusArc space illustration. Create a production wallpaper by removing ALL central UI: the words Study Sprint, the digits 18:45, the small central ringed planet icon and its two horizontal decorative lines. Reconstruct uninterrupted matching blue starfield and painterly texture behind these removed elements; no patch, blur rectangle or obvious masked area. Preserve the entire artwork composition, colors, painted texture, planets, rocket, creature, flowers and clouds exactly as closely as possible. Keep the calm dark central negative space around x=50%, y=43% for future live HTML timer text. No text, lettering, numbers, UI controls, watermarks or logos anywhere. Output landscape 16:9 with full composition.

Orange:
> Use case: precise-object-edit. Edit target: supplied orange FocusArc space illustration. Remove ALL central UI: Evening Flow, 31:22, the small central ringed planet icon and two horizontal lines. Reconstruct uninterrupted matching starfield painterly texture behind removed elements, no patch or blurred mask. Keep original warm orange, peach and coral colors, dreamy texture, planets, rocket, creature, flowers, clouds and composition as closely as possible. Keep calm dark center around x50%, y43% as negative space for future live HTML. Absolutely no words, text, numbers, UI controls, logos or watermarks. Landscape16:9 full composition.

Purple:
> Use case: precise-object-edit. Edit target: supplied purple FocusArc space illustration. Remove ALL central UI: Creative Focus, 42:10, small central ringed planet icon and horizontal lines. Reconstruct uninterrupted matching starfield painterly texture behind removed elements with no patch or blurred mask. Keep original violet lavender purple cream colors, dreamy texture, planets, rocket, creature, flowers, clouds and composition as closely as possible. Keep calm dark center around x50%, y43% as negative space for future live HTML. Absolutely no words, text, numbers, UI controls, logos or watermarks. Landscape16:9 full composition.
