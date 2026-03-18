import { unlink } from "node:fs/promises";
import type { Plan } from "@dcc/core";
import type { DrizzleDb } from "../db/database";
import { insertPlan } from "../db/plans";
import { insertSession, purgeOldSessions } from "../db/sessions";
import type { CoachSessionHandle } from "./coach-session";
import { createTaggedLogger } from "./logger";

type StartSessionDeps = {
  readonly db: DrizzleDb;
  readonly coachSession: CoachSessionHandle;
};

type StartSessionParams = {
  readonly goal: string;
  readonly referenceImagePath: string;
  readonly displayId: string;
  readonly displayName: string;
  readonly plan: Plan | null;
};

type SessionRecord = {
  readonly sessionId: string;
  readonly planId: string | null;
};

export type { StartSessionDeps, StartSessionParams, SessionRecord };

export function schedulePurge(db: DrizzleDb, excludeSessionId: string): void {
  setImmediate(() => {
    const log = createTaggedLogger("session.purge");
    try {
      // @throws — purge処理の失敗はバックグラウンドで握りつぶす
      const purged = purgeOldSessions(db, excludeSessionId);
      if (purged.length > 0) {
        log.info(`purged ${purged.length} old sessions`);
      }
      for (const old of purged) {
        unlink(old.referenceImagePath).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== "ENOENT") log.failed(`unlink: ${String(err)}`);
        });
      }
    } catch (e) {
      log.failed(`purge: ${String(e)}`);
    }
  });
}

export async function startSession(
  deps: StartSessionDeps,
  params: StartSessionParams,
): Promise<SessionRecord> {
  const sessionId = crypto.randomUUID();

  insertSession(deps.db, {
    id: sessionId,
    goal: params.goal,
    referenceImagePath: params.referenceImagePath,
    displayId: params.displayId,
    displayName: params.displayName,
  });

  let planId: string | null = null;
  if (params.plan !== null) {
    planId = crypto.randomUUID();
    insertPlan(deps.db, {
      id: planId,
      sessionId,
      goal: params.plan.goal,
      referenceSummary: params.plan.referenceSummary,
      steps: params.plan.steps,
    });
  }

  await deps.coachSession.start({
    sessionId,
    planId,
    displayId: params.displayId,
    referenceImagePath: params.referenceImagePath,
    plan: params.plan,
  });

  schedulePurge(deps.db, sessionId);

  return { sessionId, planId };
}
