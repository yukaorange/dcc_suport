import { publicProcedure, router } from "../trpc";

export const systemRouter = router({
  sdkVersion: publicProcedure.query(({ ctx }) => ctx.sdkVersionStatus),
});
