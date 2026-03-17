import type { AppRouter } from "@dcc/server/trpc";
import { httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      splitLink({
        condition: (op) => op.type === "subscription",
        true: httpSubscriptionLink({ url: "/api/trpc" }),
        false: httpBatchLink({ url: "/api/trpc" }),
      }),
    ],
  });
}
