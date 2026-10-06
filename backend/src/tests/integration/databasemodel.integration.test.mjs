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

  test("Integration test - returns an activity from MySQL", async () => {
    const activity = await ActivitiesModel.getById(1);

    expect(activity).toMatchObject({ id: 1, name: "Cardio" });
  });
});
