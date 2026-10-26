// Local Vite comparison of every registered image through the shared production worker.
// playwright-cli run-code --filename=scripts/verify_screensaver_wallpapers.js
async page => {
  const origin = page.url().split('/').slice(0, 3).join('/');
  if (origin !== 'http://localhost:5175') throw new Error('Use local Vite on port 5175.');
  await page.setViewportSize({ width: 2000, height: 1100 });
  await page.goto(origin + '/screensaver/master-screensaver.png');
  const report = await page.evaluate(async () => {
    const { SCREENSAVER_WALLPAPERS } = await import('/src/utils/screensaverWallpapers.ts');
    const { renderScreensaver } = await import('/src/utils/screensaverRenderer.ts');
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const colors = ['#A8D5BA', '#42216F', '#E9B44C', '#FFFFFF'];
    document.head.innerHTML = '<style>body{margin:0;background:#11161a;color:#fff3dc;font:15px system-ui}header{padding:22px 26px}h1{margin:0 0 8px;font-size:25px}p{margin:0;color:#b9c4cc}main{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0 18px 18px}article{min-width:0;background:#1d252c}h2{margin:0;padding:11px 14px;font-size:14px;font-weight:500;display:flex;gap:8px;align-items:center}i{width:13px;height:13px;border-radius:50%;border:1px solid #ffffff44}canvas{display:block;width:100%;height:auto}</style><link rel="icon" href="data:,">';
    document.body.innerHTML = '<header><h1>FocusArc · five wallpapers, one HEX recoloring engine</h1><p>Sage · dark purple · golden yellow · white. Painterly detail and warm highlights preserved.</p></header><main></main>';
    const results = [];
    for (const wallpaper of SCREENSAVER_WALLPAPERS) {
      const original = await createImageBitmap(await (await fetch(wallpaper.source)).blob());
      const source = new OffscreenCanvas(original.width, original.height);
      const context = source.getContext('2d', { willReadFrequently: true });
      context.drawImage(original, 0, 0); original.close();
      const pixels = context.getImageData(0, 0, source.width, source.height).data;
      const protectedOffsets = [];
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 210 && pixels[i + 1] > 200 && pixels[i + 2] < pixels[i + 1] && pixels[i] >= pixels[i + 1]) protectedOffsets.push(i);
      assert(protectedOffsets.length > 1000, 'No expected cream details: ' + wallpaper.id);
      const hashes = new Set();
      for (const hex of colors) {
        const started = performance.now();
        const blob = await renderScreensaver(hex, wallpaper.source);
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const output = canvas.getContext('2d', { willReadFrequently: true }); output.drawImage(bitmap, 0, 0); bitmap.close();
        const rendered = output.getImageData(0, 0, canvas.width, canvas.height).data;
        for (const offset of protectedOffsets) for (let channel = 0; channel < 4; channel++) assert(rendered[offset + channel] === pixels[offset + channel], 'Protected detail changed: ' + wallpaper.id + hex);
        let hash = 2166136261; for (let i = 0; i < rendered.length; i += 13) hash = Math.imul(hash ^ rendered[i], 16777619);
        hashes.add(hash >>> 0);
        assert(await renderScreensaver(hex.toLowerCase(), wallpaper.source) === blob, 'Source/HEX cache miss');
        const article = document.createElement('article'); article.innerHTML = '<h2><i style="background:' + hex + '"></i>' + wallpaper.name + ' · ' + hex + '</h2>';
        article.append(canvas); document.querySelector('main').append(article);
        results.push({ wallpaper: wallpaper.id, hex, ms: Math.round(performance.now() - started), creamPixelsPreserved: protectedOffsets.length, hash: hash >>> 0 });
      }
      assert(hashes.size === colors.length, 'Colors did not produce distinct images: ' + wallpaper.id);
    }
    return { results, images: SCREENSAVER_WALLPAPERS.length, colors: colors.length, cacheIncludesImageAndHex: true };
  });
  await page.screenshot({ path: '.deployment-private/screensaver-wallpapers-comparison.png', fullPage: true });
  return report;
}
