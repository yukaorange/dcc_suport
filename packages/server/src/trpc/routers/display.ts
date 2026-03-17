import { listDisplays } from "@dcc/core";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../trpc";

export const displayRouter = router({
  list: publicProcedure.query(async () => {
    const result = await listDisplays();
    if (!result.isOk) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.message,
      });
    }
    return { displays: result.displays };
  }),
});
