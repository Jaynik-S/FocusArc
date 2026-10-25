import type { CSSProperties } from "react";

import { Session } from "../api/types";

type SessionBlockProps = {
  session: Session;
  color: string;
  label: string;
  timeRange: string;
  style: CSSProperties;
  onSelect: () => void;
  selected: boolean;
};

const SessionBlock = ({
  session,
  color,
  label,
  timeRange,
  style,
  onSelect,
  selected,
}: SessionBlockProps) => {
  return (
    <button
      type="button"
      className="session-block"
      onClick={onSelect}
      aria-label={`${label}, ${timeRange}`}
      aria-pressed={selected}
      title={`${label}: ${timeRange}`}
      style={{ ...style, borderColor: color }}
      data-session={session.id}
    >
      <div className="session-block-title">{label}</div>
      <div className="session-block-meta">{timeRange}</div>
    </button>
  );
};

export default SessionBlock;
