import { afterAll, describe, expect, test } from '@jest/globals';
import { BlogModel } from '../../models/BlogModel.mjs';
import { UsersModel } from '../../models/UsersModel.mjs';

const requestCount = 25;
const userIds = [];
const blogIds = [];

afterAll(async () => {
  await Promise.all(blogIds.map((id) => BlogModel.delete(id)));
  await Promise.all(userIds.map((id) => UsersModel.delete(id)));
  await BlogModel.connection.end();
});

describe('BlogModel load test', () => {
  test(`handles ${requestCount} concurrent blog lifecycles`, async () => {
    const users = await Promise.all(Array.from({ length: requestCount }, (_, index) => UsersModel.create(
      new UsersModel(null, 'Load', `Blog User ${index}`, 'member', `load-blog-${Date.now()}-${index}@example.com`, 'hashed-password', '555-0182', '2000-01-01', 0, `blog-key-${index}`),
    )));
    userIds.push(...users.map(({ insertId }) => insertId));

    await Promise.all(userIds.map((id, index) => BlogModel.createWithExistingID(
      new BlogModel(id, `Load Subject ${index}`, 'Load body', id, '2026-09-26 10:00:00', 0, null),
    )));
    blogIds.push(...userIds);

    const loaded = await Promise.all(blogIds.map((id) => BlogModel.getById(id)));
    expect(loaded).toHaveLength(requestCount);
    await Promise.all(loaded.map((blog) => BlogModel.update({ ...blog, content: 'Updated load body' })));
    expect((await Promise.all(blogIds.map((id) => BlogModel.getById(id))))
      .every((blog) => blog.content === 'Updated load body')).toBe(true);

    await Promise.all(blogIds.map((id) => BlogModel.delete(id)));
    for (const id of blogIds) await expect(BlogModel.getById(id)).rejects.toBe('not found');
    blogIds.length = 0;
    userIds.length = 0;
  });
});
