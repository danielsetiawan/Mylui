import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./layouts/Layout";
import { AuthGuard } from "./components/AuthGuard";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/transactions";
import { Planning } from "./pages/planning";
import { Notes } from "./pages/Notes";
import { Login } from "./pages/Login";
import { SplitBill } from "./pages/split-bill";
import { Init } from "./pages/Init";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: AuthGuard,
    children: [
      {
        Component: Layout,
        children: [
          {
            index: true,
            Component: Dashboard,
          },
          {
            path: "transactions",
            Component: Transactions,
          },
          {
            path: "planning",
            Component: Planning,
          },
          {
            path: "notes",
            Component: Notes,
          },
          {
            path: "split-bill",
            Component: SplitBill,
          },
          {
            path: "init",
            Component: Init,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
