import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuthenticate } from "../authentication/useAuthenticate.jsx";
import StatusAlert from "../common/StatusAlert.jsx";
import { PERMISSIONS } from "../common/permissions.mjs";

function BlogEditView() {
  const navigate = useNavigate();
  const { authFetch } = useAuthenticate(PERMISSIONS.createBlog);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    authFetch("POST", "/blogs", {
      title: title.trim(),
      content: content.trim(),
    })
      .then((response) => {
        if (response.status === 201) {
          navigate("/blogs");
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError)
      .finally(() => setSaving(false));
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4 p-4">
      <h1 className="text-3xl">New post</h1>
      <StatusAlert
        message={error}
        onClose={() => setError(null)}
        autoHideMs={3000}
      />
      <label className="floating-label">
        <span>Title</span>
        <input
          className="input w-full"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          required
        />
      </label>
      <label className="floating-label">
        <span>Content</span>
        <textarea
          className="textarea h-40 w-full"
          placeholder="What's happening at the gym?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={250}
          required
        />
      </label>
      <span className="self-end text-xs opacity-60">{content.length}/250</span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn grow"
          onClick={() => navigate("/blogs")}
        >
          Cancel
        </button>
        <button className="btn btn-primary grow" disabled={saving}>
          {saving ? <span className="loading loading-spinner"></span> : "Save"}
        </button>
      </div>
    </form>
  );
}

export default BlogEditView;
