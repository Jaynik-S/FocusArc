import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import App from "../src/App";

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

it("waits for the authoritative account date before opening Schedule", async () => {
  let finish!: (response: Response) => void;
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input) => {
    const url = new URL(String(input)); requests.push(url);
    if (url.pathname.endsWith("/auth/session")) return json({ username: "workspace" });
    if (url.pathname.endsWith("/study-state")) return new Promise<Response>((resolve) => { finish = resolve; });
    return json({ timers: [], sessions: [] });
  }));
  render(<MemoryRouter initialEntries={["/schedule"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>);
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  expect(screen.getByRole("status").textContent).toContain("Loading shared study data");
  expect(screen.queryByRole("heading", { name: "Schedule" })).toBeNull();
  expect(requests.some((url) => url.pathname.endsWith("/schedule/day"))).toBe(false);
  await act(async () => finish(json({ changed: true, username: "workspace", revision: 0, server_now: "2026-10-25T16:00:00Z", study_timezone: "America/Toronto", day_date: "2026-10-25", day_start_at: "2026-10-25T04:00:00Z", day_end_at: "2026-10-26T04:00:00Z", lease_expires_at: null, timers: [], active_session: null })));
  expect(await screen.findByRole("heading", { name: "Schedule" })).toBeTruthy();
  await waitFor(() => expect(requests.some((url) => url.pathname.endsWith("/schedule/day") && url.searchParams.get("day_date") === "2026-10-25" && url.searchParams.get("expected_revision") === "0")).toBe(true));
});
