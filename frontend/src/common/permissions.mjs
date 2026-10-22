/**
 * Client-side Role access
 * The API remains the source of truth; this only decides what the UI offers.
 * Admins are rejected by POST /authenticate, so they never hold a session here.
 */
const ALL = ["guest", "member", "trainer"];
const AUTHENTICATED = ["member", "trainer"];

export const PERMISSIONS = {
  readLocations: AUTHENTICATED,
  listTrainers: AUTHENTICATED,
  readBlogs: ALL,
  viewTimetable: AUTHENTICATED,
  createBlog: AUTHENTICATED,
  readProfile: AUTHENTICATED,
  updateProfile: AUTHENTICATED,
  readBookings: AUTHENTICATED, // members: own; trainers: grouped bookings on their sessions
  makeBooking: ["member"],
  cancelBooking: ["member"],
  exportBookings: ["member"],
  deleteSession: ["trainer"], // own sessions only
  exportSessions: ["trainer"],
};

export const roleOf = (user) => user?.role ?? "guest";

export function can(user, permission) {
  return PERMISSIONS[permission]?.includes(roleOf(user)) ?? false;
}

export const ROLE_BADGE = {
  guest: "badge-info",
  member: "badge-success",
  trainer: "badge-warning",
};
