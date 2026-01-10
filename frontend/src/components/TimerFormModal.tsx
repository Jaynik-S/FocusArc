import { FormEvent, useEffect, useState } from "react";

import { TimerFormValues } from "../hooks/useTimers";
import { isValidHexColor } from "../utils/color";

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
  color: "#111827",
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
    if (!isValidHexColor(values.color)) {
      setError("Color must be a valid hex code (e.g. #1A2B3C).");
      return;
    }
    setError("");
    await onSubmit({ ...values, name: normalized, color: values.color.trim() });
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
            <span>Color</span>
            <input
              value={values.color}
              onChange={(event) => updateValue("color", event.target.value)}
              placeholder="#1A2B3C"
              maxLength={7}
            />
          </label>
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
