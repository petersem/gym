import { ensureAdmin } from "../database/ensureAdmin.mjs";
import { UsersModel } from "../models/UsersModel.mjs";

try {
  await ensureAdmin(UsersModel.connection, process.env);
} finally {
  await UsersModel.connection.end();
}
