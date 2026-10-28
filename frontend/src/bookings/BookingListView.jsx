import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  FaClock,
  FaMapMarkerAlt,
  FaTrash,
  FaUser,
  FaUsers,
} from "react-icons/fa";
import {
  filterUpcomingSessionRows,
  searchAndSortBookingRows,
} from "./bookingRows.mjs";
import { useAuthenticate } from "../authentication/useAuthenticate.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import SearchSortBar from "../common/SearchSortBar.jsx";
import StatusAlert from "../common/StatusAlert.jsx";
import XMLDownloadButton from "../common/XMLDownloadButton.jsx";
import {
  formatDate,
  formatDateTime,
  formatTime,
  fullName,
  sessionStart,
} from "../common/format.mjs";
import { can, PERMISSIONS } from "../common/permissions.mjs";
import { useLookups } from "../common/useLookups.jsx";

const SORTS = [
  { value: "session_date", label: "session date" },
  { value: "session", label: "session" },
  { value: "trainer", label: "trainer" },
  { value: "created", label: "booked on" },
];

const TRAINER_SORTS = [
  { value: "session_date", label: "session date" },
  { value: "session", label: "session" },
];

function BookingListView() {
  const navigate = useNavigate();
  const { user, authFetch } = useAuthenticate(PERMISSIONS.readBookings);
  const { trainerById, locationById, error: lookupError } = useLookups();
  const isTrainer = user?.role === "trainer";

  const [bookings, setBookings] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("session_date");
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [deletingSession, setDeletingSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const getBookings = useCallback(() => {
    if (!user) {
      return;
    }
    authFetch("GET", "/bookings?sort_by=session_date&sort_dir=asc")
      .then((response) => {
        if (response.status === 200) {
          setBookings(response.body);
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError);
  }, [user, authFetch]);

  useEffect(() => {
    getBookings();
  }, [getBookings]);

  // Sessions can't be read individually via the API; the timetable covers today
  // plus the next 6 days.
  useEffect(() => {
    if (!can(user, "viewTimetable")) {
      return;
    }
    authFetch("GET", "/timetable")
      .then((response) =>
        setSessions(response.status === 200 ? response.body : []),
      )
      .catch(() => setSessions([]));
  }, [authFetch, user]);

  const sessionById = useMemo(
    () => new Map((sessions ?? []).map((session) => [session.id, session])),
    [sessions],
  );

  useEffect(() => {
    const nextStart = (sessions ?? [])
      .map(sessionStart)
      .filter((start) => start > now)
      .sort((a, b) => a - b)[0];
    if (!nextStart) {
      return;
    }
    const timeout = setTimeout(
      () => setNow(new Date()),
      nextStart.getTime() - now.getTime() + 1,
    );
    return () => clearTimeout(timeout);
  }, [sessions, now]);

  const visibleBookings = useMemo(
    () =>
      sessions === null || bookings === null
        ? null
        : filterUpcomingSessionRows(bookings, sessionById, now),
    [bookings, sessions, sessionById, now],
  );

  const nextBooking = (bookings ?? []).find((booking) => {
    const session = sessionById.get(booking.session_id);
    return session && sessionStart(session) > now;
  });

  const cancelBooking = () => {
    setBusy(true);
    setError(null);
    authFetch("DELETE", `/bookings/${cancelling.id}`)
      .then((response) => {
        if (response.status === 200) {
          setSuccess("Booking cancelled.");
          window.scrollTo({ top: 0, behavior: "smooth" });
          getBookings();
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError)
      .finally(() => {
        setBusy(false);
        setCancelling(null);
      });
  };

  const deleteSession = () => {
    setBusy(true);
    setError(null);
    authFetch("DELETE", `/sessions/${deletingSession.id}`)
      .then((response) => {
        if (response.status === 200) {
          setSuccess("Session deleted.");
          window.scrollTo({ top: 0, behavior: "smooth" });
          setSessions((current) =>
            current.filter((session) => session.id !== deletingSession.id),
          );
          getBookings();
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError)
      .finally(() => {
        setBusy(false);
        setDeletingSession(null);
      });
  };

  if (!user) {
    return (
      <span className="loading loading-spinner loading-xl mx-auto mt-8 block"></span>
    );
  }

  // Trainers see one row per session with its booking total, not who booked.
  const sessionRows = [];
  if (isTrainer && sessions) {
    const bookingCounts = new Map();
    for (const booking of visibleBookings ?? []) {
      bookingCounts.set(
        booking.session_id,
        (bookingCounts.get(booking.session_id) ?? 0) + 1,
      );
    }
    sessionRows.push(
      ...filterUpcomingSessionRows(
        sessions
          .filter((session) => Number(session.trainer_id) === Number(user.id))
          .map((session) => ({
            id: session.id,
            session_id: session.id,
            count: bookingCounts.get(session.id) ?? 0,
          })),
        sessionById,
        now,
      ),
    );
  }
  const unfilteredRows = isTrainer
    ? sessions === null || visibleBookings === null
      ? null
      : sessionRows
    : visibleBookings;
  const rows =
    unfilteredRows === null
      ? null
      : searchAndSortBookingRows(unfilteredRows, {
          sessionById,
          trainerById,
          searchTerm,
          sortBy,
          sortDir,
        });
  const totalBookings = sessionRows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl">
            {isTrainer ? "Session bookings" : "My bookings"}
          </h1>
          <p className="text-sm opacity-70">
            {isTrainer
              ? `${totalBookings} member ${
                  totalBookings === 1 ? "booking" : "bookings"
                } across ${sessionRows.length} ${
                  sessionRows.length === 1 ? "session" : "sessions"
                }`
              : "Classes you've booked"}
          </p>
        </div>
        {can(user, "exportBookings") && (
          <XMLDownloadButton
            route="/bookings/xml"
            filename="gym-bookings.xml"
            authenticationKey={user.authenticationKey}
            onError={setError}
            className="btn btn-sm btn-warning"
          >
            Export Bookings
          </XMLDownloadButton>
        )}
        {can(user, "exportSessions") && (
          <XMLDownloadButton
            route="/sessions/xml"
            filename="gym-sessions.xml"
            authenticationKey={user.authenticationKey}
            onError={setError}
            className="btn btn-sm btn-warning"
          >
            Download Sessions
          </XMLDownloadButton>
        )}
      </div>

      <SearchSortBar
        placeholder="search session title"
        sorts={isTrainer ? TRAINER_SORTS : SORTS}
        sortBy={sortBy}
        sortDir={sortDir}
        onSearch={setSearchTerm}
        onSortBy={setSortBy}
        onSortDir={setSortDir}
      />

      <StatusAlert
        type="success"
        message={success}
        onClose={() => setSuccess(null)}
        autoHideMs={3000}
      />
      <StatusAlert message={error} onClose={() => setError(null)} />
      <StatusAlert message={lookupError} />

      {rows === null ? (
        <span className="loading loading-spinner loading-xl self-center"></span>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-4 opacity-70">
          <span>No bookings found</span>
          {can(user, "makeBooking") && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/")}
            >
              Browse the timetable
            </button>
          )}
        </div>
      ) : (
        <ul className="list rounded-box bg-base-200 shadow-sm">
          {rows.map((booking) => {
            const session = sessionById.get(booking.session_id);
            return (
              <li key={booking.id} className="list-row items-center">
                <div className="min-w-0 list-col-grow">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {session?.title ?? `Session #${booking.session_id}`}
                    {!isTrainer && booking.id === nextBooking?.id && (
                      <span className="badge badge-primary badge-soft badge-sm next-booking-badge items-center leading-none">
                        next
                      </span>
                    )}
                  </div>
                  {session ? (
                    <div className="flex flex-wrap gap-x-3 text-xs opacity-70">
                      <span className="flex items-center gap-1">
                        <FaClock /> {formatDate(session.date)}{" "}
                        {formatTime(session.time)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FaMapMarkerAlt />{" "}
                        {locationById.get(session.location_id)?.name}
                      </span>
                      {!isTrainer && (
                        <span className="flex items-center gap-1">
                          <FaUser />{" "}
                          {fullName(trainerById.get(session.trainer_id))}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="badge badge-ghost badge-xs">
                      more than a week away
                    </span>
                  )}
                  {!isTrainer && (
                    <div className="text-xs opacity-50">
                      booked {formatDateTime(booking.created)}
                    </div>
                  )}
                </div>
                {isTrainer && (
                  <span className="badge badge-warning badge-soft text-base-content whitespace-nowrap">
                    <FaUsers /> {booking.count}{" "}
                    {booking.count === 1 ? "booking" : "bookings"}
                  </span>
                )}
                {isTrainer && session && (
                  <button
                    className="btn btn-ghost btn-sm text-error"
                    aria-label="Delete session"
                    disabled={busy}
                    onClick={() => setDeletingSession(session)}
                  >
                    <FaTrash />
                  </button>
                )}
                {can(user, "cancelBooking") && (
                  <button
                    className="btn btn-ghost btn-sm text-error"
                    onClick={() => setCancelling(booking)}
                  >
                    Cancel
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel booking?"
        message={`Cancel your booking for "${
          sessionById.get(cancelling?.session_id)?.title ??
          `session #${cancelling?.session_id}`
        }"?`}
        confirmLabel="Cancel booking"
        busy={busy}
        onConfirm={cancelBooking}
        onClose={() => setCancelling(null)}
      />
      <ConfirmDialog
        open={!!deletingSession}
        title="Delete session?"
        message={`Delete "${deletingSession?.title}"? All bookings for it will also be removed.`}
        confirmLabel="Delete session"
        busy={busy}
        onConfirm={deleteSession}
        onClose={() => setDeletingSession(null)}
      />
    </section>
  );
}

export default BookingListView;
