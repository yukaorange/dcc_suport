import { eq, sql } from "drizzle-orm";
import type { DrizzleDb } from "./database";
import { sessions } from "./schema";

type InsertSessionInput = {
  readonly id: string;
  readonly goal: string;
  readonly referenceImagePath: string;
  readonly displayId: string;
  readonly displayName: string;
};

export type { InsertSessionInput };

export function insertSession(db: DrizzleDb, input: InsertSessionInput): void {
  db.insert(sessions)
    .values({
      id: input.id,
      goal: input.goal,
      referenceImagePath: input.referenceImagePath,
      displayId: input.displayId,
      displayName: input.displayName,
    })
    .run();
}

export function findSessionById(db: DrizzleDb, id: string) {
  return db.select().from(sessions).where(eq(sessions.id, id)).get() ?? null;
}

export function listSessions(db: DrizzleDb) {
  return db.select().from(sessions).orderBy(sql`started_at DESC`).all();
}

export function endSession(db: DrizzleDb, id: string): void {
  db.update(sessions).set({ endedAt: sql`datetime('now')` }).where(eq(sessions.id, id)).run();
}
