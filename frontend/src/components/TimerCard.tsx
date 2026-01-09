import { Timer } from "../api/types";

type TimerCardProps = {
  timer: Timer;
  isActive: boolean;
  elapsedLabel: string;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onArchive: () => void;
  disabled?: boolean;
};

const TimerCard = ({
  timer,
  isActive,
  elapsedLabel,
  onStart,
  onStop,
  onEdit,
  onArchive,
  disabled = false,
}: TimerCardProps) => {
  return (
    <div className={`timer-card ${isActive ? "timer-card-active" : ""}`}>
      <div className="timer-meta">
        <div className="timer-icon" style={{ background: timer.color }}>
          {timer.icon}
        </div>
        <div>
          <div className="timer-title">{timer.name}</div>
          <div className="timer-status">
            {isActive ? `Running · ${elapsedLabel}` : "Not running"}
          </div>
        </div>
      </div>
      <div className="timer-actions">
        <button
          className={isActive ? "secondary" : "primary"}
          type="button"
          disabled={disabled}
          onClick={isActive ? onStop : onStart}
        >
          {isActive ? "Stop" : "Start"}
        </button>
        <button className="ghost" type="button" onClick={onEdit} disabled={disabled}>
          Edit
        </button>
        <button className="ghost" type="button" onClick={onArchive} disabled={disabled}>
          Archive
        </button>
      </div>
    </div>
  );
};

export default TimerCard;
