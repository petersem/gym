import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuthenticate } from "./useAuthenticate.jsx";

function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status, user } = useAuthenticate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
      onSubmit={(e) => {
        e.preventDefault();
        login(username.trim(), password);
      }}
      className="flex flex-col items-center gap-4 p-4"
    >
      <h1 className="text-3xl">Member &amp; Trainer Login</h1>
      <label className="input w-full">
        <span className="label">email</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="grow"
          type="email"
          autoComplete="username"
          maxLength={100}
          required
        />
      </label>
      <label className="input w-full">
        <span className="label">password</span>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="grow"
          type="password"
          autoComplete="current-password"
          maxLength={72}
          required
        />
      </label>
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
