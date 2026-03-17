import { z } from "zod";
import { listSessions } from "../../db/sessions";
import { publicProcedure, router } from "../trpc";

export const debugRouter = router({
  ping: publicProcedure.query(() => {
    console.log("[debug.ping] called at", new Date().toISOString());
    return { pong: true, timestamp: Date.now() };
  }),

  ctx: publicProcedure.query(({ ctx }) => {
    const keys = Object.keys(ctx);
    console.log("[debug.ctx] keys:", keys);
    return { ctxKeys: keys };
  }),

  activeSession: publicProcedure.query(({ ctx }) => {
    const id = ctx.coachSession.getActiveSessionId();
    console.log("[debug.activeSession]", id);
    return { activeSessionId: id };
  }),

  dbStatus: publicProcedure.query(({ ctx }) => {
    const sessions = listSessions(ctx.db);
    console.log("[debug.dbStatus] sessions:", sessions.length);
    return {
      sessionCount: sessions.length,
      sessions: sessions.map((s) => ({ id: s.id, goal: s.goal, endedAt: s.endedAt })),
    };
  }),

  log: publicProcedure
    .input(z.object({ message: z.string() }))
    .mutation(({ input }) => {
      console.log("[debug.log]", input.message);
      return { logged: true };
    }),
});
