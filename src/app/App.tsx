import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { MonthRangeProvider } from "./contexts/MonthRangeContext";
import { WalletCategoryProvider } from "./contexts/WalletCategoryContext";

export default function App() {
  return (
    <AuthProvider>
      <MonthRangeProvider>
        <WalletCategoryProvider>
          <Toaster position="bottom-center" richColors />
          <RouterProvider router={router} />
        </WalletCategoryProvider>
      </MonthRangeProvider>
    </AuthProvider>
  );
}

