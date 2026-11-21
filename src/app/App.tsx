import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { MonthRangeProvider } from "./contexts/MonthRangeContext";
import { WalletCategoryProvider } from "./contexts/WalletCategoryContext";
import { VisibilityProvider } from "./contexts/VisibilityContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MonthRangeProvider>
          <WalletCategoryProvider>
            <VisibilityProvider>
              <Toaster position="bottom-center" richColors />
              <RouterProvider router={router} />
            </VisibilityProvider>
          </WalletCategoryProvider>
        </MonthRangeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

