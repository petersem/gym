import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import packageJson from "../package.json";
import { TbLogout } from "react-icons/tb";
import {
  FaCalendarAlt,
  FaClipboardList,
  FaLock,
  FaMoon,
  FaNewspaper,
  FaSun,
  FaUserCircle,
  FaUserShield,
} from "react-icons/fa";
import { useAuthenticate } from "./authentication/useAuthenticate.jsx";
import { can } from "./common/permissions.mjs";
import UserBadge from "./common/UserBadge.jsx";
import PWAStatus from "./common/PWAStatus.jsx";

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    return ["luxury", "business", "coffee", "dim"].includes(savedTheme)
      ? "luxury"
      : "corporate";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    const backgroundColor = getComputedStyle(
      document.documentElement,
    ).getPropertyValue("--color-base-100");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", backgroundColor.trim());
  }, [theme]);
  return [theme, setTheme];
}

function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useTheme();

  const { user, logout } = useAuthenticate();

  const dockItems = [
    {
      path: "/",
      label: "Timetable",
      icon: FaCalendarAlt,
      active: location.pathname === "/",
      permission: "viewTimetable",
    },
    {
      path: "/bookings",
      label: "Bookings",
      icon: FaClipboardList,
      active: location.pathname.startsWith("/bookings"),
      permission: "readBookings",
    },
    {
      path: "/blogs",
      label: "Blog",
      icon: FaNewspaper,
      active: location.pathname.startsWith("/blogs"),
      permission: "readBlogs",
    },
    {
      path: "/profile",
      label: "Profile",
      icon: FaUserCircle,
      active: location.pathname.startsWith("/profile"),
      permission: "readProfile",
    },
    {
      path: "/privacy",
      label: "Privacy",
      icon: FaUserShield,
      active: location.pathname.startsWith("/privacy"),
    },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-base-100 pb-24 shadow">
      <header className="sticky top-0 z-20">
        <div className="navbar justify-between bg-base-100 shadow-sm">
          <button
            onClick={() => navigate("/")}
            className="btn btn-ghost shrink-0 gap-2 px-2 text-xl"
            aria-label="High Street Gym home"
          >
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded bg-[#d3ee78] font-['Barlow_Condensed',sans-serif] text-2xl font-bold text-black"
            >
              HSG
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span>High Street Gym</span>
              <span className="text-xs opacity-60">
                © 2026 v{packageJson.version}
              </span>
            </span>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            <UserBadge user={user} />
            <button
              onClick={() =>
                setTheme(theme === "luxury" ? "corporate" : "luxury")
              }
              className="btn btn-ghost btn-circle text-lg"
              aria-label="Toggle theme"
            >
              {theme === "luxury" ? <FaSun /> : <FaMoon />}
            </button>
            {user ? (
              <button
                onClick={() => logout()}
                className="btn btn-ghost btn-circle text-xl"
                aria-label="Log out"
              >
                <TbLogout />
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="btn btn-ghost btn-circle text-xl"
                aria-label="Log in"
              >
                <FaLock />
              </button>
            )}
          </div>
        </div>
      </header>
      <PWAStatus />
      <Outlet />
      <nav className="dock mx-auto max-w-xl">
        {dockItems.map(({ path, label, icon: Icon, active, permission }) => (
          <button
            key={path}
            disabled={permission && !can(user, permission)}
            onClick={() => navigate(path)}
            className={active ? "dock-active" : ""}
          >
            <Icon className="text-2xl" />
            <span className="dock-label">{label}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

export default Layout;
