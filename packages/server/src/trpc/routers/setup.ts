import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { insertPlan } from "../../db/plans";
import { insertSession } from "../../db/sessions";
import { createTaggedLogger } from "../../lib/logger";
import { publicProcedure, router } from "../trpc";

export const setupRouter = router({
  start: publicProcedure
    .input(
      z.object({
        displayId: z.string(),
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

      const sessionId = crypto.randomUUID();
      const dbPlanId = crypto.randomUUID();

      insertSession(ctx.db, {
        id: sessionId,
        goal: cached.goalDescription,
        referenceImagePath: cached.referenceImagePath,
        displayId: input.displayId,
        displayName: "",
      });

      insertPlan(ctx.db, {
        id: dbPlanId,
        sessionId,
        goal: cached.plan.goal,
        referenceSummary: cached.plan.referenceSummary,
        steps: cached.plan.steps,
      });

      ctx.pendingPlanCache.delete(input.planId);
      log.info(`session=${sessionId}, plan=${dbPlanId}`);

      await ctx.coachSession.start({
        sessionId,
        planId: dbPlanId,
        displayId: input.displayId,
        referenceImagePath: cached.referenceImagePath,
        plan: cached.plan,
      });

      log.completed();
      return { sessionId };
    }),
});
