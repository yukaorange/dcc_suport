import type { PlanStepStatus } from "@dcc/core";
import { useEffect, useRef } from "react";
import { trpc } from "../trpc";

type UseLoopEventsArgs = {
  readonly sessionId: string;
  readonly isEnabled: boolean;
  readonly onPlanStepUpdated?: (stepIndex: number, newStatus: PlanStepStatus) => void;
  // ラウンド実行中かどうかを上位 state に同期するためのコールバック。
  // querying で true、ラウンド終了系イベント（advice/silent/engine_error 等）で false。
  readonly onRoundActivity?: (isPending: boolean) => void;
  // ツール実行中の途中経過メッセージ。tool_activity イベント経由で届く。
  // null を渡すと進捗メッセージをクリアする意味。
  readonly onToolActivity?: (message: string | null) => void;
};

// SSE 購読の副作用フック。state を持たず、すべての更新は
// trpc.session.get のクエリキャッシュを single source of truth として書き換える。
// これにより client 側で「フック内 state とキャッシュの二重管理」が起きない。
export function useLoopEvents({
  sessionId,
  isEnabled,
  onPlanStepUpdated,
  onRoundActivity,
  onToolActivity,
}: UseLoopEventsArgs): void {
  const utils = trpc.useUtils();
  const onPlanStepUpdatedRef = useRef(onPlanStepUpdated);
  const onRoundActivityRef = useRef(onRoundActivity);
  const onToolActivityRef = useRef(onToolActivity);
  useEffect(() => {
    onPlanStepUpdatedRef.current = onPlanStepUpdated;
    onRoundActivityRef.current = onRoundActivity;
    onToolActivityRef.current = onToolActivity;
  });

  trpc.events.subscribe.useSubscription(
    { sessionId },
    {
      enabled: isEnabled,
      onData: (event) => {
        switch (event.kind) {
          case "querying":
            onRoundActivityRef.current?.(true);
            onToolActivityRef.current?.("AIに問い合わせ中...");
            break;
          case "tool_activity":
            onToolActivityRef.current?.(event.message);
            break;
          case "advice":
            utils.session.get.setData({ id: sessionId }, (prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                advices: [...prev.advices, { ...event.advice, isRestored: false }],
              };
            });
            onRoundActivityRef.current?.(false);
            onToolActivityRef.current?.(null);
            break;
          case "silent":
          case "engine_error":
          case "no_change":
          case "diff_skipped":
          case "session_lost":
          case "capture_failed":
            // ラウンドが何らかの理由で終了したケース。advice 以外でもローディング解除。
            onRoundActivityRef.current?.(false);
            onToolActivityRef.current?.(null);
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
            // 終端時にローディングが残らないようにクリア
            onRoundActivityRef.current?.(false);
            break;
          }
        }
      },
    },
  );
}
