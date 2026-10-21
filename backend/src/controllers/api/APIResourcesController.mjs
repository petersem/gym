import express from "express";
import bcrypt from "bcryptjs";
import validator from "validator";
import { UsersModel } from "../../models/UsersModel.mjs";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { SessionsModel } from "../../models/SessionsModel.mjs";
import { BookingsModel } from "../../models/BookingsModel.mjs";
import { BlogModel } from "../../models/BlogModel.mjs";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";
import { APIAuthenticationController } from "./APIAuthenticationController.mjs";
import {
  bookingXmlRecord,
  bookingsDtd,
  buildXmlDocument,
  sendXmlDocument,
  sessionXmlRecord,
  sessionsDtd,
} from "../../utilities/xmlExport.mjs";
import {
  APIError,
  activeRecord,
  publicRecord,
  publicUser,
  validateUserDetails,
} from "./apiHelpers.mjs";

const resources = [
  {
    path: "users",
    removedMethods: ["post", "delete"],
    list: false,
    schema: "User",
    tag: "Users",
    model: UsersModel,
    roles: [],
    getRoles: ["trainer", "member"],
    putRoles: ["trainer", "member"],
    description:
      "Members and trainers can read and update only their own record, without changing their role. Users cannot be listed, created or deleted through this resource; use GET /trainers to list trainers. Passwords and authentication keys are never returned.",
    serialize: publicUser,
  },
  {
    path: "locations",
    removedMethods: ["post", "put", "delete"],
    schema: "Location",
    tag: "Locations",
    model: LocationModel,
    roles: [],
    getRoles: ["trainer", "member"],
    description:
      "Authenticated members and trainers can list and read locations. Guests have no access. Locations cannot be created, updated or deleted through the API.",
  },
  {
    path: "sessions",
    removedMethods: ["post", "get", "put"],
    list: false,
    schema: "Session",
    tag: "Sessions",
    model: SessionsModel,
    roles: [],
    deleteRoles: ["trainer"],
    description:
      "Trainers can delete only their own sessions; sessions cannot be listed, read, created or updated through this resource. Members and trainers use the timetable to browse sessions. Deleting a session also removes its bookings.",
  },
  {
    path: "bookings",
    schema: "Booking",
    tag: "Bookings",
    model: BookingsModel,
    roles: ["member"],
    getRoles: ["trainer", "member"],
    putRoles: [],
    query: {
      searchDescription: "session title",
      sorts: ["session_date", "session", "member", "created"],
      defaultSort: "session_date",
      defaultDir: "asc",
    },
    description:
      "Members can read, create and cancel only their own bookings, but cannot update bookings. Trainers can read bookings only for sessions assigned to them; they cannot create, update or cancel bookings. Duplicate and overlapping bookings return 409.",
  },
  {
    path: "blogs",
    schema: "Blog",
    listSchema: "BlogSummary",
    tag: "Blogs",
    model: BlogModel,
    roles: ["trainer", "member"],
    publicRead: true,
    query: {
      searchDescription: "title or content",
      sorts: ["created", "title"],
      defaultSort: "created",
      defaultDir: "desc",
    },
    description:
      "Guests, members and trainers can read posts; blog lists include the author's first name. Members and trainers create posts as themselves and edit or delete only their own posts. Authors and creation timestamps are immutable. Administrators have no API access.",
  },
];

const response = (schema, description) => ({
  description,
  content: { "application/json": { schema } },
});
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const errorResponses = Object.fromEntries(
  [400, 401, 403, 404, 409, 415, 500, "default"].map((status) => [
    status,
    { $ref: "#/components/responses/Error" },
  ]),
);
const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1, maximum: 2147483647 },
  description: "Positive record identifier.",
};

/**
 * OpenAPI path definitions for the resource, timetable, trainer, and XML export endpoints.
 *
 * @type {Record<string, object>}
 */
export const apiResourcePaths = {};

/**
 * Create query parameter definitions for a searchable and sortable collection.
 *
 * @param {{searchDescription: string, sorts: string[], defaultSort: string, defaultDir: string}} options
 * @returns {object[]} OpenAPI query parameter definitions.
 */
function queryParameters(options) {
  return [
    {
      name: "search_term",
      in: "query",
      schema: { type: "string", maxLength: 100 },
      description: `Case-insensitive match on ${options.searchDescription}.`,
    },
    {
      name: "sort_by",
      in: "query",
      schema: {
        type: "string",
        enum: options.sorts,
        default: options.defaultSort,
      },
      description: "Field to sort by.",
    },
    {
      name: "sort_dir",
      in: "query",
      schema: {
        type: "string",
        enum: ["asc", "desc"],
        default: options.defaultDir,
      },
      description: "Sort direction.",
    },
  ];
}
const timetable = {
  path: "timetable",
  query: {
    searchDescription: "session title only",
    sorts: ["date", "title", "trainer", "location"],
    defaultSort: "date",
    defaultDir: "asc",
  },
};
for (const resource of resources) {
  const basePath = `/api/v1/${resource.path}`;
  const operation = (method, summary, schema, status = 200) => ({
    tags: [resource.tag],
    operationId: `${method}${resource.tag}`,
    summary,
    description: resource.description,
    security:
      resource.publicRead && ["list", "get"].includes(method)
        ? []
        : [{ ApiKey: [] }],
    responses: {
      [status]: response(schema, summary),
      ...errorResponses,
    },
  });
  const body = (schema) => ({
    required: true,
    content: { "application/json": { schema: ref(schema) } },
  });
  apiResourcePaths[basePath] = {
    get: {
      ...operation("list", `List ${resource.path}`, {
        type: "array",
        items: ref(resource.listSchema ?? resource.schema),
      }),
      ...(resource.query
        ? {
            summary: `List, search and sort ${resource.path}`,
            parameters: queryParameters(resource.query),
          }
        : {}),
    },
    post: {
      ...operation(
        "create",
        `Create ${resource.schema.toLowerCase()}`,
        ref(resource.schema),
        201,
      ),
      requestBody: body(`${resource.schema}Create`),
    },
  };
  apiResourcePaths[`${basePath}/{id}`] = {
    parameters: [idParameter],
    get: operation(
      "get",
      `Get ${resource.schema.toLowerCase()}`,
      ref(resource.schema),
    ),
    put: {
      ...operation(
        "update",
        `Update ${resource.schema.toLowerCase()}`,
        ref(resource.schema),
      ),
      requestBody: body(`${resource.schema}Update`),
    },
    delete: operation(
      "delete",
      `Delete ${resource.schema.toLowerCase()}`,
      ref("Message"),
    ),
  };
  for (const method of resource.removedMethods ?? []) {
    delete apiResourcePaths[method === "post" ? basePath : `${basePath}/{id}`][
      method
    ];
  }
  if (resource.list === false) {
    delete apiResourcePaths[basePath].get;
    if (Object.keys(apiResourcePaths[basePath]).length === 0) {
      delete apiResourcePaths[basePath];
    }
  }
}

apiResourcePaths["/api/v1/trainers"] = {
  get: {
    tags: ["Users"],
    operationId: "listTrainers",
    summary: "List trainers",
    description:
      "Authenticated members and trainers can list trainers, which returns only ID, name and role. Guests and administrators have no access.",
    security: [{ ApiKey: [] }],
    responses: {
      200: response(
        { type: "array", items: ref("UserSummary") },
        "Trainers, ordered by ID.",
      ),
      ...errorResponses,
    },
  },
};

apiResourcePaths["/api/v1/timetable"] = {
  get: {
    tags: ["Sessions"],
    operationId: "getTimetable",
    summary: "Browse, search and sort the next seven days of sessions",
    description:
      "Authenticated members and trainers can browse, search and sort the next seven days of sessions. Guests and administrators have no timetable access.",
    security: [{ ApiKey: [] }],
    parameters: [
      ...["location_id", "trainer_id"].map((name) => ({
        name,
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 2147483647 },
        description: `Filter by ${name.replace("_id", "")}.`,
      })),
      ...queryParameters(timetable.query),
    ],
    responses: {
      200: response(
        { type: "array", items: ref("Session") },
        "Upcoming sessions, ordered by date and time unless sort_by is given.",
      ),
      ...errorResponses,
    },
  },
};

/**
 * Create the OpenAPI path item for an authenticated XML download endpoint.
 *
 * @param {object} options
 * @param {string} options.tag OpenAPI tag for the endpoint.
 * @param {string} options.operationId Unique OpenAPI operation identifier.
 * @param {string} options.summary Short endpoint summary.
 * @param {string} options.description Endpoint access and behavior description.
 * @param {string} options.root XML document root element.
 * @param {string} options.filename Download filename.
 * @returns {object} OpenAPI path item describing the XML response.
 */
const xmlExportPath = ({
  tag,
  operationId,
  summary,
  description,
  root,
  filename,
}) => ({
  get: {
    tags: [tag],
    operationId,
    summary,
    description,
    security: [{ ApiKey: [] }],
    responses: {
      200: {
        description: `XML download (${filename}) with an internal DTD and a <${root}> root element. Dates use DD/MM/YYYY and times use h:mmam/pm in the server's local timezone.`,
        headers: {
          "Content-Disposition": {
            schema: { type: "string" },
            example: `attachment; filename="${filename}"`,
          },
        },
        content: { "application/xml": { schema: { type: "string" } } },
      },
      ...errorResponses,
    },
  },
});
apiResourcePaths["/api/v1/bookings/export.xml"] = xmlExportPath({
  tag: "Bookings",
  operationId: "exportBookingsXml",
  summary: "Download your past bookings as XML",
  description:
    "Members download all of their own bookings for sessions that have already taken place, with session, activity, trainer and location details. Guests, trainers and administrators have no access.",
  root: "gymBookings",
  filename: "gym-bookings.xml",
});
apiResourcePaths["/api/v1/sessions/export.xml"] = xmlExportPath({
  tag: "Sessions",
  operationId: "exportSessionsXml",
  summary: "Download your sessions for the next seven days as XML",
  description:
    "Trainers download their own sessions in the next seven days, with activity, trainer and location details. Bookings are not included. Guests, members and administrators have no access.",
  root: "gymSessions",
  filename: "gym-sessions.xml",
});

/**
 * Ensure the authenticated user is allowed to access or manage a record.
 *
 * @param {object} resource Resource configuration.
 * @param {{id: number|string, role: string}} user Authenticated user.
 * @param {object} record Resource record.
 * @returns {Promise<void>}
 * @throws {APIError} If the record is outside the user's permitted scope.
 */
async function authorizeRecord(resource, user, record) {
  if (resource.path === "bookings" && user.role === "trainer") {
    const session = await activeRecord(SessionsModel, record.session_id);
    if (Number(session.trainer_id) !== Number(user.id)) {
      throw new APIError(
        403,
        "You can only view bookings for your own sessions.",
      );
    }
    return;
  }
  const ownerField =
    resource.path === "users"
      ? "id"
      : resource.path === "sessions"
        ? "trainer_id"
        : "user_id";
  if (
    ["users", "sessions", "bookings", "blogs"].includes(resource.path) &&
    Number(record[ownerField]) !== Number(user?.id)
  ) {
    throw new APIError(403, "You can only manage your own records.");
  }
}

/**
 * Apply resource-specific validation and server-managed fields before a write.
 *
 * @param {object} resource Resource configuration.
 * @param {express.Request} req Request containing the authenticated user and input body.
 * @param {object} [existing] Existing record for an update.
 * @returns {Promise<object>} Record ready to be written by its model.
 * @throws {APIError} If validation or resource-specific authorization fails.
 */
async function prepareRecord(resource, req, existing) {
  const user = req.authenticatedUser;
  const record = { ...existing, ...req.body, id: existing?.id ?? null };
  switch (resource.path) {
    case "users":
      if (existing && record.role !== existing.role) {
        throw new APIError(403, "You cannot change your role.");
      }
      if (record.dob instanceof Date) {
        record.dob = DatabaseModel.toMySqlDate(record.dob);
      }
      validateUserDetails({ ...record, password: req.body.password });
      if (existing && req.body.password === "") {
        record.password = existing.password;
      } else if (req.body.password !== undefined) {
        if (
          existing &&
          (await bcrypt.compare(req.body.password, existing.password))
        ) {
          record.password = existing.password;
        } else {
          record.password = await bcrypt.hash(req.body.password, 10);
          record.authentication_key = null;
        }
      }
      record.dob ??= null;
      record.deleted = 0;
      break;
    case "activities":
      record.deleted = 0;
      record.updated_by = user.id;
      break;
    case "locations":
      await activeRecord(UsersModel, record.manager);
      record.deleted = 0;
      record.updated_by = user.id;
      break;
    case "sessions": {
      if (
        !validator.isISO8601(record.date, {
          strict: true,
          strictSeparator: true,
        })
      ) {
        throw new APIError(400, "Session date must be a real calendar date.");
      }
      const trainer = await activeRecord(UsersModel, record.trainer_id);
      if (trainer.role !== "trainer") {
        throw new APIError(400, "Select an existing trainer.");
      }
      await activeRecord(ActivitiesModel, record.activity_id);
      await activeRecord(LocationModel, record.location_id);
      if (record.date < DatabaseModel.toMySqlDate(new Date())) {
        throw new APIError(400, "Session date cannot be earlier than today.");
      }
      if (record.time.length === 5) {
        record.time += ":00";
      }
      break;
    }
    case "bookings": {
      record.user_id ??= user.id;
      if (
        user.role === "member" &&
        Number(record.user_id) !== Number(user.id)
      ) {
        throw new APIError(403, "Members can only book for themselves.");
      }
      const member = await activeRecord(UsersModel, record.user_id);
      if (member.role !== "member") {
        throw new APIError(400, "Select an existing member.");
      }
      const session = await activeRecord(SessionsModel, record.session_id);
      if (session.date < DatabaseModel.toMySqlDate(new Date())) {
        throw new APIError(400, "Cannot book a past session.");
      }
      record.created = existing?.created ?? new Date();
      break;
    }
    case "blogs":
      record.user_id = existing?.user_id ?? user.id;
      record.created = existing?.created ?? new Date();
      break;
  }
  return record;
}

/**
 * Convert values to comparable text, including dates and nullish values.
 *
 * @param {*} value Value to convert.
 * @returns {string}
 */
const asText = (value) =>
  value instanceof Date ? value.toISOString() : String(value ?? "");

/**
 * Filter and sort resource records according to the supported query options.
 *
 * @param {object} resource Resource configuration, including path and query options.
 * @param {object[]} records Records to filter and sort.
 * @param {object} query Request query parameters.
 * @returns {Promise<object[]>} Filtered and sorted records.
 */
async function searchAndSort(resource, records, query) {
  const options = resource.query;
  const term = String(query.search_term ?? "")
    .trim()
    .toLowerCase();
  if (!options || (!term && !query.sort_by && !query.sort_dir)) {
    return records;
  }
  let fields;
  if (resource.path === "timetable") {
    const [users, locations] = await Promise.all([
      UsersModel.getAll(),
      LocationModel.getAll(),
    ]);
    const userById = new Map(users.map((u) => [Number(u.id), u]));
    const locationById = new Map(locations.map((l) => [Number(l.id), l]));
    fields = (session) => {
      const trainer = userById.get(Number(session.trainer_id));
      const location = locationById.get(Number(session.location_id));
      const trainerName = trainer
        ? `${trainer.last_name}, ${trainer.first_name}`
        : "";
      return {
        search: [session.title],
        date: `${session.date} ${session.time}`,
        title: session.title,
        trainer: trainerName,
        location: location?.name ?? "",
      };
    };
  } else if (resource.path === "bookings") {
    const [sessions, users] = await Promise.all([
      SessionsModel.getAll(),
      UsersModel.getAll(),
    ]);
    const sessionById = new Map(sessions.map((s) => [Number(s.id), s]));
    const userById = new Map(users.map((u) => [Number(u.id), u]));
    fields = (booking) => {
      const session = sessionById.get(Number(booking.session_id)) ?? {};
      const member = userById.get(Number(booking.user_id));
      const date =
        session.date instanceof Date
          ? DatabaseModel.toMySqlDate(session.date)
          : String(session.date ?? "").slice(0, 10);
      return {
        search: [session.title],
        session_date: `${date} ${session.time ?? ""}`,
        session: session.title,
        member: member ? `${member.last_name}, ${member.first_name}` : "",
        created: new Date(booking.created).toISOString(),
      };
    };
  } else {
    fields = (blog) => ({
      search: [blog.title, blog.content],
      title: blog.title,
      created: new Date(blog.created).toISOString(),
    });
  }
  const sortBy = options.sorts.includes(query.sort_by)
    ? query.sort_by
    : options.defaultSort;
  const direction =
    (["asc", "desc"].includes(query.sort_dir)
      ? query.sort_dir
      : options.defaultDir) === "asc"
      ? 1
      : -1;
  return records
    .map((record) => ({ record, fields: fields(record) }))
    .filter(
      ({ fields }) =>
        !term ||
        fields.search.some((value) =>
          asText(value).toLowerCase().includes(term),
        ),
    )
    .sort(
      (left, right) =>
        (asText(left.fields[sortBy]).localeCompare(
          asText(right.fields[sortBy]),
          undefined,
          { sensitivity: "base" },
        ) || Number(left.record.id) - Number(right.record.id)) * direction,
    )
    .map(({ record }) => record);
}

/**
 * Convert model write conflicts and missing records into API errors.
 *
 * @param {{trainerConflict: (boolean|undefined), duplicate: (boolean|undefined), overlap: (boolean|undefined), affectedRows: (number|undefined)}} result Model write result.
 * @returns {void}
 * @throws {APIError} If the write conflicts or did not affect a record.
 */
function checkWrite(result) {
  if (result.trainerConflict) {
    throw new APIError(
      409,
      "This trainer already has a session at this date and time.",
    );
  }
  if (result.duplicate || result.overlap) {
    throw new APIError(
      409,
      "The member already has a booking for this session or start time.",
    );
  }
  if (!result.affectedRows) {
    throw new APIError(404, "Resource not found.");
  }
}

/**
 * Get public session records scheduled during the next seven days.
 *
 * @returns {Promise<object[]>} Upcoming sessions ordered by date and time.
 */
async function upcomingSessions() {
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
async function pastSessions() {
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
async function xmlLookups() {
  const [activities, locations, users] = await Promise.all([
    ActivitiesModel.getAll(),
    LocationModel.getAll(),
    UsersModel.getAll(),
  ]);
  return { activities, locations, users };
}

/**
 * Registers API routes for timetable browsing, resource CRUD, and XML exports.
 */
export class APIResourcesController {
  static routes = express.Router();

  static {
    this.routes.get(
      "/timetable",
      APIAuthenticationController.restrict(["member", "trainer"]),
      async (req, res) => {
        const sessions = (await upcomingSessions()).filter(
          (session) =>
            (!req.query.location_id ||
              Number(session.location_id) === Number(req.query.location_id)) &&
            (!req.query.trainer_id ||
              Number(session.trainer_id) === Number(req.query.trainer_id)),
        );
        res.json(await searchAndSort(timetable, sessions, req.query));
      },
    );

    this.routes.get(
      "/trainers",
      APIAuthenticationController.restrict(["member", "trainer"]),
      async (req, res) => {
        res.json(
          (await UsersModel.getAll())
            .filter((user) => user.role === "trainer")
            .map(({ id, first_name, last_name, role }) => ({
              id,
              first_name,
              last_name,
              role,
            })),
        );
      },
    );

    this.routes.get(
      "/bookings/export.xml",
      APIAuthenticationController.restrict(["member"]),
      async (req, res) => {
        const [sessions, bookings, lookups] = await Promise.all([
          pastSessions(),
          BookingsModel.getByUserId(req.authenticatedUser.id),
          xmlLookups(),
        ]);
        const sessionsById = new Map(
          sessions.map((session) => [Number(session.id), session]),
        );
        const sessionOrder = new Map(
          sessions.map((session, index) => [Number(session.id), index]),
        );
        const booking = bookings
          .filter((item) => sessionsById.has(Number(item.session_id)))
          .map(publicRecord)
          .sort(
            (a, b) =>
              sessionOrder.get(Number(a.session_id)) -
                sessionOrder.get(Number(b.session_id)) ||
              Number(a.id) - Number(b.id),
          )
          .map((item) =>
            bookingXmlRecord(
              item,
              sessionsById.get(Number(item.session_id)),
              lookups,
            ),
          );
        sendXmlDocument(
          res,
          "gym-bookings.xml",
          buildXmlDocument("gymBookings", { booking }, bookingsDtd),
        );
      },
    );

    this.routes.get(
      "/sessions/export.xml",
      APIAuthenticationController.restrict(["trainer"]),
      async (req, res) => {
        const [sessions, lookups] = await Promise.all([
          upcomingSessions(),
          xmlLookups(),
        ]);
        const session = sessions
          .filter(
            (item) =>
              Number(item.trainer_id) === Number(req.authenticatedUser.id),
          )
          .map((item) => sessionXmlRecord(item, lookups));
        sendXmlDocument(
          res,
          "gym-sessions.xml",
          buildXmlDocument("gymSessions", { session }, sessionsDtd),
        );
      },
    );

    for (const resource of resources) {
      const router = express.Router();
      const serialize = resource.serialize ?? publicRecord;
      const listSerialize = resource.listSerialize ?? serialize;
      const methodAccess = (req, res, next) => {
        const roles =
          resource[`${req.method.toLowerCase()}Roles`] ?? resource.roles;
        return APIAuthenticationController.restrict(roles)(req, res, next);
      };
      if (!resource.publicRead) {
        router.use(methodAccess);
      }
      if (resource.list !== false) {
        const listAccess = resource.publicRead
          ? []
          : [
              APIAuthenticationController.restrict(
                resource.listRoles ?? resource.getRoles ?? resource.roles,
              ),
            ];
        router.get("/", ...listAccess, async (req, res) => {
          let records;
          if (
            resource.path === "bookings" &&
            req.authenticatedUser.role === "trainer"
          ) {
            const [bookings, sessions] = await Promise.all([
              BookingsModel.getAll(),
              SessionsModel.getAll(),
            ]);
            const sessionIds = new Set(
              sessions
                .filter(
                  (session) =>
                    Number(session.trainer_id) ===
                    Number(req.authenticatedUser.id),
                )
                .map((session) => Number(session.id)),
            );
            records = bookings.filter((booking) =>
              sessionIds.has(Number(booking.session_id)),
            );
          } else if (resource.path === "blogs") {
            const [blogs, users] = await Promise.all([
              BlogModel.getAll(),
              UsersModel.getAll(),
            ]);
            const firstNames = new Map(
              users.map((user) => [Number(user.id), user.first_name]),
            );
            records = blogs.map((blog) => ({
              ...blog,
              first_name: firstNames.get(Number(blog.user_id)) ?? null,
            }));
          } else {
            records =
              resource.path === "bookings"
                ? await BookingsModel.getByUserId(req.authenticatedUser.id)
                : await resource.model.getAll();
          }
          res.json(
            (await searchAndSort(resource, records, req.query)).map(
              listSerialize,
            ),
          );
        });
      }
      if (!resource.removedMethods?.includes("get")) {
        router.get("/:id", async (req, res) => {
          const record = await activeRecord(
            resource.model,
            Number(req.params.id),
          );
          if (!resource.publicRead) {
            await authorizeRecord(resource, req.authenticatedUser, record);
          }
          res.json(serialize(record));
        });
      }
      if (resource.publicRead) {
        router.use(methodAccess);
      }
      if (!resource.removedMethods?.includes("post")) {
        router.post("/", async (req, res) => {
          const record = await prepareRecord(resource, req);
          const result = await resource.model.create(record);
          checkWrite(result);
          const created = await activeRecord(
            resource.model,
            Number(result.insertId),
          );
          res
            .location(`/api/v1/${resource.path}/${created.id}`)
            .status(201)
            .json(serialize(created));
        });
      }
      if (!resource.removedMethods?.includes("put")) {
        router.put("/:id", async (req, res) => {
          const existing = await activeRecord(
            resource.model,
            Number(req.params.id),
          );
          await authorizeRecord(resource, req.authenticatedUser, existing);
          const record = await prepareRecord(resource, req, existing);
          checkWrite(await resource.model.update(record));
          res.json(serialize(await activeRecord(resource.model, existing.id)));
        });
      }
      if (!resource.removedMethods?.includes("delete")) {
        router.delete("/:id", async (req, res) => {
          const record = await activeRecord(
            resource.model,
            Number(req.params.id),
          );
          await authorizeRecord(resource, req.authenticatedUser, record);
          if (resource.path === "sessions") {
            await BookingsModel.deleteBySessionId(record.id);
          }
          checkWrite(await resource.model.delete(record.id));
          res.json({ message: `${resource.schema} deleted.` });
        });
      }
      this.routes.use(`/${resource.path}`, router);
    }
  }
}
