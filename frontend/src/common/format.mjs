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
