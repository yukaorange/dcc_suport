import { generatePlan, type ModelChoice } from "@dcc/core";
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
        model: z.string().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const log = createTaggedLogger("plan.generate");
      log.started();
      log.info(`imageCount=${input.referenceImages.length}, goal="${input.goalDescription}"`);

      // モデル指定はカタログ照合のホワイトリスト検証を通ったものだけ受け入れる
      let selectedModel: ModelChoice | null = null;
      if (input.model !== undefined) {
        selectedModel = await ctx.modelCatalog.findByValue(input.model);
        if (selectedModel === null) {
          log.failed(`unknown model: ${input.model}`);
          throw new TRPCError({ code: "BAD_REQUEST", message: "指定されたモデルは利用できません" });
        }
      }

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
        model: selectedModel?.value,
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
        model:
          selectedModel === null
            ? null
            : { value: selectedModel.value, supportsEffort: selectedModel.supportsEffort },
      });

      log.completed();
      return { planId, plan: planResult.plan };
    }),
});
