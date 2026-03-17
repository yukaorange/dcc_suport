import type { PlanStep } from "@dcc/core";
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
