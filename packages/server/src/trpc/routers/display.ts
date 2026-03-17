import { listDisplays } from "@dcc/core";
import { TRPCError } from "@trpc/server";
import { createTaggedLogger } from "../../lib/logger";
import { publicProcedure, router } from "../trpc";

export const displayRouter = router({
  list: publicProcedure.query(async () => {
    const log = createTaggedLogger("display.list");
    log.started();

    const result = await listDisplays();
    if (!result.isOk) {
      log.failed(result.message);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.message,
      });
    }

    log.info(`found ${result.displays.length} displays`);
    log.completed();
    return { displays: result.displays };
  }),
});
