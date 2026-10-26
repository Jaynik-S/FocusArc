type Props = { onAdjust: (seconds: number) => void; busy: boolean };

export default function SessionAdjustmentControls({ onAdjust, busy }: Props) {
  return <div className="session-adjustments" aria-label="Adjust session duration">
    <button className="ghost" type="button" disabled={busy} onClick={() => onAdjust(-300)} aria-label="Subtract 5 minutes from session">−5 min</button>
    <button className="ghost" type="button" disabled={busy} onClick={() => onAdjust(600)} aria-label="Add 10 minutes to session">+10 min</button>
  </div>;
}
