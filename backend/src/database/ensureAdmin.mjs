import bcrypt from "bcrypt";
import { logInfo, logWarning } from "../utilities/logger.mjs";

export async function ensureAdmin(connection, env) {
  const [admins] = await connection.query(
    "SELECT id FROM users WHERE role = 'admin' AND deleted = 0 LIMIT 1",
  );
  if (admins.length > 0) {
    console.log(
      logWarning,
      `${env.ADMIN_EMAIL} account already exists, or an admin another admiin account is present. Will not be recreated`,
    );
    return;
  }
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD are required to create the first admin.",
    );
  }
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
  await connection.query(
    `INSERT INTO users (first_name, last_name, role, email, password, phone)
     VALUES (?, ?, 'admin', ?, ?, '18675309')`,
    ["Gym", "Admin", env.ADMIN_EMAIL, passwordHash],
  );
  console.log(
    logInfo,
    `${env.ADMIN_EMAIL} user account created. Password is ${env.ADMIN_PASSWORD}. Change its password after login.`,
  );
}
