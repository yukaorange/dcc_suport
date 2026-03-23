import { type Plan, type PlanStep, type PlanStepStatus, updateStepStatus } from "@dcc/core";
import { eq, sql } from "drizzle-orm";
import type { DrizzleDb } from "./database";
import { plans } from "./schema";

type InsertPlanInput = {
  readonly id: string;
  readonly sessionId: string;
  readonly goal: string;
  readonly referenceSummary: string;
  readonly steps: readonly PlanStep[];
};

export type { InsertPlanInput };

// @throws JSON.parse — steps カラムは内部で書き込んだJSONのため破損は想定外
export function parsePlanRow(row: { goal: string; referenceSummary: string; steps: string }): Plan {
  return {
    goal: row.goal,
    referenceSummary: row.referenceSummary,
    steps: JSON.parse(row.steps) as PlanStep[],
  };
}

// @throws JSON.parse — steps カラムは内部で書き込んだJSONのため破損は想定外
export function parseStepsJson(stepsJson: string | null): readonly PlanStep[] {
  if (stepsJson === null) return [];
  return JSON.parse(stepsJson) as PlanStep[];
}

export function insertPlan(db: DrizzleDb, input: InsertPlanInput): void {
  db.insert(plans)
    .values({
      id: input.id,
      sessionId: input.sessionId,
      goal: input.goal,
      referenceSummary: input.referenceSummary,
      steps: JSON.stringify(input.steps),
    })
    .run();
}

export function updatePlanStepStatus(
  db: DrizzleDb,
  sessionId: string,
  stepIndex: number,
  newStatus: PlanStepStatus,
): void {
  const row = db
    .select({ id: plans.id, goal: plans.goal, referenceSummary: plans.referenceSummary, steps: plans.steps })
    .from(plans)
    .where(eq(plans.sessionId, sessionId))
    .orderBy(sql`created_at DESC`)
    .limit(1)
    .get();

  if (row === undefined) return;

  // @throws JSON.parse — steps カラムは内部で書き込んだJSONのため破損は想定外
  const plan = parsePlanRow(row);
  const updated = updateStepStatus(plan, stepIndex, newStatus);

  db.update(plans)
    .set({ steps: JSON.stringify(updated.steps) })
    .where(eq(plans.id, row.id))
    .run();
}

export function findPlanBySessionId(db: DrizzleDb, sessionId: string) {
  return (
    db
      .select()
      .from(plans)
      .where(eq(plans.sessionId, sessionId))
      .orderBy(sql`created_at DESC`)
      .limit(1)
      .get() ?? null
  );
}
