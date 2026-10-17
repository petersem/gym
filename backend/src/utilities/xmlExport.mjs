import XMLBuilder from "fast-xml-builder";

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
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

export const bookingsDtd = `<!DOCTYPE gymBookings [
<!ELEMENT gymBookings (booking*)>
<!ELEMENT booking (id, userId, user, created, session)>
<!ELEMENT userId (#PCDATA)>
<!ELEMENT user (firstName, lastName)>
<!ELEMENT created (#PCDATA)>
${sessionElements}
]>`;

export const sessionsDtd = `<!DOCTYPE gymSessions [
<!ELEMENT gymSessions (session*)>
${sessionElements}
]>`;

const byId = (items, id) =>
  items.find((item) => Number(item.id) === Number(id)) ?? {};

/**
 * Maps a session to its XML element content.
 * @param {Object} session Session record.
 * @param {{activities: Array, locations: Array, users: Array}} lookups Related records.
 * @returns {Object} XML-ready session.
 */
export function sessionXmlRecord(session, { activities, locations, users }) {
  const activity = byId(activities, session.activity_id);
  const trainer = byId(users, session.trainer_id);
  const location = byId(locations, session.location_id);
  return {
    id: String(session.id),
    title: String(session.title ?? ""),
    date: String(session.date).slice(0, 10),
    time: String(session.time ?? "").slice(0, 8),
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
    userId: String(booking.user_id),
    user: {
      firstName: String(bookingUser.first_name ?? ""),
      lastName: String(bookingUser.last_name ?? ""),
    },
    created: String(booking.created ?? ""),
    session: sessionXmlRecord(session, lookups),
  };
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
 * @param {import("express").Response} res Express response.
 * @param {string} filename Download filename.
 * @param {string} document XML document.
 * @returns {import("express").Response} Express response.
 */
export function sendXmlDocument(res, filename, document) {
  res.set({
    "Content-Type": "application/xml; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  return res.send(document);
}
