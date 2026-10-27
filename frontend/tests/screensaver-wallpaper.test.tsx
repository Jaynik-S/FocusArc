import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ScreensaverWallpaper from "../src/components/ScreensaverWallpaper";

const state = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("../src/utils/screensaverRenderer", () => ({ renderScreensaver: state.render }));
const drawImage = vi.fn(); const clearRect = vi.fn(); const close = vi.fn();
const pixels = new Blob(["pixels"]);
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage, clearRect } as any);
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1672, height: 941, close }));
  state.render.mockResolvedValue(pixels);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("draws a decoded frame once, reuses it across timer renders and closes its bitmap", async () => {
  const view = render(<ScreensaverWallpaper color="#A8D5BA" />);
  await waitFor(() => expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-color")).toBe("#A8D5BA"));
  view.rerender(<ScreensaverWallpaper color="#a8d5ba" />);
  expect(state.render).toHaveBeenCalledTimes(1);
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});

it("ignores obsolete color results while keeping the old frame until the next is ready", async () => {
  let old!: (blob: Blob) => void;
  state.render.mockReturnValueOnce(new Promise<Blob>(resolve => { old = resolve; }));
  const view = render(<ScreensaverWallpaper color="#FF0000" />);
  view.rerender(<ScreensaverWallpaper color="#A8D5BA" />);
  await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(1));
  await act(async () => old(pixels));
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-color")).toBe("#A8D5BA");
});

it("does not expose unrecolored artwork after a processing failure", async () => {
  state.render.mockRejectedValueOnce(new Error("Worker unavailable"));
  render(<ScreensaverWallpaper color="#FFFFFF" />);
  await waitFor(() => expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-render-state")).toBe("error"));
  expect(screen.getByTestId("screensaver-wallpaper").style.backgroundImage).toBe("");
  expect(screen.getByTestId("screensaver-wallpaper").querySelector("canvas")?.style.visibility).toBe("hidden");
});

it("closes a decoded bitmap when unmounted during decoding", async () => {
  let decoded!: (bitmap: unknown) => void;
  vi.mocked(createImageBitmap).mockReturnValueOnce(new Promise(resolve => { decoded = resolve; }));
  const view = render(<ScreensaverWallpaper color="#377DC2" />);
  await waitFor(() => expect(createImageBitmap).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => decoded({ width: 1672, height: 941, close }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(drawImage).not.toHaveBeenCalled();
});

it("keeps the previous frame visible and reports loading when only the source changes", async () => {
  const view = render(<ScreensaverWallpaper color="#377DC2" />);
  await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(1));
  state.render.mockReturnValueOnce(new Promise(() => {}));
  view.rerender(<ScreensaverWallpaper color="#377DC2" source="/new-master.png" />);
  expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-render-state")).toBe("loading");
  expect(screen.getByTestId("screensaver-wallpaper").querySelector("canvas")?.style.visibility).toBe("visible");
  expect(clearRect).not.toHaveBeenCalled();
});

it("reports only committed canvas sources and retains the old source until the next commit", async () => {
  const ready = vi.fn();
  let finish!: (blob: Blob) => void;
  const view = render(<ScreensaverWallpaper color="#FFFFFF" source="/sky-garden.png" onVisibleSource={ready} />);
  expect(ready).not.toHaveBeenCalled();
  await waitFor(() => expect(drawImage).toHaveBeenCalledTimes(1));
  state.render.mockReturnValueOnce(new Promise<Blob>(resolve => { finish = resolve; }));
  view.rerender(<ScreensaverWallpaper color="#FFFFFF" source="/forest.png" onVisibleSource={ready} />);
  expect(ready).toHaveBeenLastCalledWith("/sky-garden.png");
  await act(async () => finish(pixels));
  expect(drawImage).toHaveBeenCalledTimes(2);
  expect(ready).toHaveBeenLastCalledWith("/forest.png");
});

it("reports the displayed HEX with its source, retaining both until recoloring finishes", async () => {
  const visible = vi.fn();
  const view = render(<ScreensaverWallpaper color="#A8D5BA" onVisibleFrame={visible} />);
  expect(visible).not.toHaveBeenCalled();
  await waitFor(() => expect(visible).toHaveBeenLastCalledWith(expect.objectContaining({ color: "#A8D5BA" })));
  const artwork = screen.getByTestId("screensaver-wallpaper").querySelector("canvas");
  expect(visible).toHaveBeenLastCalledWith(expect.objectContaining({ artwork }));
  let finish!: (blob: Blob) => void;
  state.render.mockReturnValueOnce(new Promise<Blob>(resolve => { finish = resolve; }));
  view.rerender(<ScreensaverWallpaper color="#42216F" onVisibleFrame={visible} />);
  expect(visible).toHaveBeenLastCalledWith(expect.objectContaining({ color: "#A8D5BA" }));
  await act(async () => finish(pixels));
  expect(visible).toHaveBeenLastCalledWith(expect.objectContaining({ color: "#42216F" }));
});

it("retains the last matched scene and palette after a painted-frame failure", async () => {
  const visible = vi.fn();
  const view = render(<ScreensaverWallpaper color="#A8D5BA" onVisibleFrame={visible} />);
  await waitFor(() => expect(visible).toHaveBeenLastCalledWith(expect.objectContaining({ color: "#A8D5BA" })));
  state.render.mockRejectedValueOnce(new Error("Rendering failed"));
  view.rerender(<ScreensaverWallpaper color="#FF0000" source="/forest.png" onVisibleFrame={visible} />);
  await waitFor(() => expect(screen.getByTestId("screensaver-wallpaper").getAttribute("data-render-state")).toBe("error"));
  expect(visible).toHaveBeenLastCalledWith(expect.objectContaining({ source: "/screensaver/master-screensaver.png", color: "#A8D5BA" }));
});
