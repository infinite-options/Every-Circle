/**
 * Transaction timestamps from the API are stored in UTC/GMT.
 * Parse as UTC and format in the device local timezone.
 */

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function parseUtcDateTime(dateString) {
  if (!dateString) return null;

  const text = String(dateString).trim();
  if (!text) return null;

  if (text.includes("Z") || /[+-]\d{2}:\d{2}$/.test(text)) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const normalized = text.replace(" ", "T");
  const parsed = new Date(`${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseTransactionDateTime(transaction) {
  if (!transaction) return null;
  return (
    parseUtcDateTime(transaction.transaction_datetime_local) ||
    parseUtcDateTime(transaction.transaction_datetime_utc) ||
    parseUtcDateTime(transaction.transaction_datetime)
  );
}

export function localDateKey(date) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatLocalMonthDay(dateString) {
  const date = parseUtcDateTime(dateString);
  if (!date) return "N/A";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

export function formatTransactionDate(transactionOrDateString) {
  if (transactionOrDateString && typeof transactionOrDateString === "object") {
    const date = parseTransactionDateTime(transactionOrDateString);
    if (!date) return "N/A";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  }
  return formatLocalMonthDay(transactionOrDateString);
}

export function formatLocalMonthDayFromKey(dateKey) {
  if (!dateKey) return "N/A";
  const [, month, day] = String(dateKey).split("-");
  if (!month || !day) return "N/A";
  return `${month}/${day}`;
}

export function lastNDaysKeys(days, endDate = new Date()) {
  const keys = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(endDate);
    date.setHours(12, 0, 0, 0);
    date.setDate(endDate.getDate() - offset);
    keys.push(localDateKey(date));
  }
  return keys;
}

export function withTimeZoneQuery(url) {
  const separator = url.includes("?") ? "&" : "?";
  const timezone = encodeURIComponent(getDeviceTimeZone());
  return `${url}${separator}timezone=${timezone}`;
}

export function transactionDateMs(transactionOrDateString) {
  const date =
    transactionOrDateString && typeof transactionOrDateString === "object"
      ? parseTransactionDateTime(transactionOrDateString)
      : parseUtcDateTime(transactionOrDateString);
  return date ? date.getTime() : NaN;
}
