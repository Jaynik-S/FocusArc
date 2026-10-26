import { ARTWORK, coverTransform, meteorAt, particlePosition, type EnvironmentPalette, type EnvironmentScene } from "./screensaverAnimation";
import { drawScreensaverLandscape } from "./screensaverLandscape";

const tau = Math.PI * 2;
const point = (x: number, y: number) => ({ x: x * ARTWORK.width, y: y * ARTWORK.height });
const rocketPoint = (t: number) => {
  const a = 1 - t;
  return { x: ARTWORK.width * (a ** 3 * .66 + 3 * a * a * t * .79 + 3 * a * t * t * .82 + t ** 3 * .57),
    y: ARTWORK.height * (a ** 3 * .25 + 3 * a * a * t * .38 + 3 * a * t * t * .53 + t ** 3 * .69) };
};

const glow = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number, stretch = 1) => {
  ctx.save(); ctx.translate(x, y); ctx.scale(stretch, 1); ctx.globalAlpha = alpha;
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, color); gradient.addColorStop(.22, color.replace("rgb(", "rgba(").replace(")", ",0.35)")); gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore();
};
const sparkle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, alpha: number) => {
  glow(ctx, x, y, size * 4, color, alpha * .35);
  ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - size * 1.8); ctx.quadraticCurveTo(x + size * .25, y - size * .2, x + size, y);
  ctx.quadraticCurveTo(x + size * .25, y + size * .2, x, y + size * 1.8);
  ctx.quadraticCurveTo(x - size * .25, y + size * .2, x - size, y);
  ctx.quadraticCurveTo(x - size * .25, y - size * .2, x, y - size * 1.8); ctx.fill();
};

/** All drawing is in original-image coordinates, under the same centered-cover transform. */
export const drawScreensaverEnvironment = (
  ctx: CanvasRenderingContext2D, scene: EnvironmentScene, palette: EnvironmentPalette,
  time: number, width: number, height: number, dpr: number, artwork: HTMLCanvasElement | null = null,
) => {
  const cover = coverTransform(width, height);
  const quiet = (x: number, y: number) => {
    const dx = (cover.x + x * cover.scale - width * .5) / (width * .22);
    const dy = (cover.y + y * cover.scale - height * .49) / (height * .22);
    const strength = Math.max(0, 1 - dx * dx - dy * dy);
    return 1 - .78 * strength * strength;
  };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
  ctx.save(); ctx.translate(cover.x, cover.y); ctx.scale(cover.scale, cover.scale);
  drawScreensaverLandscape(ctx, scene.id, time, artwork);

  for (const p of scene.particles) {
    const { x, y } = particlePosition(p, time);
    const edge = Math.min(1, Math.max(0, y / 40), Math.max(0, (ARTWORK.height - y) / 40));
    const breath = .5 + .5 * Math.sin(time * p.frequency * 2 + p.phase);
    const alpha = edge * quiet(x, y);
    if (p.kind === "firefly") {
      const brightness = (.12 + .82 * breath * breath) * alpha;
      glow(ctx, x, y, p.size * 5.5, palette.warm, brightness * .6);
      ctx.globalAlpha = brightness; ctx.fillStyle = palette.cream; ctx.beginPath(); ctx.arc(x, y, p.size * 1.1, 0, tau); ctx.fill();
    } else if (p.kind === "petal") {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * .4 + p.phase) * .9 + p.phase);
      ctx.scale(.55 + Math.abs(Math.sin(time * .31 + p.phase)) * .45, 1);
      ctx.globalAlpha = alpha * (.5 + p.depth * .35); ctx.fillStyle = palette.petal; ctx.beginPath();
      ctx.moveTo(-p.size, 0); ctx.bezierCurveTo(0, -p.size * .8, p.size * 1.1, -p.size * .4, p.size, 0);
      ctx.bezierCurveTo(0, p.size * .7, -p.size * .9, p.size * .4, -p.size, 0); ctx.fill(); ctx.restore();
    } else {
      const snow = p.kind === "snow";
      ctx.globalAlpha = alpha * (snow ? .3 + p.depth * .55 : .2 + breath * .45);
      ctx.fillStyle = snow ? palette.cream : palette.accent; ctx.beginPath();
      if (snow) ctx.ellipse(x, y, p.size * .75, p.size * (1 + p.depth * .25), -.22, 0, tau);
      else ctx.arc(x, y, p.size * .9, 0, tau);
      ctx.fill();
      if (snow && p.depth > .88 && Math.sin(time * .7 + p.phase) > .98) sparkle(ctx, x, y, p.size, palette.cream, alpha * .4);
    }
  }

  scene.stars.forEach(([nx, ny], index) => {
    const { x, y } = point(nx, ny);
    const brightness = .18 + .62 * (.5 + .5 * Math.sin(time * (.6 + index * .12) + index * 1.7)) ** 3;
    // Painted star centers are already white: breathe light beyond their edges
    // so twinkling remains visible without dimming or repainting the artwork.
    if (scene.id === "space") glow(ctx, x, y, index === 1 || index === 2 ? 90 : 45, palette.cream, brightness * .34);
    sparkle(ctx, x, y, 4 + index % 3 * 1.5, palette.cream, brightness);
  });
  scene.lights.forEach(([nx, ny, radius], index) => {
    const { x, y } = point(nx, ny);
    const flutter = .5 + .3 * Math.sin(time * 1.7 + index) + .15 * Math.sin(time * 3.1 + index * 2.3);
    glow(ctx, x, y, radius * 1.8, palette.warm, .14 + .27 * flutter, scene.id === "village" ? .65 : 1);
  });
  scene.reflections.forEach(([nx, ny], index) => {
    const { x, y } = point(nx, ny);
    const alpha = Math.max(0, Math.sin(time * (.5 + index * .071) + index * 1.9)) ** 8 * .7;
    sparkle(ctx, x, y, 4.2, scene.id === "sky-garden" ? palette.warm : palette.cream, alpha * quiet(x, y));
    if (scene.id !== "sky-garden") {
      ctx.globalAlpha = alpha * .6; ctx.strokeStyle = palette.accent; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x + Math.sin(time * .8 + index) * 12, y + 2, 24 + index * 3, 2, 0, 0, tau); ctx.stroke();
    }
  });

  if (scene.id === "space") {
    const meteor = meteorAt(time);
    if (meteor) {
      const x = (meteor.x + meteor.progress * .16) * ARTWORK.width;
      const y = (meteor.y + meteor.progress * .14) * ARTWORK.height;
      const tail = ctx.createLinearGradient(x - 140, y - 70, x, y);
      tail.addColorStop(0, "transparent"); tail.addColorStop(1, palette.cream);
      ctx.globalAlpha = Math.sin(meteor.progress * Math.PI) * .9; ctx.strokeStyle = tail; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(x - 140, y - 70); ctx.lineTo(x, y); ctx.stroke();
      sparkle(ctx, x, y, 3.2, palette.cream, Math.sin(meteor.progress * Math.PI) * .85);
    }
    // Cubic path follows the painted rocket's luminous curved wake.
    for (let i = 0; i < 3; i++) {
      const t = (time * .08 + i / 3) % 1; const start = Math.max(0, t - .22);
      const head = rocketPoint(t); ctx.beginPath();
      for (let step = 0; step <= 14; step++) {
        const p = rocketPoint(start + (t - start) * step / 14);
        if (step === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.lineCap = "round"; ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 20; ctx.globalAlpha = Math.sin(t * Math.PI) * .18; ctx.stroke();
      ctx.lineWidth = 4; ctx.globalAlpha = Math.sin(t * Math.PI) * .48; ctx.stroke();
      sparkle(ctx, head.x, head.y, 5, palette.cream, Math.sin(t * Math.PI) * .8);
    }
  } else if (scene.id === "sky-garden") {
    const angle = time * .22 + 2.1; const cx = ARTWORK.width * .79; const cy = ARTWORK.height * .225;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.28);
    for (let i = 0; i < 3; i++) {
      const phase = angle + i * tau / 3;
      ctx.globalAlpha = .4; ctx.strokeStyle = palette.warm; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 135, 91, 0, phase - .6, phase); ctx.stroke();
      sparkle(ctx, Math.cos(phase) * 135, Math.sin(phase) * 91, 5, palette.warm, .9);
    }
    glow(ctx, 0, 0, 85, palette.warm, .10 + .10 * Math.sin(time * .6)); ctx.restore();
  } else if (scene.id === "winter") {
    // Low-opacity light ribbons sit over the original northern-light curtains, not the whole sky.
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(time * .16 + i * 1.9) * 42;
      const x = ARTWORK.width * (.32 + i * .17);
      const gradient = ctx.createLinearGradient(0, 0, 0, 360);
      gradient.addColorStop(0, "transparent"); gradient.addColorStop(.4, palette.accent); gradient.addColorStop(1, "transparent");
      ctx.strokeStyle = gradient;
      for (const [lineWidth, alpha] of [[90,.06],[34,.12]]) {
        ctx.globalAlpha = alpha * (.7 + .3 * Math.sin(time * .14 + i)); ctx.lineWidth = lineWidth;
        ctx.beginPath(); ctx.moveTo(x + sway, -20); ctx.bezierCurveTo(x + 52 + sway, 65, x - 45, 210, x - 90 + sway, 340); ctx.stroke();
      }
    }
  } else if (scene.id === "village") {
    for (let i = 0; i < 3; i++) {
      const { x, y } = point(.56 + i * .15 + Math.sin(time * .14 + i * 2.4) * .08, .71 + i * .055);
      glow(ctx, x, y, 38 + i * 5, palette.accent, .07 + Math.sin(time * .24 + i) * .04, 6.5);
    }
  }
  ctx.restore(); ctx.globalAlpha = 1;
};
