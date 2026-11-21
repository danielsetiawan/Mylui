import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./layouts/Layout";
import { AuthGuard } from "./components/AuthGuard";

// Each page is its own chunk, so the first load only downloads the page being
// opened (e.g. Recharts ships only with the Dashboard). The <Suspense> fallback
// for pages inside the Layout lives in layouts/Layout.tsx.
const pageLoaders = {
  Dashboard: () => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
  Transactions: () => import("./pages/transactions").then((m) => ({ default: m.Transactions })),
  Planning: () => import("./pages/planning").then((m) => ({ default: m.Planning })),
  Notes: () => import("./pages/Notes").then((m) => ({ default: m.Notes })),
  SplitBill: () => import("./pages/split-bill").then((m) => ({ default: m.SplitBill })),
  Init: () => import("./pages/Init").then((m) => ({ default: m.Init })),
  WalletsPage: () => import("./pages/master-data/WalletsPage").then((m) => ({ default: m.WalletsPage })),
  CategoriesPage: () => import("./pages/master-data/CategoriesPage").then((m) => ({ default: m.CategoriesPage })),
};

const Dashboard = lazy(pageLoaders.Dashboard);
const Transactions = lazy(pageLoaders.Transactions);
const Planning = lazy(pageLoaders.Planning);
const Notes = lazy(pageLoaders.Notes);
const SplitBill = lazy(pageLoaders.SplitBill);
const Init = lazy(pageLoaders.Init);
const WalletsPage = lazy(pageLoaders.WalletsPage);
const CategoriesPage = lazy(pageLoaders.CategoriesPage);
const Login = lazy(() => import("./pages/Login").then((m) => ({ default: m.Login })));

// Once the first screen is up, fetch the remaining page chunks in the background
// so later navigation does not wait for a download.
if (typeof window !== "undefined") {
  const preloadPages = () => Object.values(pageLoaders).forEach((load) => load().catch(() => {}));
  window.addEventListener("load", () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(preloadPages, { timeout: 5000 });
    else setTimeout(preloadPages, 2000);
  }, { once: true });
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Login />
      </Suspense>
    ),
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
          {
            path: "master-data/wallets",
            Component: WalletsPage,
          },
          {
            path: "master-data/categories",
            Component: CategoriesPage,
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
