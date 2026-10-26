import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyStudyDataChanged } from "../src/api/dataEvents";
import { useApiResource } from "../src/hooks/useApiResource";
import { useTimers } from "../src/hooks/useTimers";

const state = vi.hoisted(() => ({ revision: 3 as number | null, snapshot: null as null | { timers: unknown[] }, sync: vi.fn() }));
vi.mock("../src/contexts/AuthContext", () => ({ useAuth: () => ({ user: { username: "reader" } }) }));
vi.mock("../src/api/studySyncState", () => ({
  getStudyRevision: () => state.revision,
  getStudySnapshot: () => state.snapshot,
  getStudyAccount: () => null,
  isStudySyncRegistered: () => false,
  requestStudySync: () => state.sync(),
}));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
beforeEach(() => { state.revision = 3; state.snapshot = null; state.sync.mockReset(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("revision-aware study readers", () => {
  it("keeps current report data visible while refreshing the same filter", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ seconds: 1800 })).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })));
    const hook = renderHook(() => useApiResource<{ seconds: number }>("/stats/day?day_date=2026-10-25"));
    await waitFor(() => expect(hook.result.current.data?.seconds).toBe(1800));
    act(() => notifyStudyDataChanged());
    expect(hook.result.current.data?.seconds).toBe(1800);
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    await act(async () => { finish(json({ seconds: 2400 })); });
    await waitFor(() => expect(hook.result.current.data?.seconds).toBe(2400));
  });

  it("guards a report read with the accepted account revision", async () => {
    const requests: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => { requests.push(new URL(String(url))); return json({ seconds: 1800 }); }));
    const hook = renderHook(() => useApiResource<{ seconds: number }>("/sessions?from=2026-10-25&to=2026-10-25"));
    await waitFor(() => expect(hook.result.current.data?.seconds).toBe(1800));
    expect(requests[0].searchParams.get("expected_revision")).toBe("3");
  });

  it("reconciles a stale read before retrying it with the new revision", async () => {
    const requests: URL[] = [];
    state.sync.mockImplementation(async () => { state.revision = 4; });
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const parsed = new URL(String(url)); requests.push(parsed);
      return parsed.searchParams.get("expected_revision") === "4" ? json({ seconds: 2400 }) : json({ detail: "Study data changed" }, 409);
    }));
    const hook = renderHook(() => useApiResource<{ seconds: number }>("/schedule/day?day_date=2026-10-25"));
    await waitFor(() => expect(hook.result.current.data?.seconds).toBe(2400));
    expect(requests.map((url) => url.searchParams.get("expected_revision"))).toEqual(["3", "4"]);
  });

  it("uses snapshot timer metadata rather than requesting an independent counter copy", async () => {
    state.snapshot = { timers: [{ id: "timer", name: "Shared course", cycle_total_seconds: 0, completed_today_seconds: 1800, color: "#7c83ff", icon: "book", is_archived: false, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }] };
    const fetchMock = vi.fn(async () => json({ timers: [] })); vi.stubGlobal("fetch", fetchMock);
    const hook = renderHook(() => useTimers());
    await waitFor(() => expect(hook.result.current.timers[0]?.name).toBe("Shared course"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never retries an account-mismatch response as an unguarded read", async () => {
    const fetchMock = vi.fn(async () => json({ detail: { code: "account_changed", message: "Sign in again" } }, 409));
    vi.stubGlobal("fetch", fetchMock);
    const hook = renderHook(() => useApiResource("/stats/day?day_date=2026-10-25"));
    await waitFor(() => expect(hook.result.current.error).toBe("Sign in again"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.sync).not.toHaveBeenCalled();
  });
});
