import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { ActivitiesController } from "../../controllers/ActivitiesController.mjs";
import { ActivitiesModel } from "../../models/ActivitiesModel.mjs";

const response = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
    render: jest.fn(),
    redirect: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

const request = (params = {}, query = {}, body = {}) => ({
  params,
  query,
  body,
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mocked model calls keep these response and routing tests independent of MySQL.
describe("ActivitiesController", () => {
  test("renders activity management and handles load errors", async () => {
    const activities = [{ id: 1 }];
    jest
      .spyOn(ActivitiesModel, "list")
      .mockResolvedValue({ activities, total: 1 });
    const res = response();

    await ActivitiesController.viewActivityManagement(
      request({ id: "1" }),
      res,
    );
    expect(res.render).toHaveBeenCalledWith(
      "activity_management.ejs",
      expect.objectContaining({ activities }),
    );

    const getById = jest
      .spyOn(ActivitiesModel, "getById")
      .mockRejectedValueOnce("not found")
      .mockResolvedValueOnce({ id: 20, name: "Page two" });
    await ActivitiesController.viewActivityManagement(
      request({ id: "999" }),
      res,
    );
    expect(res.render).toHaveBeenCalledWith(
      "activity_management.ejs",
      expect.objectContaining({
        selectedActivity: expect.objectContaining({ id: null }),
      }),
    );

    await ActivitiesController.viewActivityManagement(
      request({ id: "20" }),
      res,
    );
    expect(getById).toHaveBeenLastCalledWith("20");
    expect(res.render).toHaveBeenLastCalledWith(
      "activity_management.ejs",
      expect.objectContaining({
        selectedActivity: { id: 20, name: "Page two" },
      }),
    );

    ActivitiesModel.list.mockRejectedValue(new Error("database error"));
    await ActivitiesController.viewActivityManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("handles activity management actions and failures", async () => {
    const res = response();
    jest.spyOn(ActivitiesModel, "create").mockResolvedValue({});
    jest
      .spyOn(ActivitiesModel, "update")
      .mockResolvedValue({ affectedRows: 1 });
    jest
      .spyOn(ActivitiesModel, "delete")
      .mockResolvedValue({ affectedRows: 1 });

    await ActivitiesController.handleActivityManagement(
      request({}, {}, { action: "create", name: "Yoga" }),
      res,
    );
    await ActivitiesController.handleActivityManagement(
      request({ id: "2" }, {}, { action: "update", name: "Pilates" }),
      res,
    );
    await ActivitiesController.handleActivityManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith("/activities");

    ActivitiesModel.update.mockResolvedValue({ affectedRows: 0 });
    await ActivitiesController.handleActivityManagement(
      request({ id: "2" }, {}, { action: "update" }),
      res,
    );
    ActivitiesModel.delete.mockResolvedValue({ affectedRows: 0 });
    await ActivitiesController.handleActivityManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );
    await ActivitiesController.handleActivityManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).toHaveBeenCalledWith(400);

    ActivitiesModel.create.mockRejectedValue(new Error("database error"));
    await ActivitiesController.handleActivityManagement(
      request({}, {}, { action: "create" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
