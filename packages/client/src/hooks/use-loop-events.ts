import type { PlanStepStatus } from "@dcc/core";
import { useEffect, useRef, useState } from "react";
import { trpc } from "../trpc";

type Advice = {
  readonly content: string;
  readonly roundIndex: number;
  readonly timestampMs: number;
  readonly isRestored: boolean;
};

type InitialState = {
  readonly advices: readonly Advice[];
  readonly isStopped: boolean;
};

type LoopEventsResult = {
  readonly adviceHistory: readonly Advice[];
  readonly latestAdvice: Advice | null;
  readonly isCoachingStopped: boolean;
};

export function useLoopEvents(
  sessionId: string,
  isEnabled: boolean,
  initialState: InitialState,
  onPlanStepUpdated?: (stepIndex: number, newStatus: PlanStepStatus) => void,
): LoopEventsResult {
  const [adviceHistory, setAdviceHistory] = useState<readonly Advice[]>(initialState.advices);
  const [isCoachingStopped, setIsCoachingStopped] = useState(initialState.isStopped);

  // sessionId 切替時のみ状態をリセット
  // DashboardPage が data ロード完了後にのみマウントするため、
  // useState の初期値で DB データは反映済み。以降は SSE が state を管理する。
  const prevSessionIdRef = useRef(sessionId);

  if (prevSessionIdRef.current !== sessionId) {
    prevSessionIdRef.current = sessionId;
    setAdviceHistory(initialState.advices);
    setIsCoachingStopped(initialState.isStopped);
  }

  // onPlanStepUpdated の最新参照を保持（SSE コールバック内で使うため）
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
            setAdviceHistory((prev) => [...prev, { ...event.advice, isRestored: false }]);
            break;
          case "plan_step_updated":
            onPlanStepUpdatedRef.current?.(event.stepIndex, event.newStatus);
            break;
          case "stopped":
            setIsCoachingStopped(true);
            break;
        }
      },
    },
  );

  const latestAdvice = adviceHistory.findLast((a) => !a.isRestored) ?? null;

  return { adviceHistory, latestAdvice, isCoachingStopped };
}
