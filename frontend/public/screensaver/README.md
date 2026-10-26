# Space wallpapers

`master-screensaver.png` is an unmodified copy of the user's supplied clean master. It is the sole source for production Canvas recoloring. All timer text and controls are rendered separately. No additional clean assets are required.

The pixel engine is `src/utils/screensaverRecolor.ts`; its worker and eight-entry Blob cache are separate from timer logic. It derives a palette from exact HEX hue, chroma and lightness, preserving painted texture and warm highlights. See `docs/screensaver-recoloring.md` for the algorithm, comparison preview and limitations. Preset selection and CSS hue filters have been removed.

The artwork is a separate static layer. UI text, planet ornament, controls, and transitions are HTML/CSS/SVG rendered by `Screensaver.tsx`; none are baked into the PNGs. No celestial animation is implemented.

## Legacy reference artwork

The unused blue/orange/purple PNGs remain as references. They were text-free edits of the supplied local mockups, generated with the built-in image generation tool on 2026-10-25/26 and visually inspected. Their original generation prompts follow; these prompts do not apply to the supplied master.

Blue:
> Use case: precise-object-edit. Edit target: the supplied blue FocusArc space illustration. Create a production wallpaper by removing ALL central UI: the words Study Sprint, the digits 18:45, the small central ringed planet icon and its two horizontal decorative lines. Reconstruct uninterrupted matching blue starfield and painterly texture behind these removed elements; no patch, blur rectangle or obvious masked area. Preserve the entire artwork composition, colors, painted texture, planets, rocket, creature, flowers and clouds exactly as closely as possible. Keep the calm dark central negative space around x=50%, y=43% for future live HTML timer text. No text, lettering, numbers, UI controls, watermarks or logos anywhere. Output landscape 16:9 with full composition.

Orange:
> Use case: precise-object-edit. Edit target: supplied orange FocusArc space illustration. Remove ALL central UI: Evening Flow, 31:22, the small central ringed planet icon and two horizontal lines. Reconstruct uninterrupted matching starfield painterly texture behind removed elements, no patch or blurred mask. Keep original warm orange, peach and coral colors, dreamy texture, planets, rocket, creature, flowers, clouds and composition as closely as possible. Keep calm dark center around x50%, y43% as negative space for future live HTML. Absolutely no words, text, numbers, UI controls, logos or watermarks. Landscape16:9 full composition.

Purple:
> Use case: precise-object-edit. Edit target: supplied purple FocusArc space illustration. Remove ALL central UI: Creative Focus, 42:10, small central ringed planet icon and horizontal lines. Reconstruct uninterrupted matching starfield painterly texture behind removed elements with no patch or blurred mask. Keep original violet lavender purple cream colors, dreamy texture, planets, rocket, creature, flowers, clouds and composition as closely as possible. Keep calm dark center around x50%, y43% as negative space for future live HTML. Absolutely no words, text, numbers, UI controls, logos or watermarks. Landscape16:9 full composition.
