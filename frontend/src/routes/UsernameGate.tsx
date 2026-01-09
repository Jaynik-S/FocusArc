import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getUsername, setUsername } from "../api/apiClient";

const UsernameGate = () => {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = getUsername();
    if (existing) {
      setValue(existing);
    }
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = value.trim();
    if (!normalized) {
      setError("Enter a username to continue.");
      return;
    }
    setError("");
    setUsername(normalized);
    navigate("/timers");
  };

  return (
    <div className="card">
      <div className="card-header">
        <h1>CourseTimers</h1>
        <p>Track each course with a single, focused timer.</p>
      </div>
      <form onSubmit={onSubmit} className="card-body">
        <label className="field">
          <span>Username</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="e.g. jay"
            maxLength={32}
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <button className="primary" type="submit">
          Continue
        </button>
      </form>
    </div>
  );
};

export default UsernameGate;
