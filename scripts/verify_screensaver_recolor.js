// Run with playwright-cli run-code --filename=scripts/verify_screensaver_recolor.js.
// Vite must serve the current frontend on localhost:5175. No account/API is used.
async page => {
  const origin = page.url().split('/').slice(0, 3).join('/');
  if (origin !== 'http://localhost:5175') throw new Error('Use the local frontend on port 5175.');
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(origin + '/screensaver/master-screensaver.png');
  const report = await page.evaluate(async () => {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const colors = [['#A8D5BA','Light sage green'],['#42216F','Dark purple'],['#F3A7BB','Soft pink'],['#377DC2','Blue'],['#E9B44C','Golden yellow'],['#343434','Dark charcoal'],['#FFFFFF','White'],['#FF0000','Bright red']];
    document.title = 'FocusArc · dynamic wallpaper colors';
    document.head.innerHTML = '<link rel="icon" href="data:,"><style>body{margin:0;background:#101418;color:#f5ecdc;font:16px system-ui}header{padding:28px 32px}h1{font-size:26px;margin:0 0 8px}p{margin:0;color:#b5b9c0}main{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:0 24px 24px}article{min-width:0;background:#1c2229}h2{font-size:16px;font-weight:500;display:flex;align-items:center;gap:10px;margin:0;padding:14px 18px}i{width:16px;height:16px;border:1px solid #ffffff44;border-radius:50%}canvas{display:block;width:100%;height:auto}</style>';
    document.body.innerHTML = '<header><h1>FocusArc · dynamic wallpaper colors</h1><p>One master illustration · Canvas recoloring · cream highlights preserved</p></header><main></main>';
    let jobs = 0; let terminated = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(...args) { jobs++; super.postMessage(...args); }
      terminate() { terminated++; super.terminate(); }
    };
    const { renderScreensaver } = await import('/src/utils/screensaverRenderer.ts');
    const master = await createImageBitmap(await (await fetch('/screensaver/master-screensaver.png')).blob());
    const sourceCanvas = new OffscreenCanvas(master.width, master.height);
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceContext.drawImage(master, 0, 0); master.close();
    const original = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;
    const samples = [];
    // Independent warm-cream classification checks real artwork preservation, not the implementation mask.
    for (let i = 0; i < original.length; i += 4) if (original[i] > 210 && original[i + 1] > 200 && original[i + 2] < original[i + 1] && original[i] >= original[i + 1]) samples.push(i);
    assert(samples.length > 10000, 'Expected cream stars/highlights in master');
    const checksum = data => {
      let hash = 2166136261;
      for (let i = 0; i < data.length; i += 13) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    };
    const results = []; const hashes = new Set(); let sageHash = 0;
    let previous = performance.now(); let maxGap = 0;
    const heartbeat = setInterval(() => { const now = performance.now(); maxGap = Math.max(maxGap, now - previous); previous = now; }, 25);
    try {
      for (const [hex, label] of colors) {
        const start = performance.now();
        const blob = await renderScreensaver(hex);
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0); bitmap.close();
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (const offset of samples) for (let channel = 0; channel < 4; channel++) assert(pixels[offset + channel] === original[offset + channel], 'Cream highlight changed for ' + hex);
        const hash = checksum(pixels); hashes.add(hash); if (hex === '#A8D5BA') sageHash = hash;
        const elapsedMs = performance.now() - start;
        const count = jobs; const cachedAt = performance.now(); const cached = await renderScreensaver(hex.toLowerCase());
        const cachedMs = performance.now() - cachedAt;
        assert(cached === blob && jobs === count, 'Normalized cache miss');
        const article = document.createElement('article');
        article.innerHTML = '<h2><i style="background:' + hex + '"></i>' + hex + ' · ' + label + '</h2>';
        article.append(canvas); document.querySelector('main').append(article);
        results.push({ hex, elapsedMs: Math.round(elapsedMs), cachedMs: Number(cachedMs.toFixed(2)), hash });
      }
      assert(hashes.size === colors.length, 'Different HEX codes produced duplicate wallpapers');
      const darkSage = await createImageBitmap(await renderScreensaver('#28553A'));
      sourceCanvas.width = darkSage.width; sourceContext.drawImage(darkSage, 0, 0); darkSage.close();
      assert(checksum(sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data) !== sageHash, 'Same-family brightness/saturation ignored');
      const count = jobs;
      await new Promise(resolve => setTimeout(resolve, 1000));
      assert(jobs === count, 'Reprocessed without source/color change');
      await new Promise(resolve => setTimeout(resolve, 15100));
      assert(terminated === 1, 'Idle worker buffers not released');
      return { results, sourceSize: [sourceCanvas.width, sourceCanvas.height], exactCreamPixelsPreservedPerImage: samples.length, sameFamilyDistinct: true, maxMainThreadProbeGapMs: Math.round(maxGap), workerJobs: jobs, idleWorkersTerminated: terminated };
    } finally { clearInterval(heartbeat); window.Worker = NativeWorker; }
  });
  await page.screenshot({ path: '.deployment-private/screensaver-color-comparison.png', fullPage: true });
  return report;
}
