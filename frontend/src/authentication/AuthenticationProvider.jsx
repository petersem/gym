import { useCallback, useEffect, useState } from "react";
import { fetchAPI } from "../api.mjs";
import { useRetryWhile } from "../common/useRetryWhile.jsx";
import {
  AuthenticationContext,
  STORAGE_KEY,
} from "./AuthenticationContext.mjs";

export function AuthenticationProvider({ children }) {
  // User and status state to be shared via context
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() =>
    localStorage.getItem(STORAGE_KEY) ? "resuming" : null,
  );
  const [unavailable, setUnavailable] = useState(false);

  // Attempt to reload user from auth-key saved in local storage
  const resume = useCallback(() => {
    const authenticationKey = localStorage.getItem(STORAGE_KEY);

    if (authenticationKey) {
      fetchAPI("GET", "/user/self", null, authenticationKey)
        .then((response) => {
          if (response.status === 200) {
            setUser({ ...response.body, authenticationKey });
            setStatus("loaded");
            setUnavailable(false);
          } else if (response.status >= 500) {
            // Keep the key: the server is unavailable, not rejecting it.
            setStatus(response.body.message ?? "Server error");
            setUnavailable(true);
          } else {
            localStorage.removeItem(STORAGE_KEY);
            setStatus(null);
            setUnavailable(false);
          }
        })
        .catch((error) => {
          setStatus(String(error));
          setUnavailable(true);
        });
    }
  }, [setUser, setStatus]);

  useEffect(() => {
    resume();
  }, [resume]);

  // Keep trying while the server is unavailable so the session recovers.
  useRetryWhile(unavailable, resume);

  // Provide user and status state to all children via context
  return (
    <AuthenticationContext.Provider value={[user, setUser, status, setStatus]}>
      {children}
    </AuthenticationContext.Provider>
  );
}
