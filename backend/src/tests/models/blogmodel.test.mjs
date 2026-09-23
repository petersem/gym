import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { BlogModel } from '../../models/BlogModel.mjs';

const row = {
  id: '31',
  title: 'Training Tips',
  content: 'Build a consistent training routine.',
  user_id: '7',
  created: '2026-09-23 10:00:00',
  deleted: 0,
  updated_by: '3',
};

const blog = new BlogModel(
  31,
  row.title,
  row.content,
  7,
  row.created,
  row.deleted,
  3,
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BlogModel unit tests', () => {
  test('constructs a blog post and maps a database row', () => {
    expect(blog).toBeInstanceOf(BlogModel);
    expect(BlogModel.tableToModel(row)).toEqual(blog);
  });

  test('getAll maps returned blog posts', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue([
      { blogs: row },
      { blogs: { ...row, id: '32', title: 'Nutrition Basics' } },
    ]);

    await expect(BlogModel.getAll()).resolves.toEqual([
      blog,
      new BlogModel(32, 'Nutrition Basics', row.content, 7, row.created, row.deleted, 3),
    ]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM blogs WHERE deleted = 0');
  });

  test('getBySearch uses the term for title and content', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue([{ blogs: row }]);

    await expect(BlogModel.getBySearch('Training')).resolves.toEqual([blog]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('title LIKE ? OR content LIKE ?'),
      ['%Training%', '%Training%'],
    );
  });

  test('getById returns a blog post when found', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue([{ blogs: row }]);

    await expect(BlogModel.getById(31)).resolves.toEqual(blog);
    expect(query).toHaveBeenCalledWith('SELECT * FROM blogs WHERE id = ?', [31]);
  });

  test('getById rejects when no blog post is found', async () => {
    jest.spyOn(BlogModel, 'query').mockResolvedValue([]);

    await expect(BlogModel.getById(999)).rejects.toBe('not found');
  });

  test('update passes blog fields in update order', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(BlogModel.update(blog)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE blogs'),
      [blog.title, blog.content, blog.user_id, blog.created, blog.deleted, blog.updated_by, blog.id],
    );
  });

  test('create passes blog fields without an id', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ insertId: 31 });

    await expect(BlogModel.create(blog)).resolves.toEqual({ insertId: 31 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO blogs'),
      [blog.title, blog.content, blog.user_id, blog.created, blog.deleted, blog.updated_by],
    );
  });

  test('createWithExistingID includes the blog post id', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ insertId: 31 });

    await expect(BlogModel.createWithExistingID(blog)).resolves.toEqual({ insertId: 31 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO blogs'),
      [blog.id, blog.title, blog.content, blog.user_id, blog.created, blog.deleted, blog.updated_by],
    );
  });

  test('delete passes the blog post id', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(BlogModel.delete(31)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith('DELETE FROM blogs WHERE id = ?', [31]);
  });
});