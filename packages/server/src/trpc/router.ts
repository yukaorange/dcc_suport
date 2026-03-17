import { displayRouter } from "./routers/display";
import { eventsRouter } from "./routers/events";
import { planRouter } from "./routers/plan";
import { sessionRouter } from "./routers/session";
import { setupRouter } from "./routers/setup";
import { router } from "./trpc";

const isDev = process.env.NODE_ENV !== "production";

export const appRouter = router({
  ...(isDev ? { debug: (await import("./routers/debug")).debugRouter } : {}),
  display: displayRouter,
  plan: planRouter,
  setup: setupRouter,
  session: sessionRouter,
  events: eventsRouter,
});

export type AppRouter = typeof appRouter;
