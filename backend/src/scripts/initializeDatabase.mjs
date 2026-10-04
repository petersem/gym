import { initializeDatabase } from "../database/initializeDatabase.mjs";

try {
  await initializeDatabase(process.env);
} catch (error) {
  console.error("Database initialization failed:", error.message);
  process.exitCode = 1;
}
