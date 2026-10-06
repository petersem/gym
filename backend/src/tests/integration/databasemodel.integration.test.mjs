import { afterAll, describe, expect, test } from "@jest/globals";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";
import { DatabaseModel } from "../../models/DatabaseModel.mjs";

afterAll(async () => {
  await DatabaseModel.connection.end();
});

// Requires a live MySQL service to verify the model's real query path.
describe("DatabaseModel database integration", () => {
  test("Integration test - executes a parameterized query against MySQL", async () => {
    const result = await DatabaseModel.query("SELECT ? AS value", [
      "integration-test",
    ]);

    expect(result).toHaveLength(1);
    expect(result[0][""].value).toBe("integration-test");
  });

  test("Integration test - creates, reads, and removes an activity", async () => {
    const name = `integration-test-${Date.now()}`;
    const description = "Activity created by the integration test";
    const result = await ActivitiesModel.create(
      new ActivitiesModel(null, name, description, 0, 2),
    );

    try {
      const activity = await ActivitiesModel.getById(result.insertId);

      expect(activity).toMatchObject({
        id: result.insertId,
        name,
        description,
      });
    } finally {
      await ActivitiesModel.delete(result.insertId);
    }
  });
});
