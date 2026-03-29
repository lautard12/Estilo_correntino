/** Returns local timezone offset string like "-03:00" or "+05:30" */
function getTzOffset(): string {
  const offset = new Date().getTimezoneOffset(); // minutes, positive = behind UTC
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}

/** Start of day in local timezone, e.g. "2026-03-01T00:00:00-03:00" */
export function dayStart(dateStr: string): string {
  return `${dateStr}T00:00:00${getTzOffset()}`;
}

/** End of day in local timezone, e.g. "2026-03-01T23:59:59-03:00" */
export function dayEnd(dateStr: string): string {
  return `${dateStr}T23:59:59${getTzOffset()}`;
}
