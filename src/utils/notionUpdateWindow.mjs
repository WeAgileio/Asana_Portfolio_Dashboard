const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function taipeiDateParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    fmt.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
}

/** 最近一個週六（當天是週六則用當天）的台北時間 00:00。 */
export function saturdayWindowStart(now = new Date()) {
  const parts = taipeiDateParts(now);
  const weekday = WEEKDAY_INDEX[parts.weekday];
  const daysBack = (weekday + 1) % 7;
  const midnightUtc =
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - TAIPEI_OFFSET_MS;
  return new Date(midnightUtc - daysBack * DAY_MS);
}

/** ISO 時間落在週六 00:00（含）到 now（含）才算有更新。 */
export function isEditedSinceSaturday(iso, now = new Date()) {
  if (typeof iso !== "string" || !iso.trim()) return false;
  const edited = new Date(iso);
  if (Number.isNaN(edited.getTime())) return false;
  const start = saturdayWindowStart(now).getTime();
  const at = edited.getTime();
  return at >= start && at <= now.getTime();
}

export function formatTaipeiEditedAt(iso) {
  if (typeof iso !== "string" || !iso.trim()) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = taipeiDateParts(date);
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

/** 在窗內才回傳提示文字，否則 null。 */
export function progressUpdateHintLabel(iso, now = new Date()) {
  if (!isEditedSinceSaturday(iso, now)) return null;
  const when = formatTaipeiEditedAt(iso);
  return when ? `狀態更新於 ${when} 有修改` : "狀態更新有修改";
}

export function statusUpdatedAtFromBody(body) {
  const raw = body && body.status_updated_at;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
