import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { FaClock, FaMapMarkerAlt, FaUser, FaUsers } from "react-icons/fa";
import { queryString } from "../api.mjs";
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
  startOfToday,
} from "../common/format.mjs";
import { can, PERMISSIONS } from "../common/permissions.mjs";
import { useLookups } from "../common/useLookups.jsx";

const SORTS = [
  { value: "session_date", label: "session date" },
  { value: "session", label: "session" },
  { value: "member", label: "trainer" },
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
  const [bookingsByDate, setBookingsByDate] = useState([]);
  const [sessions, setSessions] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("session_date");
  const [sortDir, setSortDir] = useState("asc");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const getBookings = useCallback(() => {
    if (!user) {
      return;
    }
    Promise.all([
      authFetch(
        "GET",
        "/bookings" +
          queryString({
            search_term: searchTerm,
            sort_by: sortBy,
            sort_dir: sortDir,
          }),
      ),
      authFetch("GET", "/bookings?sort_by=session_date&sort_dir=asc"),
    ])
      .then(([response, byDate]) => {
        if (response.status === 200 && byDate.status === 200) {
          setBookings(response.body);
          setBookingsByDate(byDate.body);
        } else {
          setError((response.status === 200 ? byDate : response).body.message);
        }
      })
      .catch(setError);
  }, [user, authFetch, searchTerm, sortBy, sortDir]);

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

  // Bookings don't include session dates, so use session-date order to identify
  // older bookings before the first known upcoming session.
  const pastBookingIds = useMemo(() => {
    const pastIds = new Set();
    for (const booking of bookingsByDate) {
      const session = sessionById.get(booking.session_id);
      if (session && sessionStart(session) >= startOfToday()) {
        break;
      }
      pastIds.add(booking.id);
    }
    return pastIds;
  }, [bookingsByDate, sessionById]);

  const visibleBookings = useMemo(
    () =>
      sessions === null || bookings === null
        ? null
        : bookings.filter(
            (booking) =>
              sessionById.has(booking.session_id) &&
              !pastBookingIds.has(booking.id),
          ),
    [bookings, sessions, sessionById, pastBookingIds],
  );

  const now = new Date();
  const nextBooking = bookingsByDate.find((booking) => {
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

  if (!user) {
    return (
      <span className="loading loading-spinner loading-xl mx-auto mt-8 block"></span>
    );
  }

  // Trainers see one row per session with its booking total, not who booked.
  const sessionRows = [];
  if (isTrainer && visibleBookings) {
    const rowBySession = new Map();
    for (const booking of visibleBookings) {
      // Only sessions in the next 7 days have details available from the API.
      if (!sessionById.has(booking.session_id)) {
        continue;
      }
      let row = rowBySession.get(booking.session_id);
      if (!row) {
        row = {
          id: booking.session_id,
          session_id: booking.session_id,
          count: 0,
        };
        rowBySession.set(booking.session_id, row);
        sessionRows.push(row);
      }
      row.count += 1;
    }
  }
  const rows = isTrainer ? visibleBookings && sessionRows : visibleBookings;
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
            route="/bookings/export.xml"
            filename="gym-bookings.xml"
            authenticationKey={user.authenticationKey}
            onError={setError}
            className="btn btn-sm btn-warning"
          >
            Export past
          </XMLDownloadButton>
        )}
        {can(user, "exportSessions") && (
          <XMLDownloadButton
            route="/sessions/export.xml"
            filename="gym-sessions.xml"
            authenticationKey={user.authenticationKey}
            onError={setError}
            className="btn btn-sm btn-warning"
          >
            My sessions
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
                      <span className="badge badge-primary badge-soft badge-sm">
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
                  <span className="badge badge-warning badge-soft whitespace-nowrap">
                    <FaUsers /> {booking.count}{" "}
                    {booking.count === 1 ? "booking" : "bookings"}
                  </span>
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
    </section>
  );
}

export default BookingListView;
