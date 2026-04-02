import { generatePlan } from "@dcc/core";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { saveBase64Images } from "../../lib/image-store";
import { createTaggedLogger } from "../../lib/logger";
import { publicProcedure, router } from "../trpc";

export const planRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        referenceImages: z
          .array(
            z.object({
              base64: z.string().max(14 * 1024 * 1024),
              fileName: z.string(),
              label: z.string().max(50).default(""),
            }),
          )
          .min(1)
          .max(5),
        goalDescription: z.string().min(5),
        revisionFeedback: z.string().optional(),
        previousPlanId: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const log = createTaggedLogger("plan.generate");
      log.started();
      log.info(`imageCount=${input.referenceImages.length}, goal="${input.goalDescription}"`);

      const imagesResult = await saveBase64Images(input.referenceImages);
      if (!imagesResult.isOk) {
        log.failed(`saveBase64Images: ${imagesResult.message}`);
        throw new TRPCError({ code: "BAD_REQUEST", message: imagesResult.message });
      }
      log.info(`images saved: ${imagesResult.filePaths.length} files`);

      const referenceImages = imagesResult.filePaths.map((filePath, i) => ({
        path: filePath,
        label: input.referenceImages[i].label,
      }));

      const previousPlan =
        input.previousPlanId !== undefined
          ? ctx.pendingPlanCache.get(input.previousPlanId)?.plan
          : undefined;

      log.info("calling generatePlan...");
      const planResult = await generatePlan({
        referenceImages,
        goalDescription: input.goalDescription,
        revisionFeedback: input.revisionFeedback,
        previousPlan,
      });
      log.info(`generatePlan result: isOk=${planResult.isOk}`);

      if (!planResult.isOk) {
        log.failed(`generatePlan: ${planResult.message}`);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: planResult.message });
      }

      const planId = crypto.randomUUID();
      ctx.pendingPlanCache.set(planId, {
        plan: planResult.plan,
        referenceImages,
        goalDescription: input.goalDescription,
      });

      log.completed();
      return { planId, plan: planResult.plan };
    }),
});
