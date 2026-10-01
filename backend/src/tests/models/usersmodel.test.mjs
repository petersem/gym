import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { UsersModel } from "../../models/UsersModel.mjs";

const row = {
  id: "7",
  first_name: "Ada",
  last_name: "Lovelace",
  role: "member",
  email: "ada@example.com",
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
  test("constructs a user and maps a database row", () => {
    expect(user).toBeInstanceOf(UsersModel);
    expect(UsersModel.tableToModel(row)).toEqual(user);
  });

  test("getAll maps returned users", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue([
        { users: row },
        { users: { ...row, id: "8", email: "grace@example.com" } },
      ]);

    await expect(UsersModel.getAll()).resolves.toEqual([
      user,
      new UsersModel(
        8,
        row.first_name,
        row.last_name,
        row.role,
        "grace@example.com",
        row.password,
        row.phone,
        row.dob,
        row.deleted,
        row.authentication_key,
      ),
    ]);
    expect(query).toHaveBeenCalledWith("SELECT * FROM users WHERE deleted = 0");
  });

  test("getBySearch uses the term for names and email", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue([{ users: row }]);

    await expect(UsersModel.getBySearch("Ada")).resolves.toEqual([user]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        "first_name LIKE ? OR last_name LIKE ? OR email LIKE ?",
      ),
      ["%Ada%", "%Ada%", "%Ada%"],
    );
  });

  test("list returns active users with default sorting and no pagination", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValueOnce([{ "": { total: "1" } }])
      .mockResolvedValueOnce([{ users: row }]);

    await expect(UsersModel.list()).resolves.toEqual({
      users: [user],
      total: 1,
    });
    expect(query).toHaveBeenNthCalledWith(
      1,
      "SELECT COUNT(*) AS total FROM users WHERE deleted = 0",
      [],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM users WHERE deleted = 0 ORDER BY last_name ASC ",
      [],
    );
  });

  test("list searches, filters by role, sorts, and paginates users", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValueOnce([{ "": { total: 4 } }])
      .mockResolvedValueOnce([{ users: row }]);

    await expect(
      UsersModel.list({
        searchTerm: "Ada",
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
      ["%Ada%", "%Ada%", "%Ada%", "member"],
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      "SELECT * FROM users WHERE deleted = 0 AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?) AND role = ? ORDER BY email DESC LIMIT ? OFFSET ?",
      ["%Ada%", "%Ada%", "%Ada%", "member", 2, 4],
    );
  });

  test.each([
    { countResult: [] },
    { countResult: [{}] },
    { countResult: [{ "": {} }] },
  ])(
    "list handles a missing count value and invalid options: $countResult",
    async ({ countResult }) => {
      const query = jest
        .spyOn(UsersModel, "query")
        .mockResolvedValueOnce(countResult)
        .mockResolvedValueOnce([]);

      await expect(
        UsersModel.list({
          sortBy: "invalid",
          sortDir: "invalid",
          page: 0,
          pageSize: 0,
        }),
      ).resolves.toEqual({ users: [], total: 0 });
      expect(query).toHaveBeenNthCalledWith(
        2,
        "SELECT * FROM users WHERE deleted = 0 ORDER BY last_name ASC ",
        [],
      );
    },
  );

  test("getByUsername returns an active user by email", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue([{ users: row }]);

    await expect(UsersModel.getByUsername("ada@example.com")).resolves.toEqual(
      user,
    );
    expect(query).toHaveBeenCalledWith(
      "SELECT * FROM users WHERE email = ? AND deleted = 0",
      ["ada@example.com"],
    );
  });

  test("getByUsername rejects when the email is not found", async () => {
    jest.spyOn(UsersModel, "query").mockResolvedValue([]);

    await expect(UsersModel.getByUsername("missing@example.com")).rejects.toBe(
      "not found",
    );
  });

  test("getById returns a user when found", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue([{ users: row }]);

    await expect(UsersModel.getById(7)).resolves.toEqual(user);
    expect(query).toHaveBeenCalledWith("SELECT * FROM users WHERE id = ?", [7]);
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

  test("createWithExistingID includes the user id", async () => {
    const query = jest
      .spyOn(UsersModel, "query")
      .mockResolvedValue({ insertId: 7 });

    await expect(UsersModel.createWithExistingID(user)).resolves.toEqual({
      insertId: 7,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      [
        user.id,
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
