import type { PlanStepStatus } from "@dcc/core";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { findAdvicesBySessionId } from "../../db/advices";
import { findPlanBySessionId, parsePlanRow, parseStepsJson, updatePlanStepStatus } from "../../db/plans";
import { advices, plans, sessions } from "../../db/schema";
import { endSession, findSessionById, listSessionsWithPlanSteps } from "../../db/sessions";
import { createTaggedLogger } from "../../lib/logger";
import { schedulePurge } from "../../lib/start-session";
import { publicProcedure, router } from "../trpc";

const planStepStatusSchema = z.enum(["pending", "in_progress", "completed"]) satisfies z.ZodType<PlanStepStatus>;

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

  get: publicProcedure.input(z.object({ id: z.string().uuid() })).query(({ input, ctx }) => {
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
        isRestored: a.isRestored === 1,
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

  updateStepStatus: publicProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        stepIndex: z.number().int().min(0),
        newStatus: planStepStatusSchema,
      }),
    )
    .mutation(({ input, ctx }) => {
      updatePlanStepStatus(ctx.db, input.sessionId, input.stepIndex, input.newStatus);
      return { success: true };
    }),

  restore: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const log = createTaggedLogger("session.restore");
      log.started();

      const session = findSessionById(ctx.db, input.id);
      if (session === null) {
        log.failed("session not found");
        throw new TRPCError({ code: "NOT_FOUND", message: "セッションが見つかりません" });
      }

      const planRow = findPlanBySessionId(ctx.db, input.id);
      const plan = planRow ? parsePlanRow(planRow) : null;

      const sessionId = crypto.randomUUID();
      const planId = plan !== null ? crypto.randomUUID() : null;

      // Phase 1: 全DB書き込みを単一トランザクションで実行
      log.info(`creating session=${sessionId}, copying advices from=${input.id}`);
      ctx.db.transaction((tx) => {
        tx.insert(sessions)
          .values({
            id: sessionId,
            goal: session.goal,
            referenceImagePath: session.referenceImagePath,
            displayId: session.displayId,
            displayName: session.displayName,
          })
          .run();

        if (plan !== null && planId !== null) {
          tx.insert(plans)
            .values({
              id: planId,
              sessionId,
              goal: plan.goal,
              referenceSummary: plan.referenceSummary,
              steps: JSON.stringify(plan.steps),
            })
            .run();
          log.info(`plan created planId=${planId}`);
        }

        // advices.ts の copyAdvicesToSession と同等のロジック（トランザクション内実行のためインライン化）
        const sourceAdvices = tx
          .select()
          .from(advices)
          .where(eq(advices.sessionId, input.id))
          .orderBy(sql`timestamp_ms ASC`)
          .all();

        for (const advice of sourceAdvices) {
          tx.insert(advices)
            .values({
              id: crypto.randomUUID(),
              sessionId,
              planId,
              roundIndex: advice.roundIndex,
              content: advice.content,
              timestampMs: advice.timestampMs,
              isRestored: 1,
            })
            .run();
        }

        log.info(`copied ${sourceAdvices.length} advices as restored`);
      });

      // Phase 2: コーチングループ起動（全DB書き込み成功後のみ到達）
      const restoredAdvices = findAdvicesBySessionId(ctx.db, sessionId).map((a) => ({
        content: a.content,
        roundIndex: a.roundIndex,
      }));

      log.info("starting coach loop for restored session...");
      try {
        await ctx.coachSession.start({
          sessionId,
          planId,
          displayId: session.displayId,
          referenceImagePath: session.referenceImagePath,
          plan,
          previousAdvices: restoredAdvices,
        });
      } catch (e) {
        endSession(ctx.db, sessionId);
        log.failed(`loop start failed, compensated with endSession: ${String(e)}`);
        throw e;
      }

      // Phase 3: 古いセッションのパージ（非同期）
      schedulePurge(ctx.db, sessionId);

      log.info(`restored as newSession=${sessionId}, copiedAdvicesFrom=${input.id}`);
      log.completed();
      return { sessionId };
    }),
});
