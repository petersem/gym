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

  test("loads an off-page location and reports when it is missing", async () => {
    const location = { id: 9, name: "North Gym", postcode: 3001 };
    jest
      .spyOn(LocationModel, "list")
      .mockResolvedValue({ locations: [], total: 0 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const getById = jest
      .spyOn(LocationModel, "getById")
      .mockResolvedValueOnce(location)
      .mockRejectedValueOnce("not found");
    const res = response();

    LocationController.viewLocationManagement(request({}, { id: "9" }), res);
    await flushPromises();
    LocationController.viewLocationManagement(request({}, { id: "999" }), res);
    await flushPromises();

    expect(getById).toHaveBeenCalledWith("9");
    expect(res.render.mock.calls[0][1].selectedLocation).toBe(location);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render.mock.calls[1]).toEqual([
      "status.ejs",
      {
        status: "Location not found",
        message: "The requested location does not exist. Please check the URL.",
      },
    ]);
  });

  test.each(["sales", "abc", "0", "-1", "1.5", "2147483648"])(
    "rejects invalid location ID %s before querying the database",
    (id) => {
      const list = jest.spyOn(LocationModel, "list");
      const getById = jest.spyOn(LocationModel, "getById");
      const res = response();

      LocationController.viewLocationManagement(request({}, { id }), res);

      expect(list).not.toHaveBeenCalled();
      expect(getById).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.render).toHaveBeenCalledWith(
        "status.ejs",
        expect.objectContaining({ status: "Location not found" }),
      );
    },
  );

  test("reports database errors from an off-page location lookup", async () => {
    jest
      .spyOn(LocationModel, "list")
      .mockResolvedValue({ locations: [], total: 0 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const error = new Error("database unavailable");
    jest.spyOn(LocationModel, "getById").mockRejectedValue(error);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    const res = response();

    LocationController.viewLocationManagement(request({}, { id: "9" }), res);
    await flushPromises();

    expect(log).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.render).toHaveBeenCalledWith("status.ejs", {
      status: "Database Error",
      message: "Locations could not be loaded.",
    });
  });

  test("uses selected location sort options in management and list views", async () => {
    const list = jest
      .spyOn(LocationModel, "list")
      .mockResolvedValue({ locations: [], total: 0 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const res = response();

    LocationController.viewLocationManagement(
      {
        params: {},
        query: { sort_by: "suburb", sort_dir: "desc" },
        authenticatedUser: { id: 1 },
      },
      res,
    );
    await flushPromises();
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: "suburb", sortDir: "desc" }),
    );

    LocationController.viewLocationList(
      {
        params: {},
        query: { sort_by: "postcode", sort_dir: "desc" },
        authenticatedUser: { id: 1 },
      },
      res,
    );
    await flushPromises();
    expect(list).toHaveBeenLastCalledWith({
      searchTerm: "",
      sortBy: "postcode",
      sortDir: "desc",
    });
  });

  test("renders an empty location and logs management errors", async () => {
    jest
      .spyOn(LocationModel, "list")
      .mockResolvedValue({ locations: [], total: 0 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const res = response();

    LocationController.viewLocationManagement(request(), res);
    await flushPromises();
    expect(res.render).toHaveBeenCalledWith(
      "location_management.ejs",
      expect.objectContaining({
        selectedLocation: expect.objectContaining({ id: null, postcode: "" }),
      }),
    );

    const error = new Error("database error");
    LocationModel.list.mockRejectedValue(error);
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    LocationController.viewLocationManagement(request(), res);
    await flushPromises();
    expect(log).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("renders management without an authenticated user", async () => {
    jest
      .spyOn(LocationModel, "list")
      .mockResolvedValue({ locations: [], total: 0 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const res = response();

    LocationController.viewLocationManagement(
      { params: {}, query: {}, authenticatedUser: undefined },
      res,
    );
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith(
      "location_management.ejs",
      expect.objectContaining({
        authenticatedUser: {},
      }),
    );
  });

  test("renders all locations", async () => {
    const locations = [{ id: 1 }];
    jest.spyOn(LocationModel, "getAll").mockResolvedValue(locations);
    const res = response();

    LocationController.viewLocationList(request(), res);
    await flushPromises();

    expect(res.render).toHaveBeenCalledWith(
      "location_list.ejs",
      expect.objectContaining({
        locations,
        authenticatedUser: { id: 1 },
        role: "",
      }),
    );
  });

  test("renders searched locations", async () => {
    const locations = [{ id: 2 }];
    const search = jest
      .spyOn(LocationModel, "getBySearch")
      .mockResolvedValue(locations);
    const res = response();

    LocationController.viewLocationList(
      request({ search_term: "Central" }),
      res,
    );
    await flushPromises();

    expect(search).toHaveBeenCalledWith("Central");
    expect(res.render).toHaveBeenCalledWith(
      "location_list.ejs",
      expect.objectContaining({ locations, role: "" }),
    );
  });

  test("logs location list errors", async () => {
    const error = new Error("database error");
    jest.spyOn(LocationModel, "getAll").mockRejectedValue(error);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = response();

    LocationController.viewLocationList(request(), res);
    await flushPromises();

    expect(log).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("logs searched-location errors", async () => {
    const error = new Error("database error");
    jest.spyOn(LocationModel, "getBySearch").mockRejectedValue(error);
    const log = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = response();
    LocationController.viewLocationList(
      request({ search_term: "Central" }),
      res,
    );
    await flushPromises();

    expect(log).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("renders location details", async () => {
    const location = { id: 3 };
    jest.spyOn(LocationModel, "getById").mockResolvedValue(location);
    const res = response();

    LocationController.viewLocationDetails(request({}, { id: "3" }), res);
    await flushPromises();

    expect(LocationModel.getById).toHaveBeenCalledWith("3");
    expect(res.render).toHaveBeenCalledWith("location_details.ejs", {
      location,
      authenticatedUser: { id: 1 },
      role: "",
    });
  });

  test("renders not-found status for missing location details", async () => {
    jest.spyOn(LocationModel, "getById").mockRejectedValue("not found");
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = response();

    LocationController.viewLocationDetails(request({}, { id: "999" }), res);
    await flushPromises();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).toHaveBeenCalledWith("status.ejs", {
      status: "Location not found",
      message: "Maybe your location ID is invalid?",
    });
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

  test("rejects location writes without an authenticated user", () => {
    const res = response();

    LocationController.handleLocationManagement(
      managementRequest({}, { action: "create" }, null),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
