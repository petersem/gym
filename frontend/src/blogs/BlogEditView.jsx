import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { useAuthenticate } from "../authentication/useAuthenticate.jsx";
import StatusAlert from "../common/StatusAlert.jsx";
import { PERMISSIONS } from "../common/permissions.mjs";

function BlogEditView() {
  const navigate = useNavigate();
  const { authFetch } = useAuthenticate(PERMISSIONS.createBlog);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: { title: "", content: "" },
  });
  const contentLength = useWatch({ control, name: "content" }).length;

  const save = ({ title, content }) => {
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
    <form onSubmit={handleSubmit(save)} noValidate className="flex flex-col gap-4 p-4">
      <h1 className="text-3xl">New post</h1>
      <StatusAlert
        message={error}
        onClose={() => setError(null)}
        autoHideMs={3000}
      />
      <div>
        <label className="floating-label">
          <span>Title</span>
          <input
            className={`input w-full ${errors.title ? "input-error" : ""}`}
            placeholder="Title"
            aria-invalid={errors.title ? "true" : "false"}
            {...register("title", {
              validate: (v) => v.trim() !== "" || "Title is required.",
              maxLength: { value: 100, message: "Title must be 100 characters or fewer." },
            })}
          />
        </label>
        {errors.title && (
          <p role="alert" className="text-error text-sm mt-1">
            {errors.title.message}
          </p>
        )}
      </div>
      <div>
        <label className="floating-label">
          <span>Content</span>
          <textarea
            className={`textarea h-40 w-full ${errors.content ? "textarea-error" : ""}`}
            placeholder="What's happening at the gym?"
            aria-invalid={errors.content ? "true" : "false"}
            {...register("content", {
              validate: (v) => v.trim() !== "" || "Content is required.",
              maxLength: { value: 250, message: "Content must be 250 characters or fewer." },
            })}
          />
        </label>
        {errors.content && (
          <p role="alert" className="text-error text-sm mt-1">
            {errors.content.message}
          </p>
        )}
      </div>
      <span className="self-end text-xs opacity-60">{contentLength}/250</span>      <div className="flex gap-2">
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
