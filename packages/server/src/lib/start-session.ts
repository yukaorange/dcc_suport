import { unlink } from "node:fs/promises";
import type { Plan } from "@dcc/core";
import type { DrizzleDb } from "../db/database";
import { insertPlan } from "../db/plans";
import { insertSessionImages } from "../db/session-images";
import { insertSession, purgeOldSessions } from "../db/sessions";
import type { CoachSessionHandle } from "./coach-session";
import { createTaggedLogger } from "./logger";

type StartSessionDeps = {
  readonly db: DrizzleDb;
  readonly coachSession: CoachSessionHandle;
};

type StartSessionParams = {
  readonly goal: string;
  readonly referenceImages: readonly { readonly path: string; readonly label: string }[];
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
      // purgeOldSessions は session_images も含めてDBから削除し、
      // 削除可能な画像パスを戻り値に含めて返す
      const purged = purgeOldSessions(db, excludeSessionId);
      if (purged.length > 0) {
        log.info(`purged ${purged.length} old sessions`);
      }
      for (const old of purged) {
        for (const filePath of old.imageFilePaths) {
          unlink(filePath).catch((err: NodeJS.ErrnoException) => {
            if (err.code !== "ENOENT") log.failed(`unlink: ${String(err)}`);
          });
        }
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
    displayId: params.displayId,
    displayName: params.displayName,
  });

  if (params.referenceImages.length > 0) {
    insertSessionImages(
      deps.db,
      sessionId,
      params.referenceImages.map((img) => ({ filePath: img.path, label: img.label })),
      "reference",
    );
  }

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
    referenceImages: params.referenceImages,
    plan: params.plan,
  });

  schedulePurge(deps.db, sessionId);

  return { sessionId, planId };
}
