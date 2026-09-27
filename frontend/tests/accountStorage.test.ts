import { beforeEach, describe, expect, it } from "vitest";

import {
  accountStorageKey,
  migrateLegacyAccountStorage,
  storageForAccount,
} from "../src/storage/accountStorage";

beforeEach(() => localStorage.clear());

describe("account-scoped browser storage", () => {
  it("uses disjoint keys for different accounts", () => {
    const jayy = storageForAccount("jayy");
    const other = storageForAccount("other");

    jayy.setItem("timerElapsed", '{"timer":42}');
    other.setItem("timerElapsed", '{"timer":7}');

    expect(jayy.getItem("timerElapsed")).toBe('{"timer":42}');
    expect(other.getItem("timerElapsed")).toBe('{"timer":7}');
    expect(accountStorageKey("jayy", "timerElapsed")).toBe(
      "coursetimers.accounts.jayy.timerElapsed"
    );
  });

  it("migrates legacy values only to their recorded owner and only when the destination is empty", () => {
    localStorage.setItem("coursetimers.username", "jayy");
    localStorage.setItem("coursetimers.timerElapsed", '{"legacy":42}');
    localStorage.setItem("coursetimers.theme", "dark");
    localStorage.setItem(accountStorageKey("jayy", "theme"), "light");

    migrateLegacyAccountStorage("other");
    expect(localStorage.getItem("coursetimers.timerElapsed")).toBe('{"legacy":42}');

    migrateLegacyAccountStorage("jayy");
    expect(storageForAccount("jayy").getItem("timerElapsed")).toBe('{"legacy":42}');
    expect(storageForAccount("jayy").getItem("theme")).toBe("light");
    expect(localStorage.getItem("coursetimers.timerElapsed")).toBeNull();
    expect(localStorage.getItem("coursetimers.theme")).toBeNull();
    expect(localStorage.getItem("coursetimers.username")).toBeNull();
  });
});
