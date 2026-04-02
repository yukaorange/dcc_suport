import { eq, inArray, notInArray, sql } from "drizzle-orm";
import type { DrizzleDb } from "./database";
import { advices, plans, sessionImages, sessions } from "./schema";

type InsertSessionInput = {
  readonly id: string;
  readonly goal: string;
  readonly displayId: string;
  readonly displayName: string;
};

export type { InsertSessionInput };

export function insertSession(db: DrizzleDb, input: InsertSessionInput): void {
  db.insert(sessions)
    .values({
      id: input.id,
      goal: input.goal,
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
  readonly imageFilePaths: readonly string[];
};

export function purgeOldSessions(
  db: DrizzleDb,
  excludeSessionId: string,
): readonly PurgedSession[] {
  const rows = db
    .select({ id: sessions.id })
    .from(sessions)
    .orderBy(sql`${sessions.startedAt} DESC, ${sessions.id} DESC`)
    .limit(1_000_000)
    .offset(MAX_SESSIONS)
    .all();

  const targets = rows.filter((r) => r.id !== excludeSessionId);
  if (targets.length === 0) return [];

  const ids = targets.map((r) => r.id);

  // purge 対象セッションの画像パスを取得（削除前に）
  const targetImageRows = db
    .select({ filePath: sessionImages.filePath, sessionId: sessionImages.sessionId })
    .from(sessionImages)
    .where(inArray(sessionImages.sessionId, ids))
    .all();

  // 生存セッションがまだ参照中のパスは削除対象から除外
  const survivingPaths = new Set(
    db
      .select({ filePath: sessionImages.filePath })
      .from(sessionImages)
      .where(notInArray(sessionImages.sessionId, ids))
      .all()
      .map((r) => r.filePath),
  );

  db.transaction((tx) => {
    tx.delete(advices).where(inArray(advices.sessionId, ids)).run();
    tx.delete(plans).where(inArray(plans.sessionId, ids)).run();
    tx.delete(sessionImages).where(inArray(sessionImages.sessionId, ids)).run();
    tx.delete(sessions).where(inArray(sessions.id, ids)).run();
  });

  // セッションごとに削除可能な画像パスをまとめる
  const imagesBySession = new Map<string, string[]>();
  for (const row of targetImageRows) {
    if (survivingPaths.has(row.filePath)) continue;
    const existing = imagesBySession.get(row.sessionId) ?? [];
    existing.push(row.filePath);
    imagesBySession.set(row.sessionId, existing);
  }

  return targets.map((t) => ({
    id: t.id,
    imageFilePaths: imagesBySession.get(t.id) ?? [],
  }));
}
