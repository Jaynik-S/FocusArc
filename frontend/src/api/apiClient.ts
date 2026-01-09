const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

const USERNAME_KEY = "coursetimers.username";

export const getUsername = () => {
  return localStorage.getItem(USERNAME_KEY) ?? "";
};

export const setUsername = (username: string) => {
  localStorage.setItem(USERNAME_KEY, username);
};

export const apiFetch = async <T>(
  path: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<T> => {
  const headers = new Headers(options.headers);
  const username = getUsername();
  if (username) {
    headers.set("X-Username", username);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
};
