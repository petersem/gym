import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { BlogController } from '../../controllers/BlogController.mjs';
import { BlogModel } from '../../models/BlogModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

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

const request = (params = {}, query = {}, body = {}, authenticatedUser = { id: 7 }) => ({ params, query, body, authenticatedUser });
const next = () => jest.fn();

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BlogController', () => {
  test('renders blog management and handles load errors', async () => {
    const blogs = [{ id: 1 }];
    jest.spyOn(BlogModel, 'list').mockResolvedValue({ blogs, total: 1 });
    jest.spyOn(UsersModel, 'getAll').mockResolvedValue([]);
    const res = response();

    await BlogController.viewBlogManagement(request({ id: '1' }), res);
    expect(res.render).toHaveBeenCalledWith('blog_management.ejs', expect.objectContaining({ blogs }));

    await BlogController.viewBlogManagement(request({ id: '999' }), res);
    expect(res.render).toHaveBeenCalledWith('blog_management.ejs', expect.objectContaining({
      selectedBlog: expect.objectContaining({ id: null }),
    }));

    BlogModel.list.mockRejectedValue(new Error('database error'));
    await BlogController.viewBlogManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('handles blog management actions and failures', async () => {
    const res = response();
    jest.spyOn(BlogModel, 'create').mockResolvedValue({});
    jest.spyOn(BlogModel, 'getById').mockResolvedValue(new BlogModel(2, 'Post', 'Body', 7, new Date(), 0, 0));
    jest.spyOn(BlogModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BlogModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await BlogController.handleBlogManagement(request({}, {}, { action: 'create', title: 'Post' }), res);
    await BlogController.handleBlogManagement(request({ id: '2' }, {}, { action: 'update', title: 'Updated' }), res);
    await BlogController.handleBlogManagement(request({ id: '2' }, {}, { action: 'delete' }), res);

    BlogModel.update.mockResolvedValue({ affectedRows: 0 });
    await BlogController.handleBlogManagement(request({ id: '2' }, {}, { action: 'update' }), res);
    BlogModel.delete.mockResolvedValue({ affectedRows: 0 });
    await BlogController.handleBlogManagement(request({ id: '2' }, {}, { action: 'delete' }), res);
    await BlogController.handleBlogManagement(request(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).toHaveBeenCalledWith(400);

    BlogModel.create.mockRejectedValue(new Error('database error'));
    await BlogController.handleBlogManagement(request({}, {}, { action: 'create' }), res);
    expect(res.status).toHaveBeenCalledWith(500);

    BlogModel.update.mockRejectedValue(new Error('database error'));
    await BlogController.handleBlogManagement(request({ id: '2' }, {}, { action: 'update' }), res);
    BlogModel.delete.mockRejectedValue(new Error('database error'));
    await BlogController.handleBlogManagement(request({ id: '2' }, {}, { action: 'delete' }), res);
  });

  test('allows authors and admins to delete posts but rejects other users', async () => {
    const existingBlog = new BlogModel(2, 'Post', 'Body', 7, new Date(), 0, 0);
    jest.spyOn(BlogModel, 'getById').mockResolvedValue(existingBlog);
    const deletePost = jest.spyOn(BlogModel, 'delete').mockResolvedValue({ affectedRows: 1 });
    const authorResponse = response();
    const otherUserResponse = response();
    const adminResponse = response();

    await BlogController.handleBlogManagement(
      request({ id: '2' }, {}, { action: 'delete' }, { id: 7, role: 'member' }),
      authorResponse,
    );
    const callsAfterAuthorDelete = deletePost.mock.calls.length;

    await BlogController.handleBlogManagement(
      request({ id: '2' }, {}, { action: 'delete' }, { id: 8, role: 'member' }),
      otherUserResponse,
    );
    expect(otherUserResponse.status).toHaveBeenCalledWith(403);
    expect(deletePost).toHaveBeenCalledTimes(callsAfterAuthorDelete);

    await BlogController.handleBlogManagement(
      request({ id: '2' }, {}, { action: 'delete' }, { id: 8, role: 'admin' }),
      adminResponse,
    );
    expect(authorResponse.redirect).toHaveBeenCalledWith('/blogs');
    expect(adminResponse.redirect).toHaveBeenCalledWith('/blogs');
  });

  test('lists and searches blog posts', async () => {
    const blogs = [{ id: 1 }];
    const getAll = jest.spyOn(BlogModel, 'getAll').mockResolvedValue(blogs);
    const search = jest.spyOn(BlogModel, 'getBySearch').mockResolvedValue(blogs);
    const res = response();

    await BlogController.list(request(), res, next());
    await BlogController.list(request({}, { search_term: 'training' }), res, next());

    expect(getAll).toHaveBeenCalled();
    expect(search).toHaveBeenCalledWith('training');
    expect(res.json).toHaveBeenCalledWith(blogs);
  });

  test('handles blog CRUD requests and forwards errors', async () => {
    const res = response();
    const errorNext = next();
    jest.spyOn(BlogModel, 'getById').mockResolvedValue({ id: 2 });
    jest.spyOn(BlogModel, 'create').mockResolvedValue({ insertId: 2 });
    jest.spyOn(BlogModel, 'update').mockResolvedValue({ affectedRows: 1 });
    jest.spyOn(BlogModel, 'delete').mockResolvedValue({ affectedRows: 1 });

    await BlogController.getById(request({ id: '2' }), res, errorNext);
    await BlogController.create(request({}, {}, { title: 'Post' }), res, errorNext);
    await BlogController.update(request({ id: '2' }, {}, { title: 'Updated' }), res, errorNext);
    await BlogController.delete(request({ id: '2' }), res, errorNext);

    expect(BlogModel.update).toHaveBeenCalledWith({ title: 'Updated', id: 2 });
    expect(BlogModel.delete).toHaveBeenCalledWith(2);
    expect(res.status).toHaveBeenCalledWith(201);

    const error = new Error('database error');
    jest.spyOn(BlogModel, 'getAll').mockRejectedValue(error);
    await BlogController.list(request(), res, errorNext);
    expect(errorNext).toHaveBeenCalledWith(error);
  });

  test('forwards errors from blog JSON handlers', async () => {
    const error = new Error('database error');
    const errorNext = next();
    jest.spyOn(BlogModel, 'getById').mockRejectedValue(error);
    jest.spyOn(BlogModel, 'create').mockRejectedValue(error);
    jest.spyOn(BlogModel, 'update').mockRejectedValue(error);
    jest.spyOn(BlogModel, 'delete').mockRejectedValue(error);
    const res = response();

    await BlogController.getById(request({ id: '1' }), res, errorNext);
    await BlogController.create(request(), res, errorNext);
    await BlogController.update(request({ id: '1' }), res, errorNext);
    await BlogController.delete(request({ id: '1' }), res, errorNext);

    expect(errorNext).toHaveBeenCalledTimes(4);
  });

  test('rejects blog creation without an authenticated user', () => {
    const res = response();

    BlogController.handleBlogManagement(request({}, {}, { action: 'create' }, null), res);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
