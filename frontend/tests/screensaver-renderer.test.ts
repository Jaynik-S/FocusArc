import { afterEach, beforeEach, expect, it, vi } from "vitest";

const instances: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { instances.push(this); }
  finish(blob = new Blob(["rendered"], { type: "image/png" }), index = 0) {
    this.onmessage?.({ data: { id: this.postMessage.mock.calls[index][0].id, blob } });
    return blob;
  }
}
beforeEach(() => { instances.length = 0; vi.resetModules(); vi.useFakeTimers(); vi.stubGlobal("Worker", FakeWorker); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("shares concurrent work and caches normalized exact HEX colors by source", async () => {
  const { renderScreensaver } = await import("../src/utils/screensaverRenderer");
  const first = renderScreensaver("#a8d5ba");
  const duplicate = renderScreensaver(" #A8D5BA ");
  expect(instances[0].postMessage).toHaveBeenCalledTimes(1);
  const blob = instances[0].finish();
  expect(await first).toBe(blob); expect(await duplicate).toBe(blob);
  expect(await renderScreensaver("#A8D5BA")).toBe(blob);
  const another = renderScreensaver("#A8D5BA", "/another.png");
  expect(instances[0].postMessage).toHaveBeenCalledTimes(2);
  instances[0].finish(undefined, 1); await another;
});

it("bounds completed image memory and releases idle worker source buffers", async () => {
  const { renderScreensaver } = await import("../src/utils/screensaverRenderer");
  for (let i = 0; i < 9; i++) {
    const pending = renderScreensaver("#00000" + i);
    instances[0].finish(undefined, i); await pending;
  }
  const evicted = renderScreensaver("#000000");
  expect(instances[0].postMessage).toHaveBeenCalledTimes(10);
  instances[0].finish(undefined, 9); await evicted;
  await vi.advanceTimersByTimeAsync(16000);
  expect(instances[0].terminate).toHaveBeenCalledTimes(1);
  await renderScreensaver("#000000");
  expect(instances).toHaveLength(1);
});

it("cleans up failed jobs and can render again after a worker crash or timeout", async () => {
  const { renderScreensaver } = await import("../src/utils/screensaverRenderer");
  const first = renderScreensaver("#FF0000");
  const rejected = expect(first).rejects.toThrow();
  instances[0].onerror?.(); await rejected;
  const retry = renderScreensaver("#FF0000");
  instances[1].finish(); await retry;
  const stalled = renderScreensaver("#FFFFFF");
  const timedOut = expect(stalled).rejects.toThrow(/timed out/);
  await vi.advanceTimersByTimeAsync(21000); await timedOut;
  expect(instances[1].terminate).toHaveBeenCalledTimes(1);
});
