import { afterEach, describe, expect, it, vi } from "vitest";

const broadcast = vi.hoisted(() => {
  const instances: Array<{ onmessage: (() => void) | null; postMessage: () => void }> = [];
  class FakeBroadcastChannel {
    onmessage: (() => void) | null = null;
    postMessage = vi.fn();
    constructor() { instances.push(this); }
  }
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
  return { instances };
});

import { STUDY_DATA_CHANGED_EVENT, notifyStudyMutationCommitted } from "../src/api/dataEvents";

afterEach(() => { vi.clearAllMocks(); });

describe("study data notifications", () => {
  it("labels a local mutation for readers and broadcasts it to other tabs", () => {
    const localRefresh = vi.fn();
    window.addEventListener(STUDY_DATA_CHANGED_EVENT, localRefresh);
    try {
      notifyStudyMutationCommitted();
      expect(localRefresh).toHaveBeenCalledOnce();
      expect((localRefresh.mock.calls[0][0] as CustomEvent).detail).toEqual({ source: "mutation" });
      expect(broadcast.instances[0].postMessage).toHaveBeenCalledOnce();

      broadcast.instances[0].onmessage?.();
      expect(localRefresh).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener(STUDY_DATA_CHANGED_EVENT, localRefresh);
    }
  });
});
