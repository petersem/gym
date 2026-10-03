import { afterAll, describe, expect, test } from "@jest/globals";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const owner = async () => (await UsersModel.getAll())[0];
let activityId;

afterAll(async () => {
  await ActivitiesModel.query(
    "DELETE FROM activities WHERE id = ? OR name LIKE ?",
    [activityId ?? 0, "E2E Activity %"],
  );
  await ActivitiesModel.connection.end();
});

// Exercises real MySQL persistence and removes each activity created by the test.
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
    try {
      const created = await ActivitiesModel.create(activity);
      activityId = created.insertId;

      const saved = await ActivitiesModel.getById(activityId);
      expect(saved.name).toBe(activity.name);
      expect(await ActivitiesModel.getBySearch(activity.name)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: activityId, name: activity.name }),
        ]),
      );

      saved.description = "Updated description";
      await ActivitiesModel.update(saved);
      expect((await ActivitiesModel.getById(activityId)).description).toBe(
        "Updated description",
      );
    } finally {
      if (activityId) {
        await ActivitiesModel.delete(activityId);
      }
    }

    await expect(ActivitiesModel.getById(activityId)).resolves.toMatchObject({
      id: activityId,
      deleted: 1,
    });
  });
});
