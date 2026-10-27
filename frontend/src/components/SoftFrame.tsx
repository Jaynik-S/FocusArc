import { useId } from "react";

const contour = "M17 5Q90-1 163 5L174 14Q181 30 174 46L163 55Q90 61 17 55L6 46Q-1 30 6 14Z";

/** Decorative geometry keeps the native link or button as the actual control. */
const SoftFrame = () => {
  const textureId = useId();
  return (
    <svg className="soft-frame" viewBox="0 0 180 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><pattern id={textureId} patternUnits="userSpaceOnUse" width="240" height="240">
        <image href="/materials/gouache-paper.webp" width="240" height="240" />
      </pattern></defs>
      <path className="soft-frame-fill" d={contour} />
      <path className="soft-frame-paint" d={contour} fill={`url(#${textureId})`} />
      <path className="soft-frame-edge" d={contour} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default SoftFrame;
