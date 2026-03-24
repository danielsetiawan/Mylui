import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="bottom-center" richColors />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
