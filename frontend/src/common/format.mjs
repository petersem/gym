const toLocalDate = (value) => {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
};

export function sessionStart(session) {
  const start = toLocalDate(session.date);
  const [hours = 0, minutes = 0] = String(session.time ?? "")
    .split(":")
    .map(Number);
  start.setHours(hours, minutes, 0, 0);
  return start;
}

export const hasStarted = (session) => sessionStart(session) <= new Date();

export function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function formatDate(value) {
  if (!value) {
    return "";
  }
  return toLocalDate(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatRelativeDate(value, now = new Date()) {
  if (!value) {
    return "";
  }
  const date = toLocalDate(value);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.getTime() === today.getTime()) {
    return "Today";
  }
  if (date.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }
  return formatDate(value);
}

export const formatWeekday = (value) =>
  value
    ? toLocalDate(value).toLocaleDateString(undefined, { weekday: "short" })
    : "";

export const formatDayOfMonth = (value) =>
  value ? toLocalDate(value).getDate() : "";

export function formatTime(value) {
  if (!value) {
    return "";
  }
  const [hours, minutes] = String(value).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";
}

export const fullName = (person) =>
  person ? `${person.first_name} ${person.last_name}` : "";

export const initials = (person) =>
  person ? `${person.first_name[0] ?? ""}${person.last_name?.[0] ?? ""}` : "?";
