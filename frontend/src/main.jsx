import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";

import "./index.css";
import Layout from "./Layout.jsx";
import { AuthenticationProvider } from "./authentication/useAuthenticate.jsx";
import LoginView from "./authentication/LoginView.jsx";
import RegisterView from "./authentication/RegisterView.jsx";
import TimetableView from "./sessions/TimetableView.jsx";
import BookingListView from "./bookings/BookingListView.jsx";
import BlogListView from "./blogs/BlogListView.jsx";
import BlogEditView from "./blogs/BlogEditView.jsx";
import ProfileView from "./users/ProfileView.jsx";
import PrivacyPolicyView from "./legal/PrivacyPolicyView.jsx";

const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      {
        index: true,
        Component: TimetableView,
      },
      {
        path: "/bookings",
        Component: BookingListView,
      },
      {
        path: "/blogs",
        Component: BlogListView,
      },
      {
        path: "/blogs/new",
        Component: BlogEditView,
      },
      {
        path: "/blogs/:blogId/edit",
        Component: BlogEditView,
      },
      {
        path: "/profile",
        Component: ProfileView,
      },
      {
        path: "/login",
        Component: LoginView,
      },
      {
        path: "/register",
        Component: RegisterView,
      },
      {
        path: "/privacy",
        Component: PrivacyPolicyView,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthenticationProvider>
      <RouterProvider router={router} />
    </AuthenticationProvider>
  </StrictMode>,
);
