import { useEffect, useState } from "react";
import { fetchAPI } from "../api.mjs";
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

  // Attempt to reload user from auth-key saved in local storage
  useEffect(() => {
    const authenticationKey = localStorage.getItem(STORAGE_KEY);

    if (authenticationKey) {
      fetchAPI("GET", "/user/self", null, authenticationKey)
        .then((response) => {
          if (response.status === 200) {
            setUser({ ...response.body, authenticationKey });
            setStatus("loaded");
          } else {
            localStorage.removeItem(STORAGE_KEY);
            setStatus(null);
          }
        })
        .catch(() => {
          setStatus(null);
        });
    }
  }, [setUser, setStatus]);

  // Provide user and status state to all children via context
  return (
    <AuthenticationContext.Provider value={[user, setUser, status, setStatus]}>
      {children}
    </AuthenticationContext.Provider>
  );
}
