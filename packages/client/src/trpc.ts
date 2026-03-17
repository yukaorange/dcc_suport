import type { AppRouter } from "@dcc/server/trpc";
import type { CreateTRPCClient } from "@trpc/client";
import { httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import type { CreateTRPCReact } from "@trpc/react-query";
import { createTRPCReact } from "@trpc/react-query";

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>();

export function createTrpcClient(): CreateTRPCClient<AppRouter> {
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
