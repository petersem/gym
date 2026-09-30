import { afterAll, describe, expect, test } from "@jest/globals";
import { UsersModel } from "../../models/UsersModel.mjs";

let userId;

afterAll(async () => {
  await UsersModel.connection.end();
});

// Exercises user persistence and authentication lookup against the configured MySQL database.
describe("UsersModel end-to-end flow", () => {
  test("creates, reads, searches, updates, authenticates, and deletes a user", async () => {
    const email = `e2e-model-${Date.now()}@example.com`;
    const user = new UsersModel(
      null,
      "E2E",
      "Model User",
      "member",
      email,
      "hashed-password",
      "555-0188",
      "2000-01-01",
      0,
      "e2e-key",
    );

    try {
      const created = await UsersModel.create(user);
      userId = created.insertId;

      const saved = await UsersModel.getById(userId);
      expect(saved.email).toBe(email);
      expect(await UsersModel.getBySearch(email)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: userId, email }),
        ]),
      );
      expect((await UsersModel.getByUsername(email)).id).toBe(userId);

      saved.phone = "555-0189";
      await UsersModel.update(saved);
      expect((await UsersModel.getById(userId)).phone).toBe("555-0189");
    } finally {
      if (userId) {
        await UsersModel.delete(userId);
      }
    }

    await expect(UsersModel.getById(userId)).rejects.toBe("not found");
  });
});
