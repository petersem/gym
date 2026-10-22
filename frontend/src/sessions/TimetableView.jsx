import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  FaClock,
  FaChevronDown,
  FaMapMarkerAlt,
  FaUser,
  FaUsers,
} from "react-icons/fa";
import { queryString } from "../api.mjs";
import { useAuthenticate } from "../authentication/useAuthenticate.jsx";
import SearchSortBar from "../common/SearchSortBar.jsx";
import StatusAlert from "../common/StatusAlert.jsx";
import {
  formatDayOfMonth,
  formatRelativeDate,
  formatTime,
  formatWeekday,
  fullName,
  hasStarted,
} from "../common/format.mjs";
import { can, PERMISSIONS } from "../common/permissions.mjs";
import { useLookups } from "../common/useLookups.jsx";

const SORTS = [
  { value: "date", label: "date" },
  { value: "title", label: "title" },
  { value: "trainer", label: "trainer" },
  { value: "location", label: "location" },
];

function TimetableView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, authFetch } = useAuthenticate(PERMISSIONS.viewTimetable);
  const {
    trainers,
    locations,
    trainerById,
    locationById,
    error: lookupError,
  } = useLookups();

  const [sessions, setSessions] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [openDays, setOpenDays] = useState(null);

  const locationId = searchParams.get("location_id") ?? "";
  const trainerId = searchParams.get("trainer_id") ?? "";
  const canViewTimetable = can(user, "viewTimetable");
  const canBook = can(user, "makeBooking");
  const isTrainer = user?.role === "trainer";
  const dayViewKey = [searchTerm, sortBy, sortDir, locationId, trainerId].join(
    "\0",
  );
  const sessionGroups = useMemo(() => {
    if (sortBy !== "date") {
      return [{ date: null, sessions: sessions ?? [] }];
    }
    const groups = new Map();
    for (const session of sessions ?? []) {
      const date = session.date.slice(0, 10);
      if (!groups.has(date)) {
        groups.set(date, { date, sessions: [] });
      }
      groups.get(date).sessions.push(session);
    }
    return [...groups.values()];
  }, [sessions, sortBy]);
  const expandedDays =
    openDays?.viewKey === dayViewKey &&
    (openDays.dates.length === 0 ||
      sessionGroups.some((group) => openDays.dates.includes(group.date)))
      ? openDays.dates
      : [sessionGroups[0]?.date];

  const setFilter = (name, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(name, value);
    } else {
      next.delete(name);
    }
    setSearchParams(next);
  };

  const getSessions = useCallback(() => {
    if (!canViewTimetable) {
      return;
    }
    authFetch(
      "GET",
      "/timetable" +
        queryString({
          search_term: searchTerm,
          sort_by: sortBy,
          sort_dir: sortDir,
          location_id: locationId,
          trainer_id: trainerId,
        }),
    )
      .then((response) => {
        if (response.status === 200) {
          setSessions(response.body.filter((session) => !hasStarted(session)));
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError);
  }, [
    canViewTimetable,
    authFetch,
    searchTerm,
    sortBy,
    sortDir,
    locationId,
    trainerId,
  ]);

  const getBookings = useCallback(() => {
    if (!canBook && !isTrainer) {
      return;
    }
    authFetch("GET", "/bookings")
      .then((response) => response.status === 200 && setBookings(response.body))
      .catch(setError);
  }, [authFetch, canBook, isTrainer]);

  useEffect(() => {
    getSessions();
  }, [getSessions]);

  useEffect(() => {
    getBookings();
  }, [getBookings]);

  // Ignore stale bookings after logging out or switching to a non-member role.
  const bookingBySession = useMemo(
    () =>
      new Map(
        canBook ? bookings.map((booking) => [booking.session_id, booking]) : [],
      ),
    [bookings, canBook],
  );

  // Trainers receive only bookings on their own sessions.
  const bookingCountBySession = useMemo(() => {
    const counts = new Map();
    if (isTrainer) {
      for (const { session_id } of bookings) {
        counts.set(session_id, (counts.get(session_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [bookings, isTrainer]);

  const runAction = (session, method, route, body, message) => {
    setError(null);
    setSuccess(null);
    if (method === "POST" && hasStarted(session)) {
      setError("This session has already started and can't be booked.");
      getSessions();
      return;
    }
    setPendingId(session.id);
    authFetch(method, route, body)
      .then((response) => {
        if (response.status >= 200 && response.status < 300) {
          setSuccess(message);
          if (method === "POST") {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
          getSessions();
          getBookings();
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError)
      .finally(() => {
        setPendingId(null);
      });
  };

  if (!canViewTimetable) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl">Timetable</h1>
          <p className="text-sm opacity-70">
            Sessions over the next seven days
          </p>
        </div>
      </div>

      <SearchSortBar
        placeholder="search session name"
        sorts={SORTS}
        sortBy={sortBy}
        sortDir={sortDir}
        onSearch={setSearchTerm}
        onSortBy={setSortBy}
        onSortDir={setSortDir}
      >
        <select
          className="select select-sm w-auto grow"
          aria-label="Filter by location"
          value={locationId}
          onChange={(e) => setFilter("location_id", e.target.value)}
        >
          <option value="">All locations</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
        <select
          className="select select-sm w-auto grow"
          aria-label="Filter by trainer"
          value={trainerId}
          onChange={(e) => setFilter("trainer_id", e.target.value)}
        >
          <option value="">All trainers</option>
          {trainers.map((trainer) => (
            <option key={trainer.id} value={trainer.id}>
              {fullName(trainer)}
            </option>
          ))}
        </select>
      </SearchSortBar>
      {!user && (
        <StatusAlert
          type="info"
          message="Log in as a member to book sessions."
        />
      )}
      <StatusAlert
        type="success"
        message={success}
        onClose={() => setSuccess(null)}
        autoHideMs={3000}
      />
      <StatusAlert message={error} onClose={() => setError(null)} />
      <StatusAlert message={lookupError} />

      {sessions === null ? (
        <span className="loading loading-spinner loading-xl self-center"></span>
      ) : sessions.length === 0 ? (
        <span className="self-center p-4 opacity-70">No sessions found</span>
      ) : (
        <div className="flex flex-col gap-3">
          {sortBy === "date" && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={sessionGroups.every((group) =>
                  expandedDays.includes(group.date),
                )}
                onClick={() =>
                  setOpenDays({
                    viewKey: dayViewKey,
                    dates: sessionGroups.map((group) => group.date),
                  })
                }
              >
                Expand all
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={
                  !sessionGroups.some((group) =>
                    expandedDays.includes(group.date),
                  )
                }
                onClick={() => setOpenDays({ viewKey: dayViewKey, dates: [] })}
              >
                Collapse all
              </button>
            </div>
          )}
          {sessionGroups.map((group) => (
            <section
              key={group.date ?? "all"}
              className="overflow-hidden rounded-box bg-base-200 shadow-sm"
            >
              {group.date && (
                <h2>
                  <button
                    type="button"
                    id={`day-heading-${group.date}`}
                    className="flex w-full items-center justify-between bg-base-300 px-4 py-3 text-left text-sm font-semibold"
                    aria-expanded={expandedDays.includes(group.date)}
                    aria-controls={`day-sessions-${group.date}`}
                    onClick={() =>
                      setOpenDays({
                        viewKey: dayViewKey,
                        dates: expandedDays.includes(group.date)
                          ? expandedDays.filter((date) => date !== group.date)
                          : [...expandedDays, group.date],
                      })
                    }
                  >
                    {formatRelativeDate(group.date)}
                    <FaChevronDown
                      aria-hidden="true"
                      className={
                        expandedDays.includes(group.date) ? "rotate-180" : ""
                      }
                    />
                  </button>
                </h2>
              )}
              <ul
                id={group.date ? `day-sessions-${group.date}` : undefined}
                aria-labelledby={
                  group.date ? `day-heading-${group.date}` : undefined
                }
                hidden={
                  group.date !== null && !expandedDays.includes(group.date)
                }
                className="list"
              >
                {group.sessions.map((session) => {
                  const booking = bookingBySession.get(session.id);
                  const isOwnSession =
                    can(user, "deleteSession") &&
                    session.trainer_id === user.id;
                  const busy = pendingId === session.id;
                  return (
                    <li key={session.id} className="list-row items-center">
                      <div className="flex w-14 flex-col items-center rounded-box bg-primary/10 p-1 text-center text-primary">
                        <span className="text-xs uppercase">
                          {formatWeekday(session.date)}
                        </span>
                        <span className="text-lg font-bold leading-none">
                          {formatDayOfMonth(session.date)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold">
                          {session.title}
                          {isOwnSession && (
                            <span className="badge badge-warning badge-xs">
                              yours
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs opacity-70">
                          <span className="flex items-center gap-1">
                            <FaClock /> {formatTime(session.time)}
                          </span>
                          <span className="flex items-center gap-1">
                            <FaUser />{" "}
                            {fullName(trainerById.get(session.trainer_id))}
                          </span>
                          <span className="flex items-center gap-1">
                            <FaMapMarkerAlt />{" "}
                            {locationById.get(session.location_id)?.name}
                          </span>
                          {isOwnSession && (
                            <span className="flex items-center gap-1">
                              <FaUsers />{" "}
                              {bookingCountBySession.get(session.id) ?? 0}{" "}
                              {bookingCountBySession.get(session.id) === 1
                                ? "booking"
                                : "bookings"}
                            </span>
                          )}
                        </div>
                      </div>
                      {canBook &&
                        (booking ? (
                          <span className="badge badge-success badge-soft">
                            Booked
                          </span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={busy}
                            onClick={() =>
                              runAction(
                                session,
                                "POST",
                                "/bookings",
                                { session_id: session.id },
                                `Booked "${session.title}".`,
                              )
                            }
                          >
                            {busy ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              "Book"
                            )}
                          </button>
                        ))}
                      {!user && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate("/login")}
                        >
                          Log in
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export default TimetableView;
