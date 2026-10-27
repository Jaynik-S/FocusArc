import { type CSSProperties } from "react";

// Fixed particle geometry leaves the transition random draw independent of decoration.
const particles = Array.from({ length: 32 }, (_, index) => ({
  x: 3 + (index * 37 % 94), y: 6 + (index * 53 % 88),
  size: 3 + index % 4, drift: (index % 2 ? 1 : -1) * (12 + index % 5 * 7),
}));

const ScreensaverStardust = () => <div className="screensaver-stardust" aria-hidden="true">
  <div className="screensaver-dust-wave" />
  {particles.map((particle, index) => <i key={index} style={{
    "--dust-x": `${particle.x}%`, "--dust-y": `${particle.y}%`, "--dust-size": `${particle.size}px`,
    "--dust-drift": `${particle.drift}px`, "--dust-delay": `${particle.x * 4}ms`,
  } as CSSProperties} />)}
</div>;

export default ScreensaverStardust;
