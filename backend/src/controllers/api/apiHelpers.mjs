import validator from "validator";
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

/**
 * Validate user details that the OpenAPI schema cannot fully express.
 *
 * @param {Object} user User details to check.
 * @param {string} user.phone Phone number.
 * @param {?string} [user.dob] Date of birth (YYYY-MM-DD) or null.
 * @param {string} [user.password] Plain-text password, when one is being set.
 * @throws {APIError} 400 when the phone, date of birth or password is invalid.
 */
export function validateUserDetails(user) {
  if (
    !/^(?:0[23478]\d{8}|\+61[23478]\d{8}|13\d{4}|(?:1300|1800)\d{6})$/.test(
      user.phone.replace(/[ ().-]/g, ""),
    )
  ) {
    throw new APIError(400, "Phone must be a valid Australian phone number.");
  }
  if (
    user.dob != null &&
    !validator.isISO8601(user.dob, { strict: true, strictSeparator: true })
  ) {
    throw new APIError(400, "Date of birth must be a real calendar date.");
  }
  if (
    user.password !== undefined &&
    Buffer.byteLength(user.password, "utf8") > 36
  ) {
    throw new APIError(400, "Password must be at most 36 UTF-8 bytes.");
  }
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
