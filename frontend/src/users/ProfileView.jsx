import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
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

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    authFetch("GET", `/users/${user.id}`)
      .then((response) => {
        if (response.status === 200) {
          setForm(toForm(response.body));
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError);
    // Only load once per user; later user refreshes shouldn't discard edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const update = (field) => (e) =>
    setForm({ ...form, [field]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (form.password && form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
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
          setForm(toForm(response.body));
          setSuccess("Profile updated.");
          refresh();
        }
      })
      .catch(setError)
      .finally(() => setSaving(false));
  };

  if (!user || !form) {
    return error ? (
      <div className="p-4">
        <StatusAlert message={error} />
      </div>
    ) : (
      <span className="loading loading-spinner loading-xl mx-auto mt-8 block"></span>
    );
  }

  const field = (name, label, props = {}) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <input
        className="input w-full"
        placeholder={label}
        value={form[name]}
        onChange={update(name)}
        {...props}
      />
    </label>
  );

  return (
    <form onSubmit={save} className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <div className="avatar avatar-placeholder">
          <div className="w-16 rounded-full bg-primary text-primary-content">
            <span className="text-xl">{initials(user)}</span>
          </div>
        </div>
        <div>
          <h1 className="text-3xl">My profile</h1>
          <span className={`badge ${ROLE_BADGE[user.role]}`}>{user.role}</span>
        </div>
      </div>

      <StatusAlert
        type="success"
        message={success}
        onClose={() => setSuccess(null)}
        autoHideMs={3000}
      />
      <StatusAlert message={error} onClose={() => setError(null)} />

      <fieldset className="fieldset gap-2 rounded-box border border-base-300 bg-base-200 p-4">
        <legend className="fieldset-legend">Details</legend>
        {field("first_name", "First name", { required: true, maxLength: 45 })}
        {field("last_name", "Last name", { required: true, maxLength: 45 })}
        {field("email", "Email", {
          type: "email",
          required: true,
          maxLength: 100,
        })}
        {field("phone", "Phone", {
          type: "tel",
          required: true,
          maxLength: 20,
        })}
        {field("dob", "Date of birth", { type: "date" })}
      </fieldset>

      <fieldset className="fieldset gap-2 rounded-box border border-base-300 bg-base-200 p-4">
        <legend className="fieldset-legend">Change password</legend>
        {field("password", "New password (leave blank to keep)", {
          type: "password",
          autoComplete: "new-password",
          minLength: 8,
          maxLength: 36,
        })}
        {field("confirm", "Confirm new password", {
          type: "password",
          autoComplete: "new-password",
          maxLength: 36,
        })}
        <p className="label">Changing your password will log you out.</p>
      </fieldset>

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
