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

type CoachSessionHandle = {
  readonly getActiveSessionId: () => string | null;
  readonly start: (options: StartOptions) => Promise<void>;
  readonly stop: () => void;
};

export type { CoachSessionHandle, StartOptions };

export function createCoachSession(deps: CoachSessionDeps): CoachSessionHandle {
  let activeSessionId: string | null = null;
  let activeLoop: CoachLoopHandle | null = null;
  let abortController: AbortController | null = null;

  return {
    getActiveSessionId: () => activeSessionId,

    start: async (options) => {
      if (abortController !== null) {
        abortController.abort();
        // 前ループの一時ファイルクリーンアップを待つ（current.png の競合防止）
        if (activeLoop !== null) {
          await activeLoop.loopFinished.catch(() => {});
        }
      }

      activeSessionId = options.sessionId;
      abortController = new AbortController();

      const applications = options.plan?.steps.map((s) => s.application) ?? [];
      const skillManifest = await loadSkillManifest(applications);

      const onEvent = (event: LoopEvent) => {
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
        }
      };

      activeLoop = startCoachLoop({
        config: deps.config,
        signal: abortController.signal,
        onEvent,
        displayId: options.displayId,
        referenceImagePath: options.referenceImagePath,
        plan: options.plan,
        skillManifest,
      });

      const mySessionId = options.sessionId;
      activeLoop.loopFinished
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
          if (activeSessionId === mySessionId) {
            activeSessionId = null;
            activeLoop = null;
          }
        });
    },

    stop: () => {
      abortController?.abort();
    },
  };
}
