import { RouterProvider } from "react-router";
import { router } from "./routes";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { MonthRangeProvider } from "./contexts/MonthRangeContext";
import { WalletCategoryProvider } from "./contexts/WalletCategoryContext";
import { VisibilityProvider } from "./contexts/VisibilityContext";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient } from "./lib/queryClient";
import { CACHE_VERSION, MAX_AGE, queryPersister, shouldPersistQuery } from "./lib/queryPersist";

export default function App() {
  return (
    // The last data of the main pages is kept in the browser and shown at once
    // on the next visit, while it refreshes from Supabase (lib/queryPersist.ts)
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: MAX_AGE,
        buster: CACHE_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
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
    </PersistQueryClientProvider>
  );
}

