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
