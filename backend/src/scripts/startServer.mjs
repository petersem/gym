const mode = process.argv[2];
if (!["development", "production"].includes(mode)) {
  throw new Error("Server mode must be development or production.");
}
process.env.NODE_ENV = mode;
await import("../server.mjs");
