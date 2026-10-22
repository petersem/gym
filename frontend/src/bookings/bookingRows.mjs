import { fullName, sessionStart } from "../common/format.mjs";

export function filterUpcomingSessionRows(rows, sessionById, now) {
  return rows.filter((row) => {
    const session = sessionById.get(row.session_id);
    return session && sessionStart(session) > now;
  });
}

export function searchAndSortBookingRows(
  rows,
  { sessionById, trainerById, searchTerm, sortBy, sortDir },
) {
  const term = searchTerm.trim().toLowerCase();
  const direction = sortDir === "desc" ? -1 : 1;
  const value = (row) => {
    const session = sessionById.get(row.session_id);
    switch (sortBy) {
      case "session":
        return session.title;
      case "trainer":
        return fullName(trainerById.get(session.trainer_id));
      case "created":
        return new Date(row.created).getTime();
      default:
        return sessionStart(session).getTime();
    }
  };

  return rows
    .filter((row) =>
      sessionById.get(row.session_id).title.toLowerCase().includes(term),
    )
    .sort((left, right) => {
      const a = value(left);
      const b = value(right);
      const comparison =
        typeof a === "number"
          ? a - b
          : a.localeCompare(b, undefined, { sensitivity: "base" });
      return (comparison || Number(left.id) - Number(right.id)) * direction;
    });
}
