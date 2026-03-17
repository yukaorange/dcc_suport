import { eq, inArray, notInArray, sql } from "drizzle-orm";
import type { DrizzleDb } from "./database";
import { advices, plans, sessions } from "./schema";

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

export function listSessionsWithPlanSteps(db: DrizzleDb) {
  return db
    .select({
      id: sessions.id,
      goal: sessions.goal,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      steps: plans.steps,
    })
    .from(sessions)
    .leftJoin(plans, eq(plans.sessionId, sessions.id))
    .orderBy(sql`${sessions.startedAt} DESC`)
    .all();
}

export function endSession(db: DrizzleDb, id: string): void {
  db.update(sessions).set({ endedAt: sql`datetime('now')` }).where(eq(sessions.id, id)).run();
}

const MAX_SESSIONS = 200;

type PurgedSession = {
  readonly id: string;
  readonly referenceImagePath: string;
};

export function purgeOldSessions(
  db: DrizzleDb,
  excludeSessionId: string,
): readonly PurgedSession[] {
  const rows = db
    .select({ id: sessions.id, referenceImagePath: sessions.referenceImagePath })
    .from(sessions)
    .orderBy(sql`${sessions.startedAt} DESC, ${sessions.id} DESC`)
    .limit(-1)
    .offset(MAX_SESSIONS)
    .all();

  const targets = rows.filter((r) => r.id !== excludeSessionId);
  if (targets.length === 0) return [];

  const ids = targets.map((r) => r.id);

  // 他のセッションがまだ参照中の画像パスは削除対象から除外する
  const survivingPaths = db
    .select({ referenceImagePath: sessions.referenceImagePath })
    .from(sessions)
    .where(notInArray(sessions.id, ids))
    .all()
    .map((r) => r.referenceImagePath);
  const stillReferencedPaths = new Set(survivingPaths);

  db.transaction((tx) => {
    tx.delete(advices).where(inArray(advices.sessionId, ids)).run();
    tx.delete(plans).where(inArray(plans.sessionId, ids)).run();
    tx.delete(sessions).where(inArray(sessions.id, ids)).run();
  });

  return targets.filter((r) => !stillReferencedPaths.has(r.referenceImagePath));
}
