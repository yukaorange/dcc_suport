import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { findAdvicesBySessionId } from "../../db/advices";
import { findPlanBySessionId, parsePlanRow, parseStepsJson } from "../../db/plans";
import { findSessionById, listSessionsWithPlanSteps } from "../../db/sessions";
import { createTaggedLogger } from "../../lib/logger";
import { startSession } from "../../lib/start-session";
import { publicProcedure, router } from "../trpc";

export const sessionRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    const log = createTaggedLogger("session.list");
    log.started();

    const rows = listSessionsWithPlanSteps(ctx.db);
    log.info(`found ${rows.length} sessions`);
    log.completed();

    return {
      sessions: rows.map((row) => {
        const steps = parseStepsJson(row.steps);
        return {
          id: row.id,
          goal: row.goal,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
          stepCount: steps.length,
          completedStepCount: steps.filter((s) => s.status === "completed").length,
        };
      }),
    };
  }),

  get: publicProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) => {
    const log = createTaggedLogger("session.get");
    log.started();

    const session = findSessionById(ctx.db, input.id);
    if (session === null) {
      log.failed("session not found");
      throw new TRPCError({ code: "NOT_FOUND", message: "セッションが見つかりません" });
    }

    const planRow = findPlanBySessionId(ctx.db, input.id);
    const plan = planRow ? parsePlanRow(planRow) : null;
    const adviceRows = findAdvicesBySessionId(ctx.db, input.id);

    log.info(`advices=${adviceRows.length}, hasPlan=${plan !== null}`);
    log.completed();

    return {
      session,
      plan,
      advices: adviceRows.map((a) => ({
        content: a.content,
        roundIndex: a.roundIndex,
        timestampMs: a.timestampMs,
      })),
    };
  }),

  sendMessage: publicProcedure
    .input(z.object({ sessionId: z.string().uuid(), message: z.string().min(1).max(2000) }))
    .mutation(({ input, ctx }) => {
      const log = createTaggedLogger("session.sendMessage");
      log.info(
        `sessionId=${input.sessionId}, message="${input.message.slice(0, 50).replace(/[\r\n]/g, " ")}"`,
      );

      const result = ctx.coachSession.submitMessage(input.sessionId, input.message);
      if (!result.isOk) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      }

      return { success: true };
    }),

  restore: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const log = createTaggedLogger("session.restore");
    log.started();

    const session = findSessionById(ctx.db, input.id);
    if (session === null) {
      log.failed("session not found");
      throw new TRPCError({ code: "NOT_FOUND", message: "セッションが見つかりません" });
    }

    const planRow = findPlanBySessionId(ctx.db, input.id);
    const plan = planRow ? parsePlanRow(planRow) : null;

    const result = await startSession(
      { db: ctx.db, coachSession: ctx.coachSession },
      {
        goal: session.goal,
        referenceImagePath: session.referenceImagePath,
        displayId: session.displayId,
        displayName: session.displayName,
        plan,
      },
    );

    log.info(`restored as newSession=${result.sessionId}`);
    log.completed();
    return { sessionId: result.sessionId };
  }),
});
