import express from "express";
import { APIAuthenticationController } from "./APIAuthenticationController.mjs";
import { APIError, activeRecord, publicRecord } from "./apiHelpers.mjs";

/**
 * Build an OpenAPI response object that returns JSON.
 *
 * @param {object} schema OpenAPI schema for the response body.
 * @param {string} description Response description.
 * @returns {object} OpenAPI response object.
 */
export const response = (schema, description) => ({
  description,
  content: { "application/json": { schema } },
});

/**
 * Build an OpenAPI reference to a named component schema.
 *
 * @param {string} name Component schema name.
 * @returns {{$ref: string}}
 */
export const ref = (name) => ({ $ref: `#/components/schemas/${name}` });

const errorResponseNames = {
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  413: "PayloadTooLarge",
  415: "UnsupportedMediaType",
  500: "InternalServerError",
  503: "ServiceUnavailable",
};

/**
 * Build references to the shared OpenAPI error responses.
 *
 * @param {...number} statuses HTTP error status codes.
 * @returns {Record<number, {$ref: string}>}
 */
export const errorResponses = (...statuses) =>
  Object.fromEntries(
    statuses.map((status) => [
      status,
      {
        $ref: `#/components/responses/${errorResponseNames[status]}`,
      },
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
 * Create query parameter definitions for a searchable and sortable collection.
 *
 * @param {{searchDescription: string, sorts: string[], defaultSort: string, defaultDir: string}} options
 * @returns {object[]} OpenAPI query parameter definitions.
 */
export function queryParameters(options) {
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
export const xmlExportPath = ({
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
      ...errorResponses(400, 401, 403, 500, 503),
    },
  },
});

/**
 * Convert values to comparable text, including dates and nullish values.
 *
 * @param {*} value Value to convert.
 * @returns {string}
 */
const asText = (value) =>
  value instanceof Date ? value.toISOString() : String(value ?? "");

/**
 * Filter and sort records according to the query options of a resource.
 *
 * @param {{query?: object, fields?: function(): Promise<function(object): object>}} resource Resource configuration. `fields` resolves a function mapping a record to its searchable (`search`) and sortable values.
 * @param {object[]} records Records to filter and sort.
 * @param {object} query Request query parameters.
 * @returns {Promise<object[]>} Filtered and sorted records.
 */
export async function searchAndSort(resource, records, query) {
  const options = resource.query;
  const term = String(query.search_term ?? "")
    .trim()
    .toLowerCase();
  if (!options || (!term && !query.sort_by && !query.sort_dir)) {
    return records;
  }
  const fields = await resource.fields();
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
export function checkWrite(result) {
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
 * Build the OpenAPI path items for a CRUD resource.
 *
 * @param {object} resource Resource configuration.
 * @returns {Record<string, object>} OpenAPI paths keyed by path.
 */
export function buildResourcePaths(resource) {
  const paths = {};
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
      ...errorResponses(
        400,
        401,
        403,
        ...(method !== "list" &&
        !(resource.path === "bookings" && method === "update")
          ? [404]
          : []),
        ...(["create", "update", "patch"].includes(method) ? [413, 415] : []),
        500,
        503,
      ),
      ...(resource.conflicts?.[method]
        ? {
            409: {
              $ref: `#/components/responses/${resource.conflicts[method]}`,
            },
          }
        : {}),
    },
  });
  const body = (schema) => ({
    required: true,
    content: { "application/json": { schema: ref(schema) } },
  });
  paths[basePath] = {
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
  paths[`${basePath}/{id}`] = {
    parameters: [idParameter],
    put: {
      ...operation(
        "update",
        `Update ${resource.schema.toLowerCase()}`,
        ref(resource.schema),
      ),
      requestBody: body(`${resource.schema}Update`),
    },
    ...(resource.patchRoles
      ? {
          patch: {
            ...operation("patch", "Partially update user", ref("User")),
            requestBody: body("UserPatch"),
          },
        }
      : {}),
    delete: operation(
      "delete",
      `Delete ${resource.schema.toLowerCase()}`,
      ref("Message"),
    ),
  };
  for (const method of resource.removedMethods ?? []) {
    delete paths[method === "post" ? basePath : `${basePath}/{id}`][method];
  }
  if (resource.list === false) {
    delete paths[basePath].get;
    if (Object.keys(paths[basePath]).length === 0) {
      delete paths[basePath];
    }
  }
  return paths;
}

/**
 * Create the Express router for a CRUD resource.
 *
 * Optional resource hooks customise behaviour: `loadList(req)` returns the
 * records to list, `authorize(user, record)` enforces record ownership,
 * `prepare(req, existing)` validates and completes a record before a write,
 * and `beforeDelete(record)` runs cleanup before a delete.
 *
 * @param {object} resource Resource configuration.
 * @returns {express.Router} Router to mount at `/${resource.path}`.
 */
export function createResourceRouter(resource) {
  const router = express.Router();
  const serialize = resource.serialize ?? publicRecord;
  const listSerialize = resource.listSerialize ?? serialize;
  const authorize = async (user, record) => {
    await resource.authorize?.(user, record);
  };
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
      const records = resource.loadList
        ? await resource.loadList(req)
        : await resource.model.getAll();
      res.json(
        (await searchAndSort(resource, records, req.query)).map(listSerialize),
      );
    });
  }
  if (!resource.removedMethods?.includes("get")) {
    router.get("/:id", async (req, res) => {
      const record = await activeRecord(resource.model, Number(req.params.id));
      if (!resource.publicRead) {
        await authorize(req.authenticatedUser, record);
      }
      res.json(serialize(record));
    });
  }
  if (resource.publicRead) {
    router.use(methodAccess);
  }
  if (!resource.removedMethods?.includes("post")) {
    router.post("/", async (req, res) => {
      const record = await resource.prepare(req);
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
    const update = async (req, res) => {
      const existing = await activeRecord(
        resource.model,
        Number(req.params.id),
      );
      await authorize(req.authenticatedUser, existing);
      const record = await resource.prepare(req, existing);
      checkWrite(await resource.model.update(record));
      res.json(serialize(await activeRecord(resource.model, existing.id)));
    };
    router.put("/:id", update);
    if (resource.patchRoles) {
      router.patch("/:id", update);
    }
  }
  if (!resource.removedMethods?.includes("delete")) {
    router.delete("/:id", async (req, res) => {
      const record = await activeRecord(resource.model, Number(req.params.id));
      await authorize(req.authenticatedUser, record);
      await resource.beforeDelete?.(record);
      checkWrite(await resource.model.delete(record.id));
      res.json({ message: `${resource.schema} deleted.` });
    });
  }
  return router;
}
