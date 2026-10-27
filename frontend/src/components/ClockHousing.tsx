import { useId } from "react";

const outer = "M180 9C274 9 343 75 343 166v132c0 32-17 50-45 54-41 7-77 8-118 4-41 4-77 3-118-4-28-4-45-22-45-54V166C17 75 86 9 180 9Z";

const ClockHousing = () => {
  const textureId = useId();
  return (
    <svg className="clock-housing" viewBox="0 0 360 372" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs><pattern id={textureId} patternUnits="userSpaceOnUse" width="360" height="360">
        <image href="/materials/gouache-paper.webp" width="360" height="360" />
      </pattern></defs>
      <path className="clock-housing-base" d={outer} />
      <path className="clock-housing-paint" d={outer} fill={`url(#${textureId})`} />
      <path className="clock-housing-edge" d={outer} />
      <path className="clock-housing-inlay" d="M180 18C269 18 334 80 334 166v132c0 26-13 42-38 46-40 6-76 7-116 3-40 4-76 3-116-3-25-4-38-20-38-46V166C26 80 91 18 180 18Z" />
      <path className="clock-housing-flourish" d="M45 304q8 25 36 25M279 329q28 0 36-25" />
    </svg>
  );
};

export default ClockHousing;
