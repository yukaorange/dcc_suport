import { generatePlan } from "@dcc/core";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { saveBase64Image } from "../../lib/image-store";
import { createTaggedLogger } from "../../lib/logger";
import { publicProcedure, router } from "../trpc";

export const planRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        referenceImageBase64: z.string().max(14 * 1024 * 1024),
        referenceFileName: z.string(),
        goalDescription: z.string().min(5),
        revisionFeedback: z.string().optional(),
        previousPlanId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const log = createTaggedLogger("plan.generate");
      log.started();

      const imageResult = await saveBase64Image(
        input.referenceImageBase64,
        input.referenceFileName,
      );
      if (!imageResult.isOk) {
        log.failed(imageResult.message);
        throw new TRPCError({ code: "BAD_REQUEST", message: imageResult.message });
      }
      log.info(`image saved: ${imageResult.filePath}`);

      const previousPlan =
        input.previousPlanId !== undefined
          ? ctx.pendingPlanCache.get(input.previousPlanId)?.plan
          : undefined;

      const planResult = await generatePlan({
        referenceImagePath: imageResult.filePath,
        goalDescription: input.goalDescription,
        revisionFeedback: input.revisionFeedback,
        previousPlan,
      });

      if (!planResult.isOk) {
        log.failed(planResult.message);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: planResult.message });
      }

      const planId = crypto.randomUUID();
      ctx.pendingPlanCache.set(planId, {
        plan: planResult.plan,
        referenceImagePath: imageResult.filePath,
        goalDescription: input.goalDescription,
      });

      log.completed();
      return { planId, plan: planResult.plan };
    }),
});
