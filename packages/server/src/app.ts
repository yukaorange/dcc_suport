import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { AppContext } from "./trpc/context";
import { appRouter } from "./trpc/router";

type AppDeps = {
  readonly createContext: () => AppContext;
};

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.use("/api/trpc/*", async (c) => {
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: deps.createContext,
    });
  });

  app.use("/*", serveStatic({ root: "./public" }));
  app.get("/*", serveStatic({ path: "./public/index.html" }));

  return app;
}
