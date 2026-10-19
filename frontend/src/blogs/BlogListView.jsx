import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import { queryString } from "../api.mjs";
import { useAuthenticate } from "../authentication/useAuthenticate.jsx";
import ConfirmDialog from "../common/ConfirmDialog.jsx";
import SearchSortBar from "../common/SearchSortBar.jsx";
import StatusAlert from "../common/StatusAlert.jsx";
import { formatDateTime } from "../common/format.mjs";
import { can, PERMISSIONS } from "../common/permissions.mjs";

const SORTS = [
  { value: "created", label: "date" },
  { value: "title", label: "title" },
];

const PAGE_SIZE = 10;

function BlogListView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, authFetch } = useAuthenticate(PERMISSIONS.readBlogs);

  const [blogs, setBlogs] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("created");
  const [sortDir, setSortDir] = useState("desc");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const getBlogs = useCallback(() => {
    authFetch(
      "GET",
      "/blogs" +
        queryString({
          search_term: searchTerm,
          sort_by: sortBy,
          sort_dir: sortDir,
        }),
    )
      .then((response) => {
        if (response.status === 200) {
          setBlogs(response.body);
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError);
  }, [authFetch, searchTerm, sortBy, sortDir]);

  useEffect(() => {
    getBlogs();
  }, [getBlogs]);

  // The API returns every post, so paging happens here.
  const pageCount = Math.max(1, Math.ceil((blogs?.length ?? 0) / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number.parseInt(searchParams.get("page"), 10) || 1),
    pageCount,
  );
  const pageBlogs =
    blogs?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? [];

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage > 1) {
      next.set("page", nextPage);
    } else {
      next.delete("page");
    }
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // New search or sort results start from the first page.
  const resetPageThen = (setter) => (value) => {
    setter(value);
    if (searchParams.has("page")) {
      const next = new URLSearchParams(searchParams);
      next.delete("page");
      setSearchParams(next);
    }
  };

  const isOwnPost = (blog) =>
    can(user, "manageOwnBlog") && blog.user_id === user.id;

  const deleteBlog = () => {
    setBusy(true);
    setError(null);
    authFetch("DELETE", `/blogs/${deleting.id}`)
      .then((response) => {
        if (response.status === 200) {
          setSuccess("Post deleted.");
          getBlogs();
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError)
      .finally(() => {
        setBusy(false);
        setDeleting(null);
      });
  };

  const pagination = pageCount > 1 && (
    <nav className="flex flex-col items-center gap-1" aria-label="Blog pages">
      <div className="join">
        <button
          className="btn btn-sm join-item"
          disabled={page === 1}
          onClick={() => goToPage(page - 1)}
          aria-label="Previous page"
        >
          «
        </button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(
          (number) => (
            <button
              key={number}
              className={`btn btn-sm join-item ${
                number === page ? "btn-active btn-primary" : ""
              }`}
              aria-current={number === page ? "page" : undefined}
              onClick={() => goToPage(number)}
            >
              {number}
            </button>
          ),
        )}
        <button
          className="btn btn-sm join-item"
          disabled={page === pageCount}
          onClick={() => goToPage(page + 1)}
          aria-label="Next page"
        >
          »
        </button>
      </div>
      <span className="text-xs opacity-60">
        Showing {(page - 1) * PAGE_SIZE + 1}–
        {Math.min(page * PAGE_SIZE, blogs.length)} of {blogs.length} posts
      </span>
    </nav>
  );

  return (
    <section className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-3xl">Blog</h1>
        {can(user, "createBlog") && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/blogs/new")}
          >
            <FaPlus /> New post
          </button>
        )}
      </div>

      <SearchSortBar
        placeholder="search title or content"
        sorts={SORTS}
        sortBy={sortBy}
        sortDir={sortDir}
        onSearch={resetPageThen(setSearchTerm)}
        onSortBy={resetPageThen(setSortBy)}
        onSortDir={resetPageThen(setSortDir)}
      />

      <StatusAlert
        type="success"
        message={success}
        onClose={() => setSuccess(null)}
        autoHideMs={3000}
      />
      <StatusAlert
        message={error}
        onClose={() => setError(null)}
        autoHideMs={3000}
      />

      {pagination}

      {blogs === null ? (
        <span className="loading loading-spinner loading-xl self-center"></span>
      ) : blogs.length === 0 ? (
        <span className="self-center p-4 opacity-70">No posts found</span>
      ) : (
        pageBlogs.map((blog) => (
          <article key={blog.id} className="card card-sm bg-base-200 shadow-sm">
            <div className="card-body">
              <div className="flex items-start justify-between gap-2">
                <h2 className="card-title">{blog.title}</h2>
                {isOwnPost(blog) && (
                  <div className="join">
                    <button
                      className="btn btn-ghost btn-xs join-item"
                      aria-label="Edit post"
                      onClick={() => navigate(`/blogs/${blog.id}/edit`)}
                    >
                      <FaEdit />
                    </button>
                    <button
                      className="btn btn-ghost btn-xs join-item text-error"
                      aria-label="Delete post"
                      onClick={() => setDeleting(blog)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                )}
              </div>
              <p className="whitespace-pre-line">{blog.content}</p>
              <p className="text-xs opacity-60">
                {blog.first_name ?? "Former member"} ·{" "}
                {formatDateTime(blog.created)}
              </p>
            </div>
          </article>
        ))
      )}

      {pagination}

      <ConfirmDialog
        open={!!deleting}
        title="Delete post?"
        message={`"${deleting?.title}" will be permanently removed.`}
        confirmLabel="Delete"
        busy={busy}
        onConfirm={deleteBlog}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}

export default BlogListView;
