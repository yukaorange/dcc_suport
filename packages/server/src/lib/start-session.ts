import { unlink } from "node:fs/promises";
import type { Plan } from "@dcc/core";
import type { DrizzleDb } from "../db/database";
import { insertPlan } from "../db/plans";
import { insertSession, purgeOldSessions } from "../db/sessions";
import type { CoachSessionHandle } from "./coach-session";

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

export async function startSession(
  deps: StartSessionDeps,
  params: StartSessionParams,
): Promise<{ sessionId: string }> {
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

  setImmediate(() => {
    try {
      const purged = purgeOldSessions(deps.db, sessionId);
      for (const old of purged) {
        unlink(old.referenceImagePath).catch((err: NodeJS.ErrnoException) => {
          if (err.code !== "ENOENT") console.warn("[start-session] unlink failed:", err);
        });
      }
    } catch (e) {
      console.error("[start-session] purge failed:", e);
    }
  });

  return { sessionId };
}
