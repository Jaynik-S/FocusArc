import { MASTER_SCREENSAVER, normalizeScreensaverColor } from "./screensaverRecolor";

const cache = new Map<string, Blob>();
const pending = new Map<string, Promise<Blob>>();
const jobs = new Map<number, { key: string; resolve: (blob: Blob) => void; reject: (error: Error) => void; timeout: number }>();
let worker: Worker | null = null;
let nextId = 0;
let idleTimer: number | undefined;

const releaseWorker = () => {
  window.clearTimeout(idleTimer);
  worker?.terminate(); worker = null;
};
const failWorker = (message: string) => {
  releaseWorker();
  for (const job of jobs.values()) {
    window.clearTimeout(job.timeout);
    pending.delete(job.key); job.reject(new Error(message));
  }
  jobs.clear();
};
const getWorker = () => {
  if (worker) return worker;
  worker = new Worker(new URL("../workers/screensaver.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
    const job = jobs.get(event.data.id);
    if (!job) return;
    jobs.delete(event.data.id); pending.delete(job.key); window.clearTimeout(job.timeout);
    if (event.data.blob instanceof Blob) {
      cache.delete(job.key); cache.set(job.key, event.data.blob);
      if (cache.size > 8) cache.delete(cache.keys().next().value!);
      job.resolve(event.data.blob);
    } else job.reject(new Error(event.data.error || "Artwork rendering failed."));
    if (jobs.size === 0) idleTimer = window.setTimeout(releaseWorker, 15_000);
  };
  worker.onerror = () => failWorker("Artwork worker unavailable.");
  worker.onmessageerror = () => failWorker("Artwork worker response could not be read.");
  return worker;
};

/** Cache Blobs, never object URLs/DOM nodes. Each view owns only its current decoded frame. */
export const renderScreensaver = (hex: string, source = MASTER_SCREENSAVER): Promise<Blob> => {
  const color = normalizeScreensaverColor(hex);
  const sourceUrl = new URL(source, window.location.href).href;
  const key = `${sourceUrl}|${color}`;
  const cached = cache.get(key);
  if (cached) { cache.delete(key); cache.set(key, cached); return Promise.resolve(cached); }
  const existing = pending.get(key);
  if (existing) return existing;
  window.clearTimeout(idleTimer);
  let resolve!: (blob: Blob) => void; let reject!: (error: Error) => void;
  const promise = new Promise<Blob>((done, failed) => { resolve = done; reject = failed; });
  const id = ++nextId;
  pending.set(key, promise);
  jobs.set(id, { key, resolve, reject, timeout: window.setTimeout(() => failWorker("Artwork rendering timed out."), 20_000) });
  try { getWorker().postMessage({ id, color, source: sourceUrl }); }
  catch { failWorker("Artwork processing is unsupported or unavailable."); }
  return promise;
};
