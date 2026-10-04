import { readFileSync } from "node:fs";
import { afterEach, describe, expect, jest, test } from "@jest/globals";

const originalArgv = process.argv;
const originalMode = process.env.NODE_ENV;
const started = jest.fn();
jest.unstable_mockModule("../server.mjs", () => {
  started(process.env.NODE_ENV);
  return {};
});

afterEach(() => {
  process.argv = originalArgv;
  if (originalMode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalMode;
  started.mockClear();
  jest.resetModules();
});

describe("shared backend environment", () => {
  test.each(["development", "production"])(
    "starts the server in %s mode",
    async (mode) => {
      process.argv = ["node", "startServer.mjs", mode];
      process.env.NODE_ENV = "previous-mode";
      await import("../scripts/startServer.mjs");
      expect(started).toHaveBeenCalledWith(mode);
    },
  );

  test.each([undefined, "invalid"])(
    "rejects invalid mode %s without starting the server",
    async (mode) => {
      process.argv = ["node", "startServer.mjs"];
      if (mode !== undefined) process.argv.push(mode);
      await expect(import("../scripts/startServer.mjs")).rejects.toThrow(
        "Server mode must be development or production.",
      );
      expect(started).not.toHaveBeenCalled();
    },
  );

  test("uses the same environment file for all backend Node commands", () => {
    const { scripts } = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    );
    for (const name of ["dev", "prod", "dbcreate"]) {
      expect(scripts[name]).toContain("--env-file=.env");
      expect(scripts[name]).not.toContain("src/.env");
    }
    expect(scripts.dev).toContain("startServer.mjs development");
    expect(scripts.prod).toContain("startServer.mjs production");
    expect(scripts.dev).toContain("--watch .env");
  });
});
