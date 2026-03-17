import { z } from "zod";
import { createTaggedLogger } from "../../lib/logger";
import type { TaggedLoopEvent } from "../../pure/event-bus";
import { publicProcedure, router } from "../trpc";

export const eventsRouter = router({
  subscribe: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .subscription(async function* ({ input, ctx }) {
      const log = createTaggedLogger("events.subscribe");
      log.info(`connected sessionId=${input.sessionId}`);

      const queue: TaggedLoopEvent[] = [];
      let resolve: (() => void) | null = null;

      const unsubscribe = ctx.eventBus.subscribe((event) => {
        if (event.sessionId !== input.sessionId) return;
        queue.push(event);
        resolve?.();
      });

      try {
        while (true) {
          if (queue.length === 0) {
            await new Promise<void>((r) => {
              resolve = r;
            });
          }
          while (queue.length > 0) {
            const event = queue.shift();
            if (event !== undefined) {
              yield event;
            }
          }
        }
      } finally {
        log.info(`disconnected sessionId=${input.sessionId}`);
        unsubscribe();
      }
    }),
});
