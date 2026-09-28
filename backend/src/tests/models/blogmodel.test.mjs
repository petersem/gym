import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { BlogModel } from '../../models/BlogModel.mjs';

const row = {
  id: '31',
  subject: 'Training Tips',
  body: 'Build a consistent training routine.',
  user_id: '7',
  create_date: '2026-09-23 10:00:00',
};

const blog = new BlogModel(
  31,
  row.subject,
  row.body,
  7,
  row.create_date,
  0,
  null,
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('BlogModel unit tests', () => {
  test('constructs a blog post and maps a database row', () => {
    expect(blog).toBeInstanceOf(BlogModel);
    expect(BlogModel.tableToModel(row)).toEqual(blog);
  });

  test('maps legacy blog field aliases when present', () => {
    const legacyRow = {
      id: '32',
      title: 'Legacy title',
      content: 'Legacy body',
      user_id: '7',
      created: '2026-09-24 10:00:00',
      deleted: 0,
      updated_by: '3',
    };

    expect(BlogModel.tableToModel(legacyRow)).toEqual(
      new BlogModel(32, 'Legacy title', 'Legacy body', 7, legacyRow.created, 0, 3),
    );
  });

  test('getAll maps returned blog posts', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue([
      { blog: row },
      { blog: { ...row, id: '32', subject: 'Nutrition Basics' } },
    ]);

    await expect(BlogModel.getAll()).resolves.toEqual([
      blog,
      new BlogModel(32, 'Nutrition Basics', row.body, 7, row.create_date, 0, null),
    ]);
    expect(query).toHaveBeenCalledWith('SELECT * FROM blog ORDER BY create_date DESC, id DESC');
  });

  test('getBySearch uses the term for title and content', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue([{ blog: row }]);

    await expect(BlogModel.getBySearch('Training')).resolves.toEqual([blog]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('subject LIKE ? OR body LIKE ?'),
      ['%Training%', '%Training%'],
    );
  });

  test('list returns blog posts with default sorting and no pagination', async () => {
    const query = jest.spyOn(BlogModel, 'query')
      .mockResolvedValueOnce([{ '': { total: '1' } }])
      .mockResolvedValueOnce([{ blog: row }]);

    await expect(BlogModel.list()).resolves.toEqual({ blogs: [blog], total: 1 });
    expect(query).toHaveBeenNthCalledWith(1, 'SELECT COUNT(*) AS total FROM blog ', []);
    expect(query).toHaveBeenNthCalledWith(2,
      'SELECT * FROM blog  ORDER BY create_date DESC, id DESC ', []);
  });

  test('list searches, sorts, and paginates blog posts', async () => {
    const query = jest.spyOn(BlogModel, 'query')
      .mockResolvedValueOnce([{ '': { total: 4 } }])
      .mockResolvedValueOnce([{ blog: row }]);

    await expect(BlogModel.list({
      searchTerm: 'Training', sortBy: 'title', sortDir: 'asc', page: 3, pageSize: 2,
    })).resolves.toEqual({ blogs: [blog], total: 4 });
    expect(query).toHaveBeenNthCalledWith(1,
      'SELECT COUNT(*) AS total FROM blog WHERE (subject LIKE ? OR body LIKE ?)',
      ['%Training%', '%Training%']);
    expect(query).toHaveBeenNthCalledWith(2,
      'SELECT * FROM blog WHERE (subject LIKE ? OR body LIKE ?) ORDER BY subject ASC, id ASC LIMIT ? OFFSET ?',
      ['%Training%', '%Training%', 2, 4]);
  });

  test.each([
    { countResult: [] },
    { countResult: [{}] },
    { countResult: [{ '': {} }] },
  ])('list handles a missing count value and invalid options: $countResult', async ({ countResult }) => {
    const query = jest.spyOn(BlogModel, 'query')
      .mockResolvedValueOnce(countResult)
      .mockResolvedValueOnce([]);

    await expect(BlogModel.list({ sortBy: 'invalid', sortDir: 'invalid', page: 0, pageSize: 0 }))
      .resolves.toEqual({ blogs: [], total: 0 });
    expect(query).toHaveBeenNthCalledWith(2,
      'SELECT * FROM blog  ORDER BY create_date DESC, id DESC ', []);
  });

  test('getById returns a blog post when found', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue([{ blog: row }]);

    await expect(BlogModel.getById(31)).resolves.toEqual(blog);
    expect(query).toHaveBeenCalledWith('SELECT * FROM blog WHERE id = ?', [31]);
  });

  test('getById rejects when no blog post is found', async () => {
    jest.spyOn(BlogModel, 'query').mockResolvedValue([]);

    await expect(BlogModel.getById(999)).rejects.toBe('not found');
  });

  test('update passes blog fields in update order', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(BlogModel.update(blog)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE blog'),
      [blog.title, blog.content, blog.user_id, blog.id],
    );
  });

  test('create passes blog fields without an id', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ insertId: 31 });

    await expect(BlogModel.create(blog)).resolves.toEqual({ insertId: 31 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO blog'),
      [blog.title, blog.content, blog.user_id, blog.created],
    );
  });

  test('createWithExistingID includes the blog post id', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ insertId: 31 });

    await expect(BlogModel.createWithExistingID(blog)).resolves.toEqual({ insertId: 31 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO blog'),
      [blog.id, blog.title, blog.content, blog.user_id, blog.created],
    );
  });

  test('delete passes the blog post id', async () => {
    const query = jest.spyOn(BlogModel, 'query').mockResolvedValue({ affectedRows: 1 });

    await expect(BlogModel.delete(31)).resolves.toEqual({ affectedRows: 1 });
    expect(query).toHaveBeenCalledWith('DELETE FROM blog WHERE id = ?', [31]);
  });
});