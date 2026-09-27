export const ACCOUNT_STORAGE_SUFFIXES = [
  "timers",
  "timerElapsed",
  "timerOffsets",
  "sessionAdjustments",
  "activeSession",
  "lastActiveAt",
  "selectedTimerId",
  "theme",
] as const;

export type AccountStorageSuffix = typeof ACCOUNT_STORAGE_SUFFIXES[number];

const legacyKey = (suffix: AccountStorageSuffix) => `coursetimers.${suffix}`;

export const accountStorageKey = (
  username: string,
  suffix: AccountStorageSuffix
) => `coursetimers.accounts.${username}.${suffix}`;

export const storageForAccount = (username: string) => ({
  getItem: (suffix: AccountStorageSuffix) =>
    localStorage.getItem(accountStorageKey(username, suffix)),
  setItem: (suffix: AccountStorageSuffix, value: string) =>
    localStorage.setItem(accountStorageKey(username, suffix), value),
  removeItem: (suffix: AccountStorageSuffix) =>
    localStorage.removeItem(accountStorageKey(username, suffix)),
});

export const migrateLegacyAccountStorage = (username: string) => {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem("coursetimers.username") !== username) return;
    const account = storageForAccount(username);
    for (const suffix of ACCOUNT_STORAGE_SUFFIXES) {
      const sourceKey = legacyKey(suffix);
      const source = localStorage.getItem(sourceKey);
      if (source !== null && account.getItem(suffix) === null) {
        account.setItem(suffix, source);
      }
      if (source !== null) localStorage.removeItem(sourceKey);
    }
    localStorage.removeItem("coursetimers.username");
  } catch {
    // Storage is optional; server data remains authoritative.
  }
};
