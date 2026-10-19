import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { fetchAPI } from "../api.mjs";
import { useAuthenticate } from "./useAuthenticate.jsx";
import StatusAlert from "../common/StatusAlert.jsx";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  dob: "",
  password: "",
  confirm: "",
};

function RegisterView() {
  const navigate = useNavigate();
  const { login, status, user } = useAuthenticate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const loginFailed =
    registered &&
    status &&
    !["authenticating", "loading", "loaded", "resuming"].includes(status);
  const busy = saving || (registered && !loginFailed);

  const update = (field) => (e) =>
    setForm({ ...form, [field]: e.target.value });

  const register = (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    const email = form.email.trim();
    setSaving(true);
    fetchAPI("POST", "/register", {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email,
      phone: form.phone.trim(),
      dob: form.dob || null,
      password: form.password,
    })
      .then((response) => {
        if (response.status === 201) {
          setRegistered(true);
          login(email, form.password);
        } else {
          setError(response.body.message);
        }
      })
      .catch(setError)
      .finally(() => setSaving(false));
  };

  const field = (name, label, props = {}) => (
    <label className="floating-label">
      <span>{label}</span>
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
    <form onSubmit={register} className="flex flex-col gap-4 p-4">
      <h1 className="text-3xl">Become a member</h1>

      <StatusAlert
        message={error}
        onClose={() => setError(null)}
        autoHideMs={3000}
      />
      {loginFailed && (
        <StatusAlert
          type="warning"
          message={`Your account was created, but logging in failed: ${status}`}
        />
      )}

      <fieldset className="fieldset gap-4 rounded-box border border-base-300 p-4">
        <legend className="fieldset-legend">Your details</legend>
        {field("first_name", "First name", {
          required: true,
          maxLength: 45,
          autoComplete: "given-name",
        })}
        {field("last_name", "Last name", {
          required: true,
          maxLength: 45,
          autoComplete: "family-name",
        })}
        {field("email", "Email", {
          type: "email",
          required: true,
          maxLength: 100,
          autoComplete: "email",
        })}
        {field("phone", "Phone", {
          type: "tel",
          required: true,
          maxLength: 20,
          autoComplete: "tel",
        })}
        {field("dob", "Date of birth (optional)", { type: "date" })}
      </fieldset>

      <fieldset className="fieldset gap-4 rounded-box border border-base-300 p-4">
        <legend className="fieldset-legend">Password</legend>
        {field("password", "Password", {
          type: "password",
          required: true,
          autoComplete: "new-password",
          minLength: 8,
          maxLength: 36,
        })}
        {field("confirm", "Confirm password", {
          type: "password",
          required: true,
          autoComplete: "new-password",
          maxLength: 36,
        })}
        <p className="label">8&ndash;36 characters.</p>
      </fieldset>

      <button className="btn btn-primary btn-lg" disabled={busy || loginFailed}>
        {busy ? <span className="loading loading-spinner"></span> : "Register"}
      </button>
      <p className="text-center">
        Already a member?{" "}
        <Link to="/login" className="link link-primary">
          Log in
        </Link>
      </p>
    </form>
  );
}

export default RegisterView;
