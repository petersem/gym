import { expect, test } from "@jest/globals";
import {
  filterUpcomingSessionRows,
  searchAndSortBookingRows,
} from "./bookingRows.mjs";

const sessionById = new Map([
  [1, { title: "Yoga", date: "2026-10-23", time: "10:00:00", trainer_id: 5 }],
  [2, { title: "Boxing", date: "2026-10-22", time: "15:00:00", trainer_id: 2 }],
  [3, { title: "Stretch", date: "2026-10-22", time: "09:00:00", trainer_id: 5 }],
]);
const trainerById = new Map([
  [2, { first_name: "Zara", last_name: "Trainer" }],
  [5, { first_name: "Alice", last_name: "Coach" }],
]);
const options = {
  sessionById,
  trainerById,
  searchTerm: "",
  sortBy: "session_date",
  sortDir: "asc",
};
const bookings = [
  { id: 1, session_id: 1, created: "2026-10-20T10:00:00Z" },
  { id: 2, session_id: 2, created: "2026-10-19T10:00:00Z" },
  { id: 3, session_id: 3, created: "2026-10-21T10:00:00Z" },
];
const ids = (rows, overrides = {}) =>
  searchAndSortBookingRows(rows, { ...options, ...overrides }).map(
    (row) => row.id,
  );

test("booking rows exclude sessions that have started", () => {
  const now = new Date(2026, 9, 22, 15, 0);
  const rows = [
    { id: 1, session_id: 1 },
    { id: 2, session_id: 2 },
    { id: 3, session_id: 3 },
    { id: 4, session_id: 4 },
  ];

  expect(
    filterUpcomingSessionRows(rows, sessionById, now).map((row) => row.id),
  ).toEqual([1]);
});

test("member bookings search titles and sort every displayed field in both directions", () => {
  expect(ids(bookings, { searchTerm: "  yOgA " })).toEqual([1]);
  expect(ids(bookings, { searchTerm: "missing" })).toEqual([]);
  for (const [sortBy, expected] of [
    ["session_date", [3, 2, 1]],
    ["session", [2, 3, 1]],
    ["trainer", [1, 3, 2]],
    ["created", [2, 1, 3]],
  ]) {
    expect(ids(bookings, { sortBy })).toEqual(expected);
    expect(ids(bookings, { sortBy, sortDir: "desc" })).toEqual(
      [...expected].reverse(),
    );
  }
  expect(bookings.map((row) => row.id)).toEqual([1, 2, 3]);
});

test("trainer session rows search and sort without changing counts or dropping empty sessions", () => {
  const rows = [
    { id: 1, session_id: 1, count: 4 },
    { id: 3, session_id: 3, count: 0 },
  ];
  expect(ids(rows)).toEqual([3, 1]);
  expect(ids(rows, { sortDir: "desc" })).toEqual([1, 3]);
  expect(ids(rows, { sortBy: "session" })).toEqual([3, 1]);
  expect(ids(rows, { sortBy: "session", sortDir: "desc" })).toEqual([1, 3]);
  expect(
    searchAndSortBookingRows(rows, { ...options, searchTerm: "yoga" }),
  ).toEqual([{ id: 1, session_id: 1, count: 4 }]);
  expect(ids(rows, { searchTerm: "stretch" })).toEqual([3]);
  expect(ids(rows, { searchTerm: "" })).toEqual([3, 1]);
  expect(rows.map((row) => row.count)).toEqual([4, 0]);
});
