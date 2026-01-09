import type { CSSProperties } from "react";

import { Session } from "../api/types";

type SessionBlockProps = {
  session: Session;
  color: string;
  label: string;
  timeRange: string;
  style: CSSProperties;
};

const SessionBlock = ({
  session,
  color,
  label,
  timeRange,
  style,
}: SessionBlockProps) => {
  return (
    <div
      className="session-block"
      style={{ ...style, borderColor: color }}
      data-session={session.id}
    >
      <div className="session-block-title">{label}</div>
      <div className="session-block-meta">{timeRange}</div>
    </div>
  );
};

export default SessionBlock;
