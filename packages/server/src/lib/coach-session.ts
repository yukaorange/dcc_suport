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
      if (activeState !== null) {
        activeState.abortController.abort();
        // 前ループの一時ファイルクリーンアップを待つ（current.png の競合防止）
        await activeState.loop.loopFinished.catch((err: unknown) => {
          console.warn("[coach-session] previous loop cleanup error:", err);
        });
      }

      const abortController = new AbortController();

      const applications = options.plan?.steps.map((s) => s.application) ?? [];
      const skillManifest = await loadSkillManifest(applications);

      const onEvent = (event: LoopEvent) => {
        console.log(`[coach] ${JSON.stringify(event)}`);
        deps.eventBus.publish({ ...event, sessionId: options.sessionId });

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
            break;
          case "plan_step_updated":
            updatePlanStepStatus(deps.db, options.sessionId, event.stepIndex, event.newStatus);
            break;
        }
      };

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

      const mySessionId = options.sessionId;
      loop.loopFinished
        .then(() => {
          deps.eventBus.publish({ kind: "stopped", sessionId: mySessionId });
        })
        .catch((err: unknown) => {
          deps.eventBus.publish({
            kind: "engine_error",
            message: String(err),
            sessionId: mySessionId,
          });
        })
        .finally(() => {
          endSession(deps.db, mySessionId);
          if (activeState?.sessionId === mySessionId) {
            activeState = null;
          }
        });
    },

    submitMessage: (sessionId, message) => {
      if (activeState === null || activeState.sessionId !== sessionId) {
        return { isOk: false, reason: "アクティブなセッションが見つかりません" };
      }
      activeState.loop.submitMessage(message);
      return { isOk: true };
    },

    stop: () => {
      activeState?.abortController.abort();
    },
  };
}
