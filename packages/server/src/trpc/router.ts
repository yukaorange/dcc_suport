import { displayRouter } from "./routers/display";
import { eventsRouter } from "./routers/events";
import { modelRouter } from "./routers/model";
import { planRouter } from "./routers/plan";
import { sessionRouter } from "./routers/session";
import { setupRouter } from "./routers/setup";
import { systemRouter } from "./routers/system";
import { router } from "./trpc";

const isDev = process.env.NODE_ENV !== "production";

export const appRouter = router({
  ...(isDev ? { debug: (await import("./routers/debug")).debugRouter } : {}),
  display: displayRouter,
  model: modelRouter,
  plan: planRouter,
  setup: setupRouter,
  session: sessionRouter,
  events: eventsRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
