import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { MonthRangeProvider } from "./contexts/MonthRangeContext";
import { WalletCategoryProvider } from "./contexts/WalletCategoryContext";
import { VisibilityProvider } from "./contexts/VisibilityContext";

export default function App() {
  return (
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
  );
}

