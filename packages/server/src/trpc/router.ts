import { displayRouter } from "./routers/display";
import { router } from "./trpc";

export const appRouter = router({
  display: displayRouter,
});

export type AppRouter = typeof appRouter;
