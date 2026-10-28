import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { fetchAPI } from "../api.mjs";
import { useAuthenticate } from "./useAuthenticate.jsx";
import StatusAlert from "../common/StatusAlert.jsx";
import { useForm } from "react-hook-form";

function RegisterView() {
  const navigate = useNavigate();
  const { login, status, user } = useAuthenticate();

  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState(null);

  const {
    register: reg,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm({ mode: "onBlur", reValidateMode: "onChange" });
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

  const register = (form) => {
    setError(null);
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

  const field = (name, label, { rules = {}, ...props } = {}) => (
    <div>
      <label className="floating-label">
        <span>{label}</span>
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
    <form onSubmit={handleSubmit(register)} noValidate className="flex flex-col gap-4 p-4">
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
          rules: {
            ...required("First name"),
            maxLength: { value: 45, message: "First name must be 45 characters or fewer." },
          },
          autoComplete: "given-name",
        })}
        {field("last_name", "Last name", {
          rules: {
            ...required("Last name"),
            maxLength: { value: 45, message: "Last name must be 45 characters or fewer." },
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
            maxLength: { value: 100, message: "Email must be 100 characters or fewer." },
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
            maxLength: { value: 20, message: "Phone must be 20 characters or fewer." },
          },
          autoComplete: "tel",
        })}
        {field("dob", "Date of birth (optional)", { type: "date" })}
      </fieldset>

      <fieldset className="fieldset gap-4 rounded-box border border-base-300 p-4">
        <legend className="fieldset-legend">Password</legend>
        {field("password", "Password", {
          type: "password",
          rules: {
            required: "Password is required.",
            minLength: { value: 8, message: "Password must be at least 8 characters." },
            maxLength: { value: 36, message: "Password must be 36 characters or fewer." },
          },
          autoComplete: "new-password",
        })}
        {field("confirm", "Confirm password", {
          type: "password",
          rules: {
            required: "Please confirm your password.",
            validate: (v) => v === getValues("password") || "Passwords do not match.",
          },
          autoComplete: "new-password",
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
