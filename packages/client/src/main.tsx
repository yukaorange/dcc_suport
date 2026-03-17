import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./index.css";
import { createTrpcClient, trpc } from "./trpc";

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTrpcClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<Root />);
