// Shared helpers for Offering / Seeking date-time fields ("YYYY-MM-DD HH:mm" storage).

export const toDateTimeLocalValue = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  return value.trim().replace(" ", "T").substring(0, 16);
};

export const fromDateTimeLocalValue = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  return value.trim().replace("T", " ").substring(0, 16);
};

export const formatDateForDisplay = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}-${d}-${y}`;
};

export const formatTimeForDisplay = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
};

/** Display stored "YYYY-MM-DD HH:mm" as "mm-dd-yyyy hh:mm" (edit forms). */
export const formatDateTimeForDisplay = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return "";
  const { date, time } = parseDateTime(value);
  if (!date || !time) return value;
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  const h = String(time.getHours()).padStart(2, "0");
  const min = String(time.getMinutes()).padStart(2, "0");
  return `${m}-${d}-${y} ${h}:${min}`;
};

export const isStartDateValid = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getTime() >= now.getTime();
};

export const isEndDateValid = (endDateTime, startValue) => {
  if (!endDateTime || !(endDateTime instanceof Date) || isNaN(endDateTime.getTime())) return false;
  if (!startValue || typeof startValue !== "string" || startValue.trim() === "") return true;
  const { date: startDate, time: startTime } = parseDateTime(startValue);
  if (!startDate || !startTime) return true;
  const startDateTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), startTime.getHours(), startTime.getMinutes());
  return endDateTime.getTime() > startDateTime.getTime();
};

export const parseDateTime = (value) => {
  if (!value || typeof value !== "string" || value.trim() === "") return { date: null, time: null };
  const trimmed = value.trim();
  const spaceMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/);
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{1,2}):(\d{2})/);
  const match = spaceMatch || isoMatch;
  if (match) {
    const [, y, m, d, h, min] = match;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    const time = new Date(2000, 0, 1, parseInt(h, 10), parseInt(min, 10));
    return { date, time };
  }
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return { date, time: new Date(2000, 0, 1, 9, 0) };
  }
  return { date: null, time: null };
};

export const combineDateTime = (date, time) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = time && time instanceof Date && !isNaN(time.getTime()) ? String(time.getHours()).padStart(2, "0") : "00";
  const min = time && time instanceof Date && !isNaN(time.getTime()) ? String(time.getMinutes()).padStart(2, "0") : "00";
  return `${y}-${m}-${d} ${h}:${min}`;
};
