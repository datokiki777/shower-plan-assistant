import { lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/app/layout/AppShell";

const DashboardPage = lazy(() => import("@/routes/DashboardPage"));
const JobsPage = lazy(() => import("@/routes/JobsPage"));
const JobDetailPage = lazy(() => import("@/routes/JobDetailPage"));
const ClientsPage = lazy(() => import("@/routes/ClientsPage"));
const ClientDetailPage = lazy(() => import("@/routes/ClientDetailPage"));
const GroupsPage = lazy(() => import("@/routes/GroupsPage"));
const LoadingPage = lazy(() => import("@/routes/LoadingPage"));
const WorkersPage = lazy(() => import("@/routes/WorkersPage"));
const TemplatesPage = lazy(() => import("@/routes/TemplatesPage"));
const SettingsPage = lazy(() => import("@/routes/SettingsPage"));
const NotFoundPage = lazy(() => import("@/routes/NotFoundPage"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "jobs", element: <JobsPage /> },
      { path: "jobs/:id", element: <JobDetailPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "clients/:id", element: <ClientDetailPage /> },
      { path: "groups", element: <GroupsPage /> },
      { path: "loading", element: <LoadingPage /> },
      { path: "loading/:id", element: <LoadingPage /> },
      { path: "periods", element: <WorkersPage /> },
      { path: "periods/:id", element: <WorkersPage /> },
      { path: "templates", element: <TemplatesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "settings/backup", element: <SettingsPage /> },
      { path: "settings/legacy-import", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);
