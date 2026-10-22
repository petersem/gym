import XMLBuilder from "fast-xml-builder";

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  attributeNamePrefix: "@_",
});

const sessionElements = `<!ELEMENT session (id, title, date, time, activity, trainer, location)>
<!ELEMENT id (#PCDATA)>
<!ELEMENT title (#PCDATA)>
<!ELEMENT date (#PCDATA)>
<!ELEMENT time (#PCDATA)>
<!ELEMENT activity (name, description)>
<!ELEMENT name (#PCDATA)>
<!ELEMENT description (#PCDATA)>
<!ELEMENT trainer (firstName, lastName)>
<!ELEMENT firstName (#PCDATA)>
<!ELEMENT lastName (#PCDATA)>
<!ELEMENT location (name, street, suburb, postcode)>
<!ELEMENT street (#PCDATA)>
<!ELEMENT suburb (#PCDATA)>
<!ELEMENT postcode (#PCDATA)>`;

const bookingSessionElements = `<!ELEMENT session (title, date, time, activity, trainer, location)>
<!ELEMENT title (#PCDATA)>
<!ELEMENT date (#PCDATA)>
<!ELEMENT time (#PCDATA)>
<!ELEMENT activity (name, description)>
<!ELEMENT name (#PCDATA)>
<!ELEMENT description (#PCDATA)>
<!ELEMENT trainer (firstName, lastName)>
<!ELEMENT firstName (#PCDATA)>
<!ELEMENT lastName (#PCDATA)>
<!ELEMENT location (name, street, suburb, postcode)>
<!ELEMENT street (#PCDATA)>
<!ELEMENT suburb (#PCDATA)>
<!ELEMENT postcode (#PCDATA)>`;

export const bookingsDtd = `<!DOCTYPE gymBookings [
<!ELEMENT gymBookings (booking*)>
<!ATTLIST gymBookings export-date CDATA "0000-00-00">
<!ELEMENT booking (id, user, created, session)>
<!ELEMENT id (#PCDATA)>
<!ELEMENT created (#PCDATA)>
<!ELEMENT user (firstName, lastName)>
<!ELEMENT firstName (#PCDATA)>
<!ELEMENT lastName (#PCDATA)>
${bookingSessionElements}
]>`;

export const sessionsDtd = `<!DOCTYPE gymSessions [
<!ELEMENT gymSessions (session*)>
<!ATTLIST gymSessions export-date CDATA "0000-00-00">
${sessionElements}
]>`;

const byId = (items, id) =>
  items.find((item) => Number(item.id) === Number(id)) ?? {};

const dateOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};
const timeOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};
const localDate = new Intl.DateTimeFormat("en-AU", dateOptions);
const localTime = new Intl.DateTimeFormat("en-AU", timeOptions);
const localDateTime = new Intl.DateTimeFormat("en-AU", {
  ...dateOptions,
  ...timeOptions,
});
const compactMeridiem = (value) => value.replace(/\s+(am|pm)$/i, "$1");

/**
 * Maps a session to its XML element content.
 * @param {Object} session Session record.
 * @param {{activities: Array, locations: Array, users: Array}} lookups Related records.
 * @param {{includeId?: boolean}} [options] Whether to include the session ID.
 * @returns {Object} XML-ready session.
 */
export function sessionXmlRecord(
  session,
  { activities, locations, users },
  { includeId = true } = {},
) {
  const activity = byId(activities, session.activity_id);
  const trainer = byId(users, session.trainer_id);
  const location = byId(locations, session.location_id);
  const date =
    session.date instanceof Date
      ? session.date
      : new Date(`${String(session.date).slice(0, 10)}T00:00:00`);
  const time = session.time ? new Date(`2000-01-01T${session.time}`) : null;
  return {
    ...(includeId ? { id: String(session.id) } : {}),
    title: String(session.title ?? ""),
    date: localDate.format(date),
    time: time ? compactMeridiem(localTime.format(time)) : "",
    activity: {
      name: String(activity.name ?? ""),
      description: String(activity.description ?? ""),
    },
    trainer: {
      firstName: String(trainer.first_name ?? ""),
      lastName: String(trainer.last_name ?? ""),
    },
    location: {
      name: String(location.name ?? ""),
      street: String(location.street ?? ""),
      suburb: String(location.suburb ?? ""),
      postcode: String(location.postcode ?? ""),
    },
  };
}

/**
 * Maps a booking and its session to XML element content.
 * @param {Object} booking Booking record.
 * @param {Object} session The booked session.
 * @param {{activities: Array, locations: Array, users: Array}} lookups Related records.
 * @returns {Object} XML-ready booking.
 */
export function bookingXmlRecord(booking, session, lookups) {
  const bookingUser = byId(lookups.users, booking.user_id);
  return {
    id: String(booking.id),
    user: {
      firstName: String(bookingUser.first_name ?? ""),
      lastName: String(bookingUser.last_name ?? ""),
    },
    created:
      booking.created == null || booking.created === ""
        ? ""
        : compactMeridiem(localDateTime.format(new Date(booking.created))),
    session: sessionXmlRecord(session, lookups, { includeId: false }),
  };
}

/**
 * Maps booking records to the root content for a bookings XML document.
 * @param {Array} bookings XML-ready booking records.
 * @returns {Object} XML-ready gymBookings root content.
 */
export function bookingsXmlContent(bookings) {
  return {
    "@_export-date": exportDate(),
    booking: bookings,
  };
}

/**
 * Maps session records to the root content for a sessions XML document.
 * @param {Array} sessions XML-ready session records.
 * @returns {Object} XML-ready gymSessions root content.
 */
export function sessionsXmlContent(sessions) {
  return {
    "@_export-date": exportDate(),
    session: sessions,
  };
}

function exportDate() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Builds an XML document with an internal DTD.
 * @param {string} root Root element name.
 * @param {Object} content Root element content.
 * @param {string} dtd Document type declaration.
 * @returns {string} XML document.
 */
export function buildXmlDocument(root, content, dtd) {
  const xml = xmlBuilder.build({
    "?xml": { "@_version": "1.0", "@_encoding": "UTF-8" },
    [root]: content,
  });
  const declarationEnd = xml.indexOf("?>") + 2;
  return `${xml.slice(0, declarationEnd)}\n${dtd}\n${xml.slice(declarationEnd).trimStart()}`;
}

/**
 * Sends an XML document as a file download.
 * @param {express.Response} res Express response.
 * @param {string} filename Download filename.
 * @param {string} document XML document.
 * @returns {express.Response} Express response.
 */
export function sendXmlDocument(res, filename, document) {
  res.set({
    "Content-Type": "application/xml; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  return res.send(document);
}
