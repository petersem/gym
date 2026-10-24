import { readFileSync } from "node:fs";
import { expect, test } from "@jest/globals";

const seed = readFileSync(
  new URL("../../database/seed.sql", import.meta.url),
  "utf8",
);

test("sample sessions cover the previous four days through the next six days when seeded", () => {
  const sessions = seed.match(/INSERT INTO `sessions` VALUES\s+([\s\S]*?);/);

  expect(sessions).not.toBeNull();
  const rows = sessions[1].trim().split(/\r?\n/);
  expect(rows).toHaveLength(21);

  const offsets = rows.map((row) => {
    const date = row.match(
      /^\(\d+,'[^']*',\d+,\d+,\d+,DATE_(ADD|SUB)\(CURRENT_DATE\(\), INTERVAL ([0-6]) DAY\),'[0-9:]{8}'\),?$/,
    );
    expect(date).not.toBeNull();
    return Number(date[2]) * (date[1] === "SUB" ? -1 : 1);
  });

  const past = offsets.filter((offset) => offset < 0);
  const upcoming = offsets.filter((offset) => offset >= 0);
  expect(past).toHaveLength(6);
  expect([...new Set(past)].sort((a, b) => a - b)).toEqual([-4, -3, -2, -1]);
  expect(upcoming).toHaveLength(15);
  expect([...new Set(upcoming)].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  const ids = rows.map((row) => row.match(/^\((\d+),/)[1]);
  expect(new Set(ids).size).toBe(21);
});

test("sample bookings use members and meet per-user session coverage limits", () => {
  const users = seed.match(/INSERT INTO `users` VALUES\s+([\s\S]*?);/)[1];
  const members = new Set(
    [...users.matchAll(/\((\d+),'[^']*','[^']*','member',/g)].map((match) =>
      Number(match[1]),
    ),
  );
  const sessions = seed.match(/INSERT INTO `sessions` VALUES\s+([\s\S]*?);/)[1];
  const sessionIds = new Set(
    [...sessions.matchAll(/^\((\d+),/gm)].map((match) => Number(match[1])),
  );
  const bookings = seed.match(
    /INSERT INTO `bookings` \(session_id, user_id, created\) VALUES\s+([\s\S]*?);/,
  );
  expect(bookings).not.toBeNull();
  const rows = bookings[1].trim().split(/,\s*(?=\()/);
  const bookedByUser = new Map();

  for (const row of rows) {
    const booking = row.match(/^\((\d+),(\d+),@seed_booking_created\)$/);
    expect(booking).not.toBeNull();
    const sessionId = Number(booking[1]);
    const userId = Number(booking[2]);
    expect(sessionIds.has(sessionId)).toBe(true);
    expect(members.has(userId)).toBe(true);
    bookedByUser.set(userId, (bookedByUser.get(userId) || 0) + 1);
  }

  expect(bookedByUser.size).toBe(11);
  expect(bookedByUser.get(10036)).toBeGreaterThanOrEqual(
    Math.ceil(sessionIds.size * 0.85),
  );
  expect(bookedByUser.get(8)).toBeGreaterThanOrEqual(
    Math.ceil(sessionIds.size * 0.75),
  );
  for (const userId of bookedByUser.keys()) {
    if (userId === 10036 || userId === 8) continue;
    expect(bookedByUser.get(userId)).toBeGreaterThanOrEqual(1);
    expect(bookedByUser.get(userId)).toBeLessThanOrEqual(
      Math.floor(sessionIds.size * 0.8),
    );
  }
  expect(seed).toContain(
    "SET @seed_booking_created = DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY);",
  );
});
