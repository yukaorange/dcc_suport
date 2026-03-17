import {
  type CoachConfig,
  type CoachLoopHandle,
  type LoopEvent,
  loadSkillManifest,
  type Plan,
  startCoachLoop,
} from "@dcc/core";
import { insertAdvice } from "../db/advices";
import type { DrizzleDb } from "../db/database";
import { updatePlanStepStatus } from "../db/plans";
import { endSession } from "../db/sessions";
import { createTaggedLogger } from "../lib/logger";
import type { EventBus } from "../pure/event-bus";

type CoachSessionDeps = {
  readonly config: CoachConfig;
  readonly eventBus: EventBus;
  readonly db: DrizzleDb;
};

type StartOptions = {
  readonly sessionId: string;
  readonly planId: string | null;
  readonly displayId?: string;
  readonly referenceImagePath: string | null;
  readonly plan: Plan | null;
};

type SubmitMessageResult =
  | { readonly isOk: true }
  | { readonly isOk: false; readonly reason: string };

type CoachSessionHandle = {
  readonly getActiveSessionId: () => string | null;
  readonly start: (options: StartOptions) => Promise<void>;
  readonly stop: () => void;
  readonly submitMessage: (sessionId: string, message: string) => SubmitMessageResult;
};

export type { CoachSessionHandle, StartOptions };

type ActiveState = {
  readonly sessionId: string;
  readonly loop: CoachLoopHandle;
  readonly abortController: AbortController;
};

export function createCoachSession(deps: CoachSessionDeps): CoachSessionHandle {
  let activeState: ActiveState | null = null;

  return {
    getActiveSessionId: () => activeState?.sessionId ?? null,

    start: async (options) => {
      const log = createTaggedLogger("coach-session");

      if (activeState !== null) {
        log.info(`stopping previous session=${activeState.sessionId}`);
        activeState.abortController.abort();
        await activeState.loop.loopFinished.catch((err: unknown) => {
          log.info(`previous loop cleanup error: ${String(err)}`);
        });
      }

      log.info(
        `starting session=${options.sessionId}, planId=${options.planId}, displayId=${options.displayId}`,
      );

      const abortController = new AbortController();

      const applications = options.plan?.steps.map((s) => s.application) ?? [];
      const skillManifest = await loadSkillManifest(applications);
      log.info(`skills loaded: ${skillManifest !== null ? "yes" : "none"}`);

      const onEvent = (event: LoopEvent) => {
        console.log(`[coach] ${JSON.stringify(event)}`);

        try {
          deps.eventBus.publish({ ...event, sessionId: options.sessionId });
        } catch (e) {
          log.failed(`eventBus.publish: ${String(e)}`);
        }

        try {
          switch (event.kind) {
            case "advice":
              insertAdvice(deps.db, {
                id: crypto.randomUUID(),
                sessionId: options.sessionId,
                planId: options.planId,
                roundIndex: event.advice.roundIndex,
                content: event.advice.content,
                timestampMs: event.advice.timestampMs,
              });
              log.info(`advice persisted (round=${event.advice.roundIndex})`);
              break;
            case "plan_step_updated":
              updatePlanStepStatus(deps.db, options.sessionId, event.stepIndex, event.newStatus);
              log.info(`step ${event.stepIndex} → ${event.newStatus}`);
              break;
          }
        } catch (e) {
          log.failed(`DB write: ${String(e)}`);
        }
      };

      log.info("starting coach loop...");
      const loop = startCoachLoop({
        config: deps.config,
        signal: abortController.signal,
        onEvent,
        displayId: options.displayId,
        referenceImagePath: options.referenceImagePath,
        plan: options.plan,
        skillManifest,
      });

      activeState = { sessionId: options.sessionId, loop, abortController };
      log.info("coach loop started");

      const mySessionId = options.sessionId;
      loop.loopFinished
        .then(() => {
          log.info(`loop finished normally session=${mySessionId}`);
          deps.eventBus.publish({ kind: "stopped", sessionId: mySessionId });
        })
        .catch((err: unknown) => {
          log.failed(`loop crashed session=${mySessionId}: ${String(err)}`);
          deps.eventBus.publish({
            kind: "engine_error",
            message: String(err),
            sessionId: mySessionId,
          });
        })
        .finally(() => {
          log.info(`ending session=${mySessionId}`);
          endSession(deps.db, mySessionId);
          if (activeState?.sessionId === mySessionId) {
            activeState = null;
          }
        });
    },

    submitMessage: (sessionId, message) => {
      const isActive = activeState !== null && activeState.sessionId === sessionId;
      console.log(
        `[coach-session] submitMessage session=${sessionId}, active=${isActive}, message="${message.slice(0, 50).replace(/[\r\n]/g, " ")}"`,
      );
      if (!isActive) {
        return { isOk: false, reason: "アクティブなセッションが見つかりません" };
      }
      activeState?.loop.submitMessage(message);
      return { isOk: true };
    },

    stop: () => {
      console.log(`[coach-session] stop requested, active=${activeState?.sessionId ?? "none"}`);
      activeState?.abortController.abort();
    },
  };
}
