import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export const LockScreen = () => {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const { unlock, checking, error } = useAuth();
  const pending = loading || checking;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    await unlock(key);
    
    setLoading(false);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      padding: "2rem"
    }}>
      <div style={{
        maxWidth: "400px",
        width: "100%",
        backgroundColor: "#1e293b",
        padding: "2rem",
        borderRadius: "8px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
      }}>
        <h1 style={{ marginBottom: "0.5rem", fontSize: "1.5rem" }}>FocusArc</h1>
        <p style={{ marginBottom: "2rem", color: "#94a3b8" }}>
          Enter your access key to continue
        </p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            aria-label="Access key"
            autoComplete="current-password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Access key"
            disabled={pending}
            autoFocus
            style={{
              width: "100%",
              padding: "0.75rem",
              marginBottom: "1rem",
              backgroundColor: "#334155",
              border: "1px solid #475569",
              borderRadius: "4px",
              color: "#f8fafc",
              fontSize: "1rem"
            }}
          />
          
          {error && (
            <p role="alert" style={{
              color: "#ef4444",
              marginBottom: "1rem",
              fontSize: "0.875rem"
            }}>
              {error}
            </p>
          )}
          
          <button
            type="submit"
            disabled={!key || pending}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: key && !loading ? "#3b82f6" : "#475569",
              color: "#f8fafc",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: key && !loading ? "pointer" : "not-allowed"
            }}
          >
            {pending ? "Verifying..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
};
