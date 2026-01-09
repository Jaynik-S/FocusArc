import { FormEvent, useEffect, useState } from "react";

import { TimerFormValues } from "../hooks/useTimers";

const DEFAULT_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#e11d48",
  "#1d4ed8",
];

type TimerFormModalProps = {
  title: string;
  confirmLabel: string;
  isOpen: boolean;
  initialValues?: TimerFormValues;
  onSubmit: (values: TimerFormValues) => Promise<void> | void;
  onClose: () => void;
};

const getDefaults = (): TimerFormValues => ({
  name: "",
  color: DEFAULT_COLORS[0],
  icon: "book",
});

const TimerFormModal = ({
  title,
  confirmLabel,
  isOpen,
  initialValues,
  onSubmit,
  onClose,
}: TimerFormModalProps) => {
  const [values, setValues] = useState<TimerFormValues>(
    initialValues ?? getDefaults()
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? getDefaults());
      setError("");
    }
  }, [isOpen, initialValues]);

  if (!isOpen) {
    return null;
  }

  const updateValue = (key: keyof TimerFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = values.name.trim();
    if (!normalized) {
      setError("Name is required.");
      return;
    }
    setError("");
    await onSubmit({ ...values, name: normalized });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              value={values.name}
              onChange={(event) => updateValue("name", event.target.value)}
              placeholder="BIO130"
              maxLength={32}
            />
          </label>
          <label className="field">
            <span>Icon</span>
            <input
              value={values.icon}
              onChange={(event) => updateValue("icon", event.target.value)}
              placeholder="book"
              maxLength={32}
            />
          </label>
          <label className="field">
            <span>Color</span>
            <input
              type="color"
              value={values.color}
              onChange={(event) => updateValue("color", event.target.value)}
            />
          </label>
          <div className="color-row">
            {DEFAULT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="color-swatch"
                style={{ background: color }}
                onClick={() => updateValue("color", color)}
                aria-label={`Use color ${color}`}
              />
            ))}
          </div>
          {error ? <div className="error">{error}</div> : null}
          <div className="modal-actions">
            <button className="secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" type="submit">
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimerFormModal;
