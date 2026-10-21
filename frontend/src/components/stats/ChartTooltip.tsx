import { ReactNode } from "react";

export default function ChartTooltip({ id, children }: { id: string; children: ReactNode }) {
  return <div className="analytics-tooltip" role="tooltip" id={id}>{children}</div>;
}
