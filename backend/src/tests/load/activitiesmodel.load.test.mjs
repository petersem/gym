import { afterAll, describe, expect, test } from "@jest/globals";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const requestCount = 25;
const createdIds = [];

afterAll(async () => {
  await Promise.all(createdIds.map((id) => ActivitiesModel.delete(id)));
  await ActivitiesModel.query("DELETE FROM activities WHERE name LIKE ?", [
    "Load Activity %",
  ]);
  await ActivitiesModel.connection.end();
});

describe("ActivitiesModel load test", () => {
  test(`handles ${requestCount} concurrent activity lifecycles`, async () => {
    const owner = (await UsersModel.getAll())[0];
    const created = await Promise.all(
      Array.from({ length: requestCount }, (_, index) => {
        const activity = new ActivitiesModel(
          null,
          `Load Activity ${Date.now()}-${index}`,
          "Load description",
          0,
          owner.id,
        );
        return ActivitiesModel.create(activity);
      }),
    );
    createdIds.push(...created.map(({ insertId }) => insertId));

    const loaded = await Promise.all(
      createdIds.map((id) => ActivitiesModel.getById(id)),
    );
    expect(loaded).toHaveLength(requestCount);

    await Promise.all(
      loaded.map((activity) =>
        ActivitiesModel.update({
          ...activity,
          description: "Updated load description",
        }),
      ),
    );
    expect(
      (
        await Promise.all(createdIds.map((id) => ActivitiesModel.getById(id)))
      ).every(
        (activity) => activity.description === "Updated load description",
      ),
    ).toBe(true);

    await Promise.all(createdIds.map((id) => ActivitiesModel.delete(id)));
    for (const id of createdIds) {
      await expect(ActivitiesModel.getById(id)).rejects.toBe("not found");
    }
    createdIds.length = 0;
  });
});
