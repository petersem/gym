import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { UsersModel } from "../../models/UsersModel.mjs";

const row = {
  id: "7",
  first_name: "Fred",
  last_name: "Nerk",
  role: "member",
  email: "fn@gym.com",
  password: "hashed-password",
  phone: "555-0100",
  dob: "1815-12-10",
  deleted: 0,
  authentication_key: "auth-key",
};

const user = new UsersModel(
  7,
  row.first_name,
  row.last_name,
  row.role,
  row.email,
  row.password,
  row.phone,
  row.dob,
  row.deleted,
  row.authentication_key,
);

afterEach(() => {
  jest.restoreAllMocks();
});

// Query spies verify user mapping, filtering, and SQL without contacting MySQL.
describe("UsersModel unit tests", () => {
  test("list searches, filters by role, sorts, and paginates users", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValueOnce([{ "": { total: 4 } }])
      .mockResolvedValueOnce([{ users: row }]);

    await expect(
      UsersModel.list({
        searchTerm: "Fred",
        role: "member",
        sortBy: "email",
        sortDir: "desc",
        page: 3,
        pageSize: 2,
      }),
    ).resolves.toEqual({ users: [user], total: 4 });
    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT COUNT(*) AS total FROM users WHERE deleted = 0 AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?) AND role = ?",
      ["%Fred%", "%Fred%", "%Fred%", "member"],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM users WHERE deleted = 0 AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?) AND role = ? ORDER BY email DESC LIMIT ? OFFSET ?",
      ["%Fred%", "%Fred%", "%Fred%", "member", 2, 4],
    );
  });

  test("getByUsername returns an active user by email", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue([{ users: row }]);

    await expect(UsersModel.getByUsername("fn@gym.com")).resolves.toEqual(user);
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE email = ? AND deleted = 0",
      ["fn@gym.com"],
    );
  });

  test("getByUsername rejects when the email is not found", async () => {
    jest.spyOn(UsersModel, "query").mockResolvedValue([]);

    await expect(UsersModel.getByUsername("missing@example.com")).rejects.toBe(
      "not found",
    );
  });

  test("getById rejects when no user is found", async () => {
    jest.spyOn(UsersModel, "query").mockResolvedValue([]);

    await expect(UsersModel.getById(999)).rejects.toBe("not found");
  });

  test("update passes user fields in update order", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(UsersModel.update(user)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users"),
      [
        user.first_name,
        user.last_name,
        user.role,
        user.email,
        user.password,
        user.phone,
        user.dob,
        user.deleted,
        user.authentication_key,
        user.id,
      ],
    );
  });

  test("create passes user fields without an id", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue({ insertId: 7 });

    await expect(UsersModel.create(user)).resolves.toEqual({ insertId: 7 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      [
        user.first_name,
        user.last_name,
        user.role,
        user.email,
        user.password,
        user.phone,
        user.dob,
        user.deleted,
        user.authentication_key,
      ],
    );
  });

  test("soft deletes the user id", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue({ affectedRows: 1 });

    await expect(UsersModel.delete(7)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      "UPDATE users SET deleted = 1 WHERE id = ?",
      [7],
    );
  });
});
