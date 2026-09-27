const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

export const AUTHENTICATION_REQUIRED_EVENT = "focusarc:authentication-required";
export const REQUEST_TIMEOUT_MS = 90_000;

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  suppressAuthenticationEvent?: boolean;
};

type ErrorPayload = {
  detail?: string | { code?: string; message?: string };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = "Authentication required", code?: string, retryAfter?: number) {
    super(message, 401, code, retryAfter);
    this.name = "AuthenticationError";
  }
}

const parseError = async (response: Response) => {
  let message = response.statusText || "The request failed";
  let code: string | undefined;
  try {
    const payload = await response.json() as ErrorPayload;
    if (typeof payload.detail === "string") {
      message = payload.detail;
    } else if (payload.detail) {
      message = payload.detail.message || message;
      code = payload.detail.code;
    }
  } catch {
    // Keep the HTTP status text for non-JSON gateway and proxy errors.
  }
  const retryAfterValue = Number(response.headers.get("Retry-After"));
  const retryAfter = Number.isFinite(retryAfterValue) && retryAfterValue > 0
    ? retryAfterValue
    : undefined;
  return { message, code, retryAfter };
};

export const apiFetch = async <T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> => {
  const { suppressAuthenticationEvent = false, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers);
  if (requestOptions.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const abort = () => controller.abort(requestOptions.signal?.reason);
  requestOptions.signal?.addEventListener("abort", abort, { once: true });
  if (requestOptions.signal?.aborted) abort();
  const timeout = window.setTimeout(
    () => controller.abort(new Error("The API took too long to respond. Try again; check the current state before repeating an action.")),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(API_BASE_URL + path, {
      ...requestOptions,
      credentials: "include",
      headers,
      signal: controller.signal,
      body: requestOptions.body !== undefined
        ? JSON.stringify(requestOptions.body)
        : undefined,
    });

    if (!response.ok) {
      const { message, code, retryAfter } = await parseError(response);
      if (response.status === 401) {
        if (!suppressAuthenticationEvent) {
          window.dispatchEvent(new Event(AUTHENTICATION_REQUIRED_EVENT));
        }
        throw new AuthenticationError(message, code, retryAfter);
      }
      throw new ApiError(message, response.status, code, retryAfter);
    }

    if (response.status === 204) return undefined as T;
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) return await response.json() as T;
    throw new Error("The API returned an unexpected response. Check the API URL and try again.");
  } finally {
    window.clearTimeout(timeout);
    requestOptions.signal?.removeEventListener("abort", abort);
  }
};
