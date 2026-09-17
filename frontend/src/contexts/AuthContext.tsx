import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  getAccessKey,
  setAccessKey,
  clearAccessKey,
  isLocked,
} from "../api/apiClient";

interface AuthContextType {
  locked: boolean;
  unlock: (key: string) => Promise<boolean>;
  lock: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [locked, setLocked] = useState(isLocked());

  useEffect(() => {
    setLocked(isLocked());
  }, []);

  const unlock = async (key: string): Promise<boolean> => {
    try {
      setAccessKey(key);
      
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
      const response = await fetch(apiBase + "/me", {
        headers: {
          Authorization: "Bearer " + key,
        },
      });
      
      if (response.ok) {
        setLocked(false);
        return true;
      } else {
        clearAccessKey();
        return false;
      }
    } catch (error) {
      clearAccessKey();
      return false;
    }
  };

  const lock = () => {
    clearAccessKey();
    setLocked(true);
  };

  return (
    <AuthContext.Provider value={{ locked, unlock, lock }}>
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
