import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

import { apiFetch, ApiError, AUTHENTICATION_REQUIRED_EVENT } from "../api/apiClient";

export type AuthUser = { username: string };
export type AuthStatus = "checking" | "anonymous" | "authenticated";
export type LoginResult = "authenticated" | "registration_required";

interface AuthContextType {
  status: AuthStatus;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const attempt = ++generation.current;
    const controller = new AbortController();
    const checkSession = async () => {
      try {
        const current = await apiFetch<AuthUser>("/auth/session", {
          signal: controller.signal,
          suppressAuthenticationEvent: true,
        });
        if (attempt !== generation.current || controller.signal.aborted) return;
        setUser(current);
        setStatus("authenticated");
      } catch {
        if (attempt !== generation.current || controller.signal.aborted) return;
        setUser(null);
        setStatus("anonymous");
      }
    };
    const requireAuthentication = () => {
      ++generation.current;
      setUser(null);
      setStatus("anonymous");
    };

    window.addEventListener(AUTHENTICATION_REQUIRED_EVENT, requireAuthentication);
    void checkSession();
    return () => {
      controller.abort();
      ++generation.current;
      window.removeEventListener(AUTHENTICATION_REQUIRED_EVENT, requireAuthentication);
    };
  }, []);

  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      const authenticated = await apiFetch<AuthUser>("/auth/login", {
        method: "POST",
        body: { username, password },
        suppressAuthenticationEvent: true,
      });
      ++generation.current;
      setUser(authenticated);
      setStatus("authenticated");
      return "authenticated";
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "username_not_registered") {
        return "registration_required";
      }
      throw cause;
    }
  };

  const register = async (username: string, password: string) => {
    const authenticated = await apiFetch<AuthUser>("/auth/register", {
      method: "POST",
      body: { username, password, confirm: true },
      suppressAuthenticationEvent: true,
    });
    ++generation.current;
    setUser(authenticated);
    setStatus("authenticated");
  };

  const logout = async () => {
    ++generation.current;
    try {
      await apiFetch<void>("/auth/logout", {
        method: "POST",
        suppressAuthenticationEvent: true,
      });
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  };

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
