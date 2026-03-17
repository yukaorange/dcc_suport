import type { Plan, PlanStep } from "@dcc/core";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { findAdvicesBySessionId } from "../../db/advices";
import { findPlanBySessionId, insertPlan } from "../../db/plans";
import { findSessionById, insertSession, listSessions } from "../../db/sessions";
import { createTaggedLogger } from "../../lib/logger";
import { publicProcedure, router } from "../trpc";

function parsePlanFromRow(row: { goal: string; referenceSummary: string; steps: string }): Plan {
  return {
    goal: row.goal,
    referenceSummary: row.referenceSummary,
    steps: JSON.parse(row.steps) as PlanStep[],
  };
}

export const sessionRouter = router({
  list: publicProcedure.query(({ ctx }) => {
    const log = createTaggedLogger("session.list");
    log.started();

    const rows = listSessions(ctx.db);
    log.info(`found ${rows.length} sessions`);
    log.completed();

    return {
      sessions: rows.map((row) => {
        const planRow = findPlanBySessionId(ctx.db, row.id);
        const steps: PlanStep[] = planRow ? (JSON.parse(planRow.steps) as PlanStep[]) : [];
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
    const plan = planRow ? parsePlanFromRow(planRow) : null;
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

  restore: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const log = createTaggedLogger("session.restore");
    log.started();

    const session = findSessionById(ctx.db, input.id);
    if (session === null) {
      log.failed("session not found");
      throw new TRPCError({ code: "NOT_FOUND", message: "セッションが見つかりません" });
    }

    const planRow = findPlanBySessionId(ctx.db, input.id);
    const plan = planRow ? parsePlanFromRow(planRow) : null;

    const newSessionId = crypto.randomUUID();

    insertSession(ctx.db, {
      id: newSessionId,
      goal: session.goal,
      referenceImagePath: session.referenceImagePath,
      displayId: session.displayId,
      displayName: session.displayName,
    });

    if (plan !== null && planRow !== null) {
      insertPlan(ctx.db, {
        id: crypto.randomUUID(),
        sessionId: newSessionId,
        goal: plan.goal,
        referenceSummary: plan.referenceSummary,
        steps: plan.steps,
      });
    }

    log.info(`restored as newSession=${newSessionId}`);

    await ctx.coachSession.start({
      sessionId: newSessionId,
      planId: planRow?.id ?? null,
      displayId: session.displayId,
      referenceImagePath: session.referenceImagePath,
      plan,
    });

    log.completed();
    return { sessionId: newSessionId };
  }),
});
