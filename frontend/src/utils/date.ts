export const getClientTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const getLocalDateParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 1);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 1);
  return { year, month, day };
};

const formatDateParts = (year: number, month: number, day: number) => {
  const safeMonth = String(month).padStart(2, "0");
  const safeDay = String(day).padStart(2, "0");
  return `${year}-${safeMonth}-${safeDay}`;
};

export const getLocalDateString = (date: Date, timeZone?: string) => {
  const zone = timeZone ?? getClientTimezone();
  const { year, month, day } = getLocalDateParts(date, zone);
  return formatDateParts(year, month, day);
};

export const getWeekStartDateString = (date: Date, timeZone?: string) => {
  const zone = timeZone ?? getClientTimezone();
  const { year, month, day } = getLocalDateParts(date, zone);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - weekday);
  return formatDateParts(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth() + 1,
    utcDate.getUTCDate()
  );
};

export const getMinutesSinceMidnight = (date: Date, timeZone?: string) => {
  const zone = timeZone ?? getClientTimezone();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0
  );
  return hour * 60 + minute;
};

export const formatTime = (date: Date, timeZone?: string) => {
  const zone = timeZone ?? getClientTimezone();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

export const formatWeekday = (date: Date, timeZone?: string) => {
  const zone = timeZone ?? getClientTimezone();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
  }).format(date);
};

export const formatDateShort = (date: Date, timeZone?: string) => {
  const zone = timeZone ?? getClientTimezone();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    month: "short",
    day: "numeric",
  }).format(date);
};
