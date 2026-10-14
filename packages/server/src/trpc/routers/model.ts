import { TRPCError } from "@trpc/server";
import { createTaggedLogger } from "../../lib/logger";
import { publicProcedure, router } from "../trpc";

export const modelRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const log = createTaggedLogger("model.list");
    log.started();

    const result = await ctx.modelCatalog.list();
    if (!result.isOk) {
      log.failed(result.message);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `モデル一覧の取得に失敗しました: ${result.message}`,
      });
    }

    log.info(`models=${result.models.length}`);
    log.completed();
    return { models: result.models };
  }),
});
