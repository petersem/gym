import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { LocationController } from "../../controllers/LocationController.mjs";
import { LocationModel } from "../../models/LocationModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

const response = () => ({
  render: jest.fn(),
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

const request = (query = {}, params = {}) => ({
  query,
  params,
  authenticatedUser: { id: 1 },
});
const managementRequest = (params, body, authenticatedUser = { id: 1 }) => ({
  params,
  body,
  authenticatedUser,
});
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  jest.restoreAllMocks();
});

// Mocked model calls keep location handler behavior independent of MySQL.
describe("LocationController", () => {
  test("renders location management and selected location", async () => {
    const locations = [{ id: 1, name: "Central Gym", postcode: 3000 }];
    const users = [{ id: 1, first_name: "Fred", last_name: "Nerk" }];
    jest
      .spyOn(LocationModel, "list")
      .mockResolvedValue({ locations, total: 1 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue(users);
    const res = response();

    LocationController.viewLocationManagement(request({}, { id: "1" }), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith(
      "location_management.ejs",
      expect.objectContaining({
        locations,
        users,
        selectedLocation: locations[0],
        authenticatedUser: { id: 1 },
        role: "admin",
      }),
    );
  });

  test("handles location management actions and failures", async () => {
    const res = response();
    const locationData = {
      action: "create",
      name: "Central Gym",
      phone: "555-0100",
      email: "central@example.com",
      street: "1 Main Street",
      suburb: "Brisbane",
      postcode: "4000",
      manager: "1",
      updatedBy: "1",
    };
    jest.spyOn(LocationModel, "create").mockResolvedValue({ insertId: 1 });
    jest.spyOn(LocationModel, "update").mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(LocationModel, "delete").mockResolvedValue({ affectedRows: 1 });

    LocationController.handleLocationManagement(
      managementRequest({}, locationData),
      res,
    );
    await flushPromises();
    expect(LocationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        manager: 1,
        updated_by: 1,
      }),
    );
    LocationController.handleLocationManagement(
      managementRequest({ id: "1" }, { ...locationData, action: "update" }),
      res,
    );
    await flushPromises();
    LocationController.handleLocationManagement(
      managementRequest({ id: "1" }, { ...locationData, action: "delete" }),
      res,
    );
    await flushPromises();
    expect(res.redirect).toHaveBeenCalledWith(303, "/locations");

    LocationModel.update.mockResolvedValue({ affectedRows: 0 });
    LocationController.handleLocationManagement(
      managementRequest({ id: "1" }, { ...locationData, action: "update" }),
      res,
    );
    await flushPromises();
    LocationModel.delete.mockResolvedValue({ affectedRows: 0 });
    LocationController.handleLocationManagement(
      managementRequest({ id: "1" }, { ...locationData, action: "delete" }),
      res,
    );
    await flushPromises();
    LocationController.handleLocationManagement(
      managementRequest({}, { action: "unknown" }),
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(303, "/locations");
    expect(res.status).toHaveBeenCalledWith(400);

    LocationModel.create.mockRejectedValue(new Error("database error"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    LocationController.handleLocationManagement(
      managementRequest({}, locationData),
      res,
    );
    await flushPromises();
    expect(res.status).toHaveBeenCalledWith(500);

    LocationModel.update.mockRejectedValue(new Error("database error"));
    LocationController.handleLocationManagement(
      managementRequest({ id: "1" }, { ...locationData, action: "update" }),
      res,
    );
    await flushPromises();
    LocationModel.delete.mockRejectedValue(new Error("database error"));
    LocationController.handleLocationManagement(
      managementRequest({ id: "1" }, { ...locationData, action: "delete" }),
      res,
    );
    await flushPromises();
  });
});
