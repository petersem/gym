import { DatabaseModel } from "../../models/DatabaseModel.mjs";

export class APIError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function activeRecord(model, id) {
  try {
    const record = await model.getById(id);
    if (Number(record.deleted) === 1) {
      throw new APIError(404, "Resource not found.");
    }
    return record;
  } catch (error) {
    if (error === "not found") {
      throw new APIError(404, "Resource not found.");
    }
    throw error;
  }
}

export function publicUser(user) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    email: user.email,
    phone: user.phone,
    dob:
      user.dob instanceof Date
        ? DatabaseModel.toMySqlDate(user.dob)
        : user.dob || null,
  };
}

export function publicRecord(record) {
  const result = { ...record };
  if (record.date instanceof Date) {
    result.date = DatabaseModel.toMySqlDate(record.date);
  }
  if (record.created) {
    result.created = new Date(record.created).toISOString();
  }
  return result;
}

export function apiErrorHandler(error, _req, res, next) {
  if (res.headersSent) {
    return next(error);
  }
  let status = error.status || 500;
  let message = error.message || "Request failed.";
  if (error === "not found") {
    status = 404;
    message = "Resource not found.";
  } else if (error.code === "ER_DUP_ENTRY") {
    status = 409;
    message = "A record with these details already exists.";
  } else if (
    ["ER_NO_REFERENCED_ROW_2", "ER_ROW_IS_REFERENCED_2"].includes(error.code)
  ) {
    status = 409;
    message = "The operation conflicts with related records.";
  }
  if (status >= 500) {
    console.error(error);
    message = "Unable to process the API request.";
  }
  res.status(status).json({
    message,
    ...(status < 500 && error.errors ? { errors: error.errors } : {}),
  });
}
