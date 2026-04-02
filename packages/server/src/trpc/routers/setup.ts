import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTaggedLogger } from "../../lib/logger";
import { startSession } from "../../lib/start-session";
import { publicProcedure, router } from "../trpc";

export const setupRouter = router({
  start: publicProcedure
    .input(
      z.object({
        displayId: z.string(),
        displayName: z.string(),
        planId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const log = createTaggedLogger("setup.start");
      log.started();

      const cached = ctx.pendingPlanCache.get(input.planId);
      if (cached === null) {
        log.failed("plan not found in cache");
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "プランが見つかりません。再生成してください。",
        });
      }

      ctx.pendingPlanCache.delete(input.planId);

      const result = await startSession(
        { db: ctx.db, coachSession: ctx.coachSession },
        {
          goal: cached.goalDescription,
          referenceImages: cached.referenceImages,
          displayId: input.displayId,
          displayName: input.displayName,
          plan: cached.plan,
        },
      );

      log.info(`session=${result.sessionId}`);
      log.completed();
      return { sessionId: result.sessionId };
    }),
});
