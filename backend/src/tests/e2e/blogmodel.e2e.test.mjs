import { afterAll, describe, expect, test } from '@jest/globals';
import { BlogModel } from '../../models/BlogModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

let userId;
let blogId;

afterAll(async () => {
  await BlogModel.connection.end();
});

describe('BlogModel end-to-end flow', () => {
  test('creates, reads, searches, updates, and deletes a blog post', async () => {
    const user = new UsersModel(null, 'E2E', 'Blog Author', 'member', `e2e-blog-${Date.now()}@example.com`, 'hashed-password', '555-0187', '2000-01-01', 0, 'e2e-blog-key');

    try {
      userId = (await UsersModel.create(user)).insertId;
      const blog = new BlogModel(userId, 'E2E Subject', 'E2E body', userId, '2026-09-26 10:00:00', 0, null);
      await BlogModel.createWithExistingID(blog);
      blogId = blog.id;

      expect((await BlogModel.getById(blogId)).title).toBe('E2E Subject');
      expect(await BlogModel.getBySearch('E2E Subject')).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: blogId, content: 'E2E body' }),
      ]));

      blog.content = 'Updated body';
      await BlogModel.update(blog);
      expect((await BlogModel.getById(blogId)).content).toBe('Updated body');
    } finally {
      if (blogId) await BlogModel.delete(blogId);
      if (userId) await UsersModel.delete(userId);
    }

    await expect(BlogModel.getById(blogId)).rejects.toBe('not found');
  });
});
