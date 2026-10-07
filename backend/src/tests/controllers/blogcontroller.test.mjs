import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { BlogController } from "../../controllers/BlogController.mjs";
import { BlogModel } from "../../models/BlogModel.mjs";
import { UsersModel } from "../../models/UsersModel.mjs";

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

const request = (
  params = {},
  query = {},
  body = {},
  authenticatedUser = { id: 7 },
) => ({ params, query, body, authenticatedUser });

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mocked model calls isolate blog permissions and response behavior.
describe("BlogController", () => {
  test("renders blog management and handles load errors", async () => {
    const blogs = [{ id: 1 }];
    jest.spyOn(BlogModel, "list").mockResolvedValue({ blogs, total: 1 });
    jest.spyOn(UsersModel, "getAll").mockResolvedValue([]);
    const res = response();

    await BlogController.viewBlogManagement(request({ id: "1" }), res);
    expect(res.render).toHaveBeenCalledWith(
      "blog_management.ejs",
      expect.objectContaining({ blogs }),
    );

    const getById = jest
      .spyOn(BlogModel, "getById")
      .mockRejectedValueOnce("not found")
      .mockResolvedValueOnce({ id: 30, title: "Page two" });
    await BlogController.viewBlogManagement(request({ id: "999" }), res);
    expect(res.render).toHaveBeenCalledWith(
      "blog_management.ejs",
      expect.objectContaining({
        selectedBlog: expect.objectContaining({ id: null }),
      }),
    );

    await BlogController.viewBlogManagement(request({ id: "30" }), res);
    expect(getById).toHaveBeenLastCalledWith("30");
    expect(res.render).toHaveBeenLastCalledWith(
      "blog_management.ejs",
      expect.objectContaining({
        selectedBlog: { id: 30, title: "Page two" },
      }),
    );

    BlogModel.list.mockRejectedValue(new Error("database error"));
    await BlogController.viewBlogManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("handles blog management actions and failures", async () => {
    const res = response();
    jest.spyOn(BlogModel, "create").mockResolvedValue({});
    jest
      .spyOn(BlogModel, "getById")
      .mockResolvedValue(new BlogModel(2, "Post", "Body", 7, new Date(), 0, 0));
    jest.spyOn(BlogModel, "update").mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BlogModel, "delete").mockResolvedValue({ affectedRows: 1 });

    await BlogController.handleBlogManagement(
      request({}, {}, { action: "create", title: "Post" }),
      res,
    );
    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "update", title: "Updated" }),
      res,
    );
    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );

    BlogModel.update.mockResolvedValue({ affectedRows: 0 });
    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "update" }),
      res,
    );
    BlogModel.delete.mockResolvedValue({ affectedRows: 0 });
    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );
    await BlogController.handleBlogManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).toHaveBeenCalledWith(400);

    BlogModel.create.mockRejectedValue(new Error("database error"));
    await BlogController.handleBlogManagement(
      request({}, {}, { action: "create" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);

    BlogModel.update.mockRejectedValue(new Error("database error"));
    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "update" }),
      res,
    );
    BlogModel.delete.mockRejectedValue(new Error("database error"));
    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "delete" }),
      res,
    );
  });

  test("allows authors and admins to update posts but rejects other users", async () => {
    const existingBlog = new BlogModel(2, "Post", "Body", 7, new Date(), 0, 0);
    jest.spyOn(BlogModel, "getById").mockResolvedValue(existingBlog);
    const updatePost = jest
      .spyOn(BlogModel, "update")
      .mockResolvedValue({ affectedRows: 1 });
    const authorResponse = response();
    const otherUserResponse = response();
    const adminResponse = response();

    await BlogController.handleBlogManagement(
      request(
        { id: "2" },
        {},
        { action: "update", title: "Owner edit", userId: "8" },
        { id: 7, role: "member" },
      ),
      authorResponse,
    );
    expect(updatePost).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Owner edit", user_id: 7 }),
    );
    const callsAfterAuthorUpdate = updatePost.mock.calls.length;

    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "update" }, { id: 8, role: "member" }),
      otherUserResponse,
    );
    expect(otherUserResponse.status).toHaveBeenCalledWith(403);
    expect(updatePost).toHaveBeenCalledTimes(callsAfterAuthorUpdate);

    await BlogController.handleBlogManagement(
      request(
        { id: "2" },
        {},
        { action: "update", userId: "8" },
        { id: 8, role: "admin" },
      ),
      adminResponse,
    );
    expect(adminResponse.redirect).toHaveBeenCalledWith("/blogs");
    expect(updatePost).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: 8 }),
    );
  });

  test("allows authors and admins to delete posts but rejects other users", async () => {
    const existingBlog = new BlogModel(2, "Post", "Body", 7, new Date(), 0, 0);
    jest.spyOn(BlogModel, "getById").mockResolvedValue(existingBlog);
    const deletePost = jest
      .spyOn(BlogModel, "delete")
      .mockResolvedValue({ affectedRows: 1 });
    const authorResponse = response();
    const otherUserResponse = response();
    const adminResponse = response();

    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "delete" }, { id: 7, role: "member" }),
      authorResponse,
    );
    const callsAfterAuthorDelete = deletePost.mock.calls.length;

    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "delete" }, { id: 8, role: "member" }),
      otherUserResponse,
    );
    expect(otherUserResponse.status).toHaveBeenCalledWith(403);
    expect(deletePost).toHaveBeenCalledTimes(callsAfterAuthorDelete);

    await BlogController.handleBlogManagement(
      request({ id: "2" }, {}, { action: "delete" }, { id: 8, role: "admin" }),
      adminResponse,
    );
    expect(authorResponse.redirect).toHaveBeenCalledWith("/blogs");
    expect(adminResponse.redirect).toHaveBeenCalledWith("/blogs");
  });

  test("rejects blog creation without an authenticated user", () => {
    const res = response();

    BlogController.handleBlogManagement(
      request({}, {}, { action: "create" }, null),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
