import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { fetchAPI } from "../api.mjs";

const STORAGE_KEY = "auth-key";

export const AuthenticationContext = createContext(null);

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

/**
 * Access the authenticated user and auth actions.
 *
 * @param {string[] | null} restrictToRoles - When set, guests are sent to /login
 *   and users whose role isn't listed are sent home. Use "guest" to allow guests.
 */
export function useAuthenticate(restrictToRoles = null) {
  const [user, setUser, status, setStatus] = useContext(AuthenticationContext);
  const navigate = useNavigate();
  const location = useLocation();

  const getUser = useCallback(
    (authenticationKey) => {
      setStatus("loading");
      return fetchAPI("GET", "/user/self", null, authenticationKey)
        .then((response) => {
          if (response.status === 200) {
            setUser({ ...response.body, authenticationKey });
            setStatus("loaded");
          } else {
            localStorage.removeItem(STORAGE_KEY);
            setUser(null);
            setStatus(response.body.message ?? "invalid key");
          }
        })
        .catch((error) => {
          setStatus(error);
        });
    },
    [setUser, setStatus],
  );

  const login = useCallback(
    (username, password) => {
      setStatus("authenticating");
      fetchAPI("POST", "/authenticate", { username, password })
        .then((response) => {
          if (response.status === 200) {
            const authenticationKey = response.body.key;
            localStorage.setItem(STORAGE_KEY, authenticationKey);
            getUser(authenticationKey);
          } else {
            setStatus(response.body.message ?? "Login failed");
          }
        })
        .catch((error) => {
          setStatus(error);
        });
    },
    [setStatus, getUser],
  );

  // Drop the local session without calling the API (key already revoked/invalid).
  const expire = useCallback(
    (message = null) => {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setStatus(message);
    },
    [setUser, setStatus],
  );

  const logout = useCallback(() => {
    const authenticationKey = user?.authenticationKey;
    expire();
    if (authenticationKey) {
      fetchAPI("DELETE", "/authenticate", null, authenticationKey).catch(
        () => {},
      );
    }
    navigate("/");
  }, [user, expire, navigate]);

  const refresh = useCallback(() => {
    if (user) {
      getUser(user.authenticationKey);
    }
  }, [user, getUser]);

  // fetchAPI with the current user's key; a 401 means the key was revoked.
  const authFetch = useCallback(
    async (method, route, body = null) => {
      const response = await fetchAPI(
        method,
        route,
        body,
        user?.authenticationKey,
      );
      if (response.status === 401 && user) {
        expire("Your session has expired. Please log in again.");
      }
      return response;
    },
    [user, expire],
  );

  useEffect(() => {
    const settled = !["resuming", "loading", "authenticating"].includes(status);
    const role = user?.role ?? "guest";
    if (restrictToRoles && settled && !restrictToRoles.includes(role)) {
      if (user) {
        navigate("/");
      } else {
        navigate("/login", { state: { from: location.pathname } });
      }
    }
  }, [user, status, restrictToRoles, navigate, location.pathname]);

  return {
    user,
    login,
    logout,
    expire,
    refresh,
    authFetch,
    status,
  };
}
