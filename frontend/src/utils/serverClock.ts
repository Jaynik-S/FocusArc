/** Server time advances on the monotonic clock; device wall time never measures study. */
export const createServerClock = (monotonic = () => performance.now()) => {
  let anchor: { server: number; monotonic: number } | null = null;
  let bestRtt = Infinity;
  let sampledAt = -Infinity;
  let needsCalibration = true;
  return {
    sample(serverNow: string, sentAt: number, receivedAt = monotonic()) {
      const server = Date.parse(serverNow);
      const rtt = Math.max(0, receivedAt - sentAt);
      if (!Number.isFinite(server) || rtt > 2_000) return false;
      if (receivedAt - sampledAt > 60_000) bestRtt = Infinity;
      if (rtt <= bestRtt) {
        anchor = { server: server + rtt / 2, monotonic: receivedAt };
        bestRtt = rtt;
        sampledAt = receivedAt;
        needsCalibration = false;
        return true;
      }
      return false;
    },
    now: () => anchor ? anchor.server + monotonic() - anchor.monotonic : 0,
    // Resume must accept a fresh sample even when the old one had a lower latency.
    isCalibrated: () => Boolean(anchor) && !needsCalibration && monotonic() - sampledAt < 90_000,
    recalibrate() { bestRtt = Infinity; needsCalibration = true; },
  };
};
