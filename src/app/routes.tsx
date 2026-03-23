import { createBrowserRouter } from "react-router";
import { Layout } from "./layouts/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { Planning } from "./pages/Planning";

export const router = createBrowserRouter([
  {
    path: "/",
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
    ],
  },
]);
