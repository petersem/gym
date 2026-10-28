import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { useAuthenticate } from "./useAuthenticate.jsx";

function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status, user } = useAuthenticate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ mode: "onBlur", reValidateMode: "onChange" });

  useEffect(() => {
    if (user) {
      navigate(location.state?.from ?? "/");
    }
  }, [user, navigate, location.state]);

  const busy = status === "authenticating" || status === "loading";
  const message =
    status &&
    !["authenticating", "loading", "loaded", "resuming"].includes(status)
      ? status
      : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((form) => login(form.username.trim(), form.password))}
      className="flex flex-col items-center gap-4 p-4"
    >
      <h1 className="text-3xl">Member &amp; Trainer Login</h1>
      <div className="w-full">
        <label className={`input w-full ${errors.username ? "input-error" : ""}`}>
          <span className="label">email</span>
          <input
            {...register("username", {
              required: "Email is required.",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Please enter a valid email address.",
              },
              maxLength: { value: 100, message: "Email must be 100 characters or fewer." },
            })}
            className="grow"
            type="email"
            autoComplete="username"
            aria-invalid={errors.username ? "true" : "false"}
          />
        </label>
        {errors.username && (
          <p role="alert" className="text-error text-sm mt-1">
            {errors.username.message}
          </p>
        )}
      </div>
      <div className="w-full">
        <label className={`input w-full ${errors.password ? "input-error" : ""}`}>
          <span className="label">password</span>
          <input
            {...register("password", {
              required: "Password is required.",
              maxLength: { value: 72, message: "Password must be 72 characters or fewer." },
            })}
            className="grow"
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? "true" : "false"}
          />
        </label>
        {errors.password && (
          <p role="alert" className="text-error text-sm mt-1">
            {errors.password.message}
          </p>
        )}
      </div>
      <button className="btn btn-primary btn-lg self-stretch" disabled={busy}>
        {busy ? (
          <span className="loading loading-spinner"></span>
        ) : (
          <span>Login</span>
        )}
      </button>
      {message && (
        <div
          role="alert"
          className="alert alert-soft alert-warning self-stretch"
        >
          {message}
        </div>
      )}
      <p>
        New to High Street Gym?{" "}
        <Link to="/register" className="link link-primary">
          Register as a member
        </Link>
      </p>
    </form>
  );
}

export default LoginView;
