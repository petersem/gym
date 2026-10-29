import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { useAuthenticate } from "../authentication/useAuthenticate.jsx";
import StatusAlert from "../common/StatusAlert.jsx";
import { initials } from "../common/format.mjs";
import { PERMISSIONS, ROLE_BADGE } from "../common/permissions.mjs";

const toForm = (profile) => ({
  first_name: profile.first_name,
  last_name: profile.last_name,
  email: profile.email,
  phone: profile.phone,
  dob: profile.dob ?? "",
  password: "",
  confirm: "",
});

function ProfileView() {
  const navigate = useNavigate();
  const { user, authFetch, refresh, expire } = useAuthenticate(
    PERMISSIONS.readProfile,
  );

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const {
    register: reg,
    handleSubmit,
    getValues,
    reset,
    formState: { errors },
  } = useForm({ mode: "onBlur", reValidateMode: "onChange" });

  useEffect(() => {
    if (!user) {
      return;
    }
    authFetch("GET", "/user/self")
      .then((response) => {
        if (response.status === 200) {
          reset(toForm(response.body));
          setLoaded(true);
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError);
    // Only load once per user; later user refreshes shouldn't discard edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const save = (form) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    authFetch("PUT", `/users/${user.id}`, {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      dob: form.dob || null,
      password: form.password,
    })
      .then((response) => {
        if (response.status !== 200) {
          setError(response.body.message);
        } else if (form.password) {
          // A new password revokes the API key server-side.
          expire("Password changed. Please log in with your new password.");
          navigate("/login");
        } else {
          reset(toForm(response.body));
          setSuccess("Profile updated.");
          window.scrollTo({ top: 0, behavior: "smooth" });
          refresh();
        }
      })
      .catch(setError)
      .finally(() => setSaving(false));
  };

  if (!user || !loaded) {
    return error ? (
      <div className="p-4">
        <StatusAlert message={error} />
      </div>
    ) : (
      <span className="loading loading-spinner loading-xl mx-auto mt-8 block"></span>
    );
  }

  const field = (name, label, { rules = {}, ...props } = {}) => (
    <div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{label}</span>
        <input
          className={`input w-full ${errors[name] ? "input-error" : ""}`}
          placeholder={label}
          aria-invalid={errors[name] ? "true" : "false"}
          {...reg(name, rules)}
          {...props}
        />
      </label>
      {errors[name] && (
        <p role="alert" className="text-error text-sm mt-1">
          {errors[name].message}
        </p>
      )}
    </div>
  );

  const required = (what) => ({
    validate: (v) => v.trim() !== "" || `${what} is required.`,
  });

  return (
    <form
      onSubmit={handleSubmit(save)}
      noValidate
      className="flex flex-col gap-4 p-4"
    >
      <div className="flex items-center gap-4">
        <div className="avatar avatar-placeholder">
          <div className="w-16 rounded-full bg-primary text-primary-content">
            <span className="text-xl">{initials(user)}</span>
          </div>
        </div>
        <div>
          <h1 className="text-3xl">My profile</h1>
          <span className={`badge rounded ${ROLE_BADGE[user.role]}`}>
            {user.role}
          </span>
        </div>
      </div>

      <StatusAlert
        type="success"
        message={success}
        onClose={() => setSuccess(null)}
        autoHideMs={3000}
      />
      <StatusAlert message={error} onClose={() => setError(null)} />

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Details</h2>
        <fieldset className="fieldset gap-3 rounded-box border border-base-300 bg-base-200 p-4">
          {field("first_name", "First name", {
            rules: {
              ...required("First name"),
              maxLength: {
                value: 45,
                message: "First name must be 45 characters or fewer.",
              },
            },
            autoComplete: "given-name",
          })}
          {field("last_name", "Last name", {
            rules: {
              ...required("Last name"),
              maxLength: {
                value: 45,
                message: "Last name must be 45 characters or fewer.",
              },
            },
            autoComplete: "family-name",
          })}
          {field("email", "Email", {
            type: "email",
            rules: {
              required: "Email is required.",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Please enter a valid email address.",
              },
              maxLength: {
                value: 100,
                message: "Email must be 100 characters or fewer.",
              },
            },
            autoComplete: "email",
          })}
          {field("phone", "Phone", {
            type: "tel",
            rules: {
              ...required("Phone"),
              pattern: {
                // Mobile (04xx xxx xxx) or landline (02/03/07/08 xxxx xxxx), optionally +61/61 prefixed
                value:
                  /^(?:(?:\+?61|0)[\s-]?4\d{2}[\s-]?\d{3}[\s-]?\d{3}|(?:\+?61|0)[\s-]?[2378][\s-]?\d{4}[\s-]?\d{4})$/,
                message:
                  "Please enter a valid Australian phone number, e.g. 0412 345 678 or 02 9999 8888.",
              },
              maxLength: {
                value: 20,
                message: "Phone must be 20 characters or fewer.",
              },
            },
            autoComplete: "tel",
          })}
          {field("dob", "Date of birth (optional)", { type: "date" })}
        </fieldset>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Change password</h2>
        <fieldset className="fieldset gap-3 rounded-box border border-base-300 bg-base-200 p-4">
          {field("password", "New password (leave blank to keep)", {
            type: "password",
            rules: {
              validate: (v) =>
                v === "" ||
                v.length >= 8 ||
                "Password must be at least 8 characters.",
              maxLength: {
                value: 36,
                message: "Password must be 36 characters or fewer.",
              },
            },
            autoComplete: "new-password",
          })}
          {field("confirm", "Confirm new password", {
            type: "password",
            rules: {
              validate: (v) =>
                v === getValues("password") || "Passwords do not match.",
            },
            autoComplete: "new-password",
          })}
          <p className="label">Changing your password will log you out.</p>
        </fieldset>
      </section>

      <button className="btn btn-primary btn-lg" disabled={saving}>
        {saving ? (
          <span className="loading loading-spinner"></span>
        ) : (
          "Save changes"
        )}
      </button>
    </form>
  );
}

export default ProfileView;
