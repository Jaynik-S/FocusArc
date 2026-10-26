import { prepareArtwork, recolorArtwork } from "../utils/screensaverRecolor";

type Source = { width: number; height: number; artwork: ReturnType<typeof prepareArtwork> };
let loaded: { url: string; promise: Promise<Source> } | null = null;

const loadSource = (url: string) => {
  if (loaded?.url === url) return loaded.promise;
  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Master artwork could not be loaded.");
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas processing is unavailable.");
      context.drawImage(bitmap, 0, 0);
      return { width: canvas.width, height: canvas.height, artwork: prepareArtwork(context.getImageData(0, 0, canvas.width, canvas.height).data) };
    } finally { bitmap.close(); }
  })();
  loaded = { url, promise };
  promise.catch(() => { if (loaded?.promise === promise) loaded = null; });
  return promise;
};

self.onmessage = async (event: MessageEvent<{ id: number; source: string; color: string }>) => {
  const { id, source, color } = event.data;
  try {
    const { width, height, artwork } = await loadSource(source);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas processing is unavailable.");
    const frame = context.createImageData(width, height);
    frame.data.set(recolorArtwork(artwork, color));
    context.putImageData(frame, 0, 0);
    self.postMessage({ id, blob: await canvas.convertToBlob({ type: "image/png" }) });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Artwork rendering failed." });
  }
};
