import { shiftCivilDate } from "./date";

/** Find actual UTC midnights, allowing 23- and 25-hour days in the display zone. */
export const dayBounds = (day: string, zone: string) => {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const midnight = (date: string) => {
    const anchor = Date.parse(`${date}T00:00:00Z`);
    let left = anchor - 36 * 3600000;
    let right = anchor + 36 * 3600000;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      if (formatter.format(new Date(middle)) < date) left = middle + 1;
      else right = middle;
    }
    return left;
  };
  return { start: midnight(day), end: midnight(shiftCivilDate(day, 1)) };
};
