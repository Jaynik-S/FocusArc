import type { StudySnapshot } from "./types";

let owner: { username: string; refresh: () => Promise<void>; snapshot: StudySnapshot | null } | null = null;

export const getStudyAccount = () => owner?.username ?? null;
export const getStudySnapshot = (username?: string) =>
  username === undefined || owner?.username === username ? owner?.snapshot ?? null : null;
export const getStudyRevision = (username?: string) => getStudySnapshot(username)?.revision ?? null;
export const isStudySyncRegistered = (username?: string) => Boolean(owner && (username === undefined || owner.username === username));
export const requestStudySync = async () => { await owner?.refresh(); };

/** Register only the current account coordinator; old requests cannot update a new account. */
export const registerStudySync = (username: string, refresh: () => Promise<void>) => {
  const registration = { username, refresh, snapshot: null as StudySnapshot | null };
  owner = registration;
  return {
    apply(snapshot: StudySnapshot) { if (owner === registration) owner.snapshot = snapshot; },
    clear() { if (owner === registration) owner = null; },
  };
};
