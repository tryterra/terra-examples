import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRouter,
  RouterProvider,
  parseSearchWith,
  stringifySearchWith,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { queryClient } from "./lib/query-client";
import { routeTree } from "./routeTree.gen";
import "./index.css";

// Bare strings in the URL (?variantId=100011, not ?variantId=%22100011%22).
// The default serializer JSON-stringifies every value; routes String()-coerce
// on the way back in, so IDs survive the numeric round-trip.
const router = createRouter({
  routeTree,
  parseSearch: parseSearchWith(JSON.parse),
  stringifySearch: stringifySearchWith((v) =>
    typeof v === "string" ? v : JSON.stringify(v),
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
