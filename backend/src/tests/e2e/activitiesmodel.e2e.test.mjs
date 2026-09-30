import { afterAll, describe, expect, test } from "@jest/globals";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const owner = async () => (await UsersModel.getAll())[0];

afterAll(async () => {
  await ActivitiesModel.connection.end();
});

describe("ActivitiesModel end-to-end flow", () => {
  test("creates, reads, searches, updates, and deletes an activity", async () => {
    const user = await owner();
    const activity = new ActivitiesModel(
      null,
      `E2E Activity ${Date.now()}`,
      "E2E description",
      0,
      user.id,
    );
    let id;

    try {
      const created = await ActivitiesModel.create(activity);
      id = created.insertId;

      const saved = await ActivitiesModel.getById(id);
      expect(saved.name).toBe(activity.name);
      expect(await ActivitiesModel.getBySearch(activity.name)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id, name: activity.name }),
        ]),
      );

      saved.description = "Updated description";
      await ActivitiesModel.update(saved);
      expect((await ActivitiesModel.getById(id)).description).toBe(
        "Updated description",
      );
    } finally {
      if (id) {
        await ActivitiesModel.delete(id);
      }
    }

    await expect(ActivitiesModel.getById(id)).rejects.toBe("not found");
  });
});
