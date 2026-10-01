import { afterAll, describe, expect, test } from "@jest/globals";
import { UsersModel } from "../../models/UsersModel.mjs";

const requestCount = 25;
const createdIds = [];

afterAll(async () => {
  await Promise.all(createdIds.map((id) => UsersModel.delete(id)));
  await UsersModel.query("DELETE FROM users WHERE email LIKE ?", [
    "model-load-%",
  ]);
  await UsersModel.connection.end();
});

// Runs concurrent user lifecycles against MySQL and removes generated users.
describe("UsersModel load test", () => {
  test(`handles ${requestCount} concurrent user lifecycles`, async () => {
    const created = await Promise.all(
      Array.from({ length: requestCount }, (_, index) =>
        UsersModel.create(
          new UsersModel(
            null,
            "Load",
            `User ${index}`,
            "member",
            `model-load-${Date.now()}-${index}@example.com`,
            "hashed-password",
            "555-0180",
            "2000-01-01",
            0,
            `load-key-${index}`,
          ),
        ),
      ),
    );
    createdIds.push(...created.map(({ insertId }) => insertId));

    const loaded = await Promise.all(
      createdIds.map((id) => UsersModel.getById(id)),
    );
    expect(loaded).toHaveLength(requestCount);
    await Promise.all(
      loaded.map((user) => UsersModel.update({ ...user, phone: "555-0181" })),
    );
    expect(
      (await Promise.all(createdIds.map((id) => UsersModel.getById(id)))).every(
        (user) => user.phone === "555-0181",
      ),
    ).toBe(true);

    await Promise.all(createdIds.map((id) => UsersModel.delete(id)));
    for (const id of createdIds) {
      await expect(UsersModel.getById(id)).resolves.toMatchObject({
        id,
        deleted: 1,
      });
    }
    createdIds.length = 0;
  });
});
