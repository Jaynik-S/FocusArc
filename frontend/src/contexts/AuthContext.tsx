import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import {
  getAccessKey,
  setAccessKey,
  clearAccessKey,
  apiFetch, AuthenticationError, getUsername, setUsername, PERSONAL_MODE, LOCK_EVENT,
} from "../api/apiClient";

interface AuthContextType {
  locked: boolean;
  checking: boolean;
  error: string;
  unlock: (key: string) => Promise<boolean>;
  lock: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [locked, setLocked] = useState(PERSONAL_MODE);
  const [checking, setChecking] = useState(PERSONAL_MODE && Boolean(getAccessKey()));
  const [error, setError] = useState("");
  const generation = useRef(0);

  const unlock = async (key: string, signal?: AbortSignal): Promise<boolean> => {
    const attempt = ++generation.current;
    setChecking(true);
    setError("");
    setAccessKey(key);
    try {
      const owner = await apiFetch<{ username: string }>("/me", { signal });
      if (attempt !== generation.current || signal?.aborted || getAccessKey() !== key) return false;
      if (typeof owner.username !== "string" || !owner.username) throw new Error("The API returned an invalid owner identity.");
      const previous = getUsername();
      const hasCounters = ["timerElapsed", "timerOffsets", "sessionAdjustments", "activeSession", "timers"]
        .some((suffix) => localStorage.getItem(`coursetimers.${suffix}`) !== null);
      if ((previous && previous !== owner.username) || (!previous && hasCounters)) {
        throw new Error("This browser has timer data for a different or unknown owner. Export the coursetimers.* entries from browser local storage, then use a separate browser profile or deliberately clear those entries before unlocking. No counters were changed.");
      }
      setUsername(owner.username);
      setLocked(false);
      return true;
    } catch (cause) {
      if (signal?.aborted || attempt !== generation.current) return false;
      setError(cause instanceof AuthenticationError ? "Invalid access key. Enter your current key." : cause instanceof Error ? cause.message : "Cannot reach the API. Your saved key and timer counters have been retained; try again.");
      return false;
    } finally {
      if (attempt === generation.current) setChecking(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const onLock = () => {
      ++generation.current;
      setLocked(true);
      setChecking(false);
      setError("Authentication required. Enter your current access key.");
    };
    window.addEventListener(LOCK_EVENT, onLock);
    const saved = getAccessKey();
    if (PERSONAL_MODE && saved) void unlock(saved, controller.signal);
    return () => {
      controller.abort();
      ++generation.current;
      window.removeEventListener(LOCK_EVENT, onLock);
    };
  }, []);

  const lock = () => {
    ++generation.current;
    clearAccessKey();
    setLocked(true);
    setChecking(false);
    setError("");
  };

  return (
    <AuthContext.Provider value={{ locked, checking, error, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
