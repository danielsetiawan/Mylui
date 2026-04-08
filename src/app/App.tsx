import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { MonthRangeProvider } from "./contexts/MonthRangeContext";

export default function App() {
  return (
    <AuthProvider>
      {/* MonthRangeProvider must be inside AuthProvider so it can read user state */}
      <MonthRangeProvider>
        <Toaster position="bottom-center" richColors />
        <RouterProvider router={router} />
      </MonthRangeProvider>
    </AuthProvider>
  );
}
