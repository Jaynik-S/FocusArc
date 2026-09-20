const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

export const PERSONAL_MODE = import.meta.env.VITE_AUTH_MODE === "personal";
export const LOCK_EVENT = "focusarc:locked";
export const REQUEST_TIMEOUT_MS = 90_000;

const USERNAME_KEY = "coursetimers.username";
const ACCESS_KEY = "focusarc.access_key";

export const getUsername = () => {
  return localStorage.getItem(USERNAME_KEY) ?? "";
};

export const setUsername = (username: string) => {
  localStorage.setItem(USERNAME_KEY, username);
};

export const getAccessKey = () => {
  return sessionStorage.getItem(ACCESS_KEY) ?? "";
};

export const setAccessKey = (key: string) => {
  sessionStorage.setItem(ACCESS_KEY, key);
};

export const clearAccessKey = () => {
  sessionStorage.removeItem(ACCESS_KEY);
  window.dispatchEvent(new Event(LOCK_EVENT));
};

export const isLocked = () => {
  return PERSONAL_MODE && !getAccessKey();
};

type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export const apiFetch = async <T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> => {
  const headers = new Headers(options.headers);
  
  const accessKey = getAccessKey();
  if (PERSONAL_MODE && accessKey) {
    headers.set("Authorization", "Bearer " + accessKey);
  } else if (!PERSONAL_MODE) {
    const username = getUsername();
    if (username) {
      headers.set("X-Username", username);
    }
  }
  
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeout = window.setTimeout(() => controller.abort(new Error("The API took too long to respond. Try again; check the current state before repeating an action.")), REQUEST_TIMEOUT_MS);
  try {
  const response = await fetch(API_BASE_URL + path, {
    ...options,
    headers,
    signal: controller.signal,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    if (PERSONAL_MODE && accessKey === getAccessKey()) clearAccessKey();
    throw new AuthenticationError("Authentication required");
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return await response.json() as T;
  }

  throw new Error("The API returned an unexpected response. Check the API URL and try again.");
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
};
