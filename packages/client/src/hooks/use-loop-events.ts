import type { PlanStepStatus } from "@dcc/core";
import { useEffect, useRef, useState } from "react";
import { trpc } from "../trpc";

type Advice = {
  readonly content: string;
  readonly roundIndex: number;
  readonly timestampMs: number;
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

  // initialState の変更をstateに同期（DB hydration完了時 + sessionId切替時）
  const prevSessionIdRef = useRef(sessionId);
  const prevInitialStateRef = useRef(initialState);

  if (prevSessionIdRef.current !== sessionId || prevInitialStateRef.current !== initialState) {
    prevSessionIdRef.current = sessionId;
    prevInitialStateRef.current = initialState;
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
            setAdviceHistory((prev) => [...prev, event.advice]);
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

  const latestAdvice = adviceHistory.length > 0 ? adviceHistory[adviceHistory.length - 1] : null;

  return { adviceHistory, latestAdvice, isCoachingStopped };
}
