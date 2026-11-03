import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";
import { publicRecord } from "./apiHelpers.mjs";

/**
 * Get public session records scheduled during the next seven days.
 *
 * @returns {Promise<object[]>} Upcoming sessions ordered by date and time.
 */
export async function upcomingSessions() {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 7);
  const startDate = DatabaseModel.toMySqlDate(today);
  const endDate = DatabaseModel.toMySqlDate(end);
  return (await SessionsModel.getAll())
    .map(publicRecord)
    .filter((session) => session.date >= startDate && session.date < endDate)
    .sort(
      (a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) ||
        Number(a.id) - Number(b.id),
    );
}

/**
 * Get public session records whose start date and time has already passed.
 *
 * @returns {Promise<object[]>} Past sessions ordered by date and time.
 */
export async function pastSessions() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const nowValue = `${DatabaseModel.toMySqlDate(now)} ${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return (await SessionsModel.getAll())
    .map(publicRecord)
    .filter(
      (session) =>
        `${String(session.date).slice(0, 10)} ${String(
          session.time ?? "00:00:00",
        ).slice(0, 8)}` < nowValue,
    )
    .sort(
      (a, b) =>
        `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) ||
        Number(a.id) - Number(b.id),
    );
}

/**
 * Load lookup records required to add related details to XML exports.
 *
 * @returns {Promise<{activities: object[], locations: object[], users: object[]}>}
 */
export async function xmlLookups() {
  const [activities, locations, users] = await Promise.all([
    ActivitiesModel.getAll(),
    LocationModel.getAll(),
    UsersModel.getAll(),
  ]);
  return { activities, locations, users };
}
