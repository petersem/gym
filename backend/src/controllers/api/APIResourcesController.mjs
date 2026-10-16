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
  APIError,
  activeRecord,
  publicRecord,
  publicUser,
} from "./apiHelpers.mjs";

const resources = [
  {
    path: "users",
    schema: "User",
    tag: "Users",
    model: UsersModel,
    roles: ["admin"],
    description:
      "Administrators only. Passwords and authentication keys are never returned.",
    serialize: publicUser,
  },
  {
    path: "activities",
    schema: "Activity",
    tag: "Activities",
    model: ActivitiesModel,
    roles: ["admin"],
    description: "Administrators only. Deletion soft-deletes the activity.",
  },
  {
    path: "locations",
    schema: "Location",
    tag: "Locations",
    model: LocationModel,
    roles: ["admin"],
    description: "Administrators only. Deletion soft-deletes the location.",
  },
  {
    path: "sessions",
    schema: "Session",
    tag: "Sessions",
    model: SessionsModel,
    roles: ["admin", "trainer"],
    description:
      "Administrators manage all sessions; trainers can only access and manage their own. Deleting a session also removes its bookings. Guests and members browse /api/v1/timetable instead.",
  },
  {
    path: "bookings",
    schema: "Booking",
    tag: "Bookings",
    model: BookingsModel,
    roles: ["admin", "member"],
    description:
      "Administrators manage all bookings; members can only access and manage their own. Trainers cannot access booking management. Duplicate and overlapping bookings return 409.",
  },
  {
    path: "blogs",
    schema: "Blog",
    tag: "Blogs",
    model: BlogModel,
    roles: "any",
    publicRead: true,
    description:
      "Anyone can read posts. Authenticated users create posts as themselves and edit or delete their own; administrators can edit or delete any post. Authors and creation timestamps are immutable.",
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

export const apiResourcePaths = {};
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
    get: operation("list", `List ${resource.path}`, {
      type: "array",
      items: ref(resource.schema),
    }),
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
}

apiResourcePaths["/api/v1/timetable"] = {
  get: {
    tags: ["Sessions"],
    operationId: "getTimetable",
    summary: "Browse the next seven days of sessions",
    description:
      "Public for guests and members, matching the app timetable. Administrators and trainers use /api/v1/sessions.",
    security: [],
    parameters: ["location_id", "trainer_id"].map((name) => ({
      name,
      in: "query",
      schema: { type: "integer", minimum: 1, maximum: 2147483647 },
      description: `Filter by ${name.replace("_id", "")}.`,
    })),
    responses: {
      200: response(
        { type: "array", items: ref("Session") },
        "Upcoming sessions ordered by date and time.",
      ),
      ...errorResponses,
    },
  },
};

function authorizeRecord(resource, user, record) {
  if (user?.role === "admin") {
    return;
  }
  const ownerField = resource.path === "sessions" ? "trainer_id" : "user_id";
  if (
    ["sessions", "bookings", "blogs"].includes(resource.path) &&
    Number(record[ownerField]) !== Number(user?.id)
  ) {
    throw new APIError(403, "You can only manage your own records.");
  }
}

async function prepareRecord(resource, req, existing) {
  const user = req.authenticatedUser;
  const record = { ...existing, ...req.body, id: existing?.id ?? null };
  switch (resource.path) {
    case "users":
      if (
        !/^(?:0[23478]\d{8}|\+61[23478]\d{8}|13\d{4}|(?:1300|1800)\d{6})$/.test(
          record.phone.replace(/[ ().-]/g, ""),
        )
      ) {
        throw new APIError(
          400,
          "Phone must be a valid Australian phone number.",
        );
      }
      if (
        record.dob != null &&
        !validator.isISO8601(record.dob, {
          strict: true,
          strictSeparator: true,
        })
      ) {
        throw new APIError(400, "Date of birth must be a real calendar date.");
      }
      if (req.body.password !== undefined) {
        if (Buffer.byteLength(req.body.password, "utf8") > 36) {
          throw new APIError(400, "Password must be at most 36 UTF-8 bytes.");
        }
        record.password = await bcrypt.hash(req.body.password, 10);
        record.authentication_key = null;
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
      if (
        user.role === "trainer" &&
        Number(record.trainer_id) !== Number(user.id)
      ) {
        throw new APIError(
          403,
          "Trainers can only schedule their own sessions.",
        );
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

export class APIResourcesController {
  static routes = express.Router();

  static {
    this.routes.get("/timetable", async (req, res) => {
      if (["admin", "trainer"].includes(req.authenticatedUser?.role)) {
        throw new APIError(
          403,
          "Staff use /api/v1/sessions instead of the timetable.",
        );
      }
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      const startDate = DatabaseModel.toMySqlDate(today);
      const endDate = DatabaseModel.toMySqlDate(end);
      const sessions = (await SessionsModel.getAll())
        .map(publicRecord)
        .filter(
          (session) =>
            session.date >= startDate &&
            session.date < endDate &&
            (!req.query.location_id ||
              Number(session.location_id) === Number(req.query.location_id)) &&
            (!req.query.trainer_id ||
              Number(session.trainer_id) === Number(req.query.trainer_id)),
        )
        .sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
        );
      res.json(sessions);
    });

    for (const resource of resources) {
      const router = express.Router();
      const serialize = resource.serialize ?? publicRecord;
      if (!resource.publicRead) {
        router.use(APIAuthenticationController.restrict(resource.roles));
      }
      router.get("/", async (req, res) => {
        let records =
          resource.path === "bookings" &&
          req.authenticatedUser.role === "member"
            ? await BookingsModel.getByUserId(req.authenticatedUser.id)
            : await resource.model.getAll();
        if (
          resource.path === "sessions" &&
          req.authenticatedUser.role === "trainer"
        ) {
          records = records.filter(
            (record) =>
              Number(record.trainer_id) === Number(req.authenticatedUser.id),
          );
        }
        res.json(records.map(serialize));
      });
      router.get("/:id", async (req, res) => {
        const record = await activeRecord(
          resource.model,
          Number(req.params.id),
        );
        if (!resource.publicRead) {
          authorizeRecord(resource, req.authenticatedUser, record);
        }
        res.json(serialize(record));
      });
      if (resource.publicRead) {
        router.use(APIAuthenticationController.restrict("any"));
      }
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
      router.put("/:id", async (req, res) => {
        const existing = await activeRecord(
          resource.model,
          Number(req.params.id),
        );
        authorizeRecord(resource, req.authenticatedUser, existing);
        const record = await prepareRecord(resource, req, existing);
        checkWrite(await resource.model.update(record));
        res.json(serialize(await activeRecord(resource.model, existing.id)));
      });
      router.delete("/:id", async (req, res) => {
        const record = await activeRecord(
          resource.model,
          Number(req.params.id),
        );
        authorizeRecord(resource, req.authenticatedUser, record);
        if (resource.path === "sessions") {
          await BookingsModel.deleteBySessionId(record.id);
        }
        checkWrite(await resource.model.delete(record.id));
        res.json({ message: `${resource.schema} deleted.` });
      });
      this.routes.use(`/${resource.path}`, router);
    }
  }
}
