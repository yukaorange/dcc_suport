import { eq, sql } from "drizzle-orm";
import type { DrizzleDb } from "./database";
import { advices } from "./schema";

type InsertAdviceInput = {
  readonly id: string;
  readonly sessionId: string;
  readonly planId: string | null;
  readonly roundIndex: number;
  readonly content: string;
  readonly timestampMs: number;
  readonly isRestored?: number;
};

export type { InsertAdviceInput };

export function insertAdvice(db: DrizzleDb, input: InsertAdviceInput): void {
  db.insert(advices)
    .values({
      id: input.id,
      sessionId: input.sessionId,
      planId: input.planId,
      roundIndex: input.roundIndex,
      content: input.content,
      timestampMs: input.timestampMs,
      isRestored: input.isRestored ?? 0,
    })
    .run();
}

export function findAdvicesBySessionId(db: DrizzleDb, sessionId: string) {
  return db
    .select()
    .from(advices)
    .where(eq(advices.sessionId, sessionId))
    .orderBy(sql`timestamp_ms ASC`)
    .all();
}

export function copyAdvicesToSession(
  db: DrizzleDb,
  sourceSessionId: string,
  targetSessionId: string,
  targetPlanId: string | null,
): void {
  const sourceAdvices = findAdvicesBySessionId(db, sourceSessionId);
  if (sourceAdvices.length === 0) return;

  for (const advice of sourceAdvices) {
    insertAdvice(db, {
      id: crypto.randomUUID(),
      sessionId: targetSessionId,
      planId: targetPlanId,
      roundIndex: advice.roundIndex,
      content: advice.content,
      timestampMs: advice.timestampMs,
      isRestored: 1,
    });
  }
}
