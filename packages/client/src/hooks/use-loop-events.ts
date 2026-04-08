import type { PlanStepStatus } from "@dcc/core";
import { useEffect, useRef } from "react";
import { trpc } from "../trpc";

type UseLoopEventsArgs = {
  readonly sessionId: string;
  readonly isEnabled: boolean;
  readonly onPlanStepUpdated?: (stepIndex: number, newStatus: PlanStepStatus) => void;
};

// SSE 購読の副作用フック。state を持たず、すべての更新は
// trpc.session.get のクエリキャッシュを single source of truth として書き換える。
// これにより client 側で「フック内 state とキャッシュの二重管理」が起きない。
export function useLoopEvents({
  sessionId,
  isEnabled,
  onPlanStepUpdated,
}: UseLoopEventsArgs): void {
  const utils = trpc.useUtils();
  const onPlanStepUpdatedRef = useRef(onPlanStepUpdated);
  useEffect(() => {
    onPlanStepUpdatedRef.current = onPlanStepUpdated;
  });

  trpc.events.subscribe.useSubscription(
    { sessionId },
    {
      enabled: isEnabled,
      onData: (event) => {
        switch (event.kind) {
          case "advice":
            utils.session.get.setData({ id: sessionId }, (prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                advices: [...prev.advices, { ...event.advice, isRestored: false }],
              };
            });
            break;
          case "plan_step_updated":
            onPlanStepUpdatedRef.current?.(event.stepIndex, event.newStatus);
            break;
          case "mode_changed":
            utils.session.get.setData({ id: sessionId }, (prev) =>
              prev ? { ...prev, mode: event.mode } : prev,
            );
            break;
          case "stopped": {
            // 「stopped を受信したらループ終端」という契約を client 側でも担保する。
            // backend で endSession() が DB エラーで失敗したケースでも、
            // SSE で stopped を受信した時点で UI を終端状態にする。
            // setData のみで invalidate しないのは、refetch すると endedAt: null に
            // 巻き戻ってしまうため（DB 失敗時のセーフティネットを潰さない）。
            // ISO 文字列は formatDate(new Date(...)) でも正しく解釈される。
            utils.session.get.setData({ id: sessionId }, (prev) => {
              if (!prev) return prev;
              if (prev.session.endedAt !== null && prev.session.endedAt !== undefined) {
                return prev;
              }
              return {
                ...prev,
                session: { ...prev.session, endedAt: new Date().toISOString() },
              };
            });
            break;
          }
        }
      },
    },
  );
}
