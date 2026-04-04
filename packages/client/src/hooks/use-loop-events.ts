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
  readonly isPaused: boolean;
};

type LoopEventsResult = {
  readonly adviceHistory: readonly Advice[];
  readonly latestAdvice: Advice | null;
  readonly isCoachingStopped: boolean;
  readonly isCoachingPaused: boolean;
};

export function useLoopEvents(
  sessionId: string,
  isEnabled: boolean,
  initialState: InitialState,
  onPlanStepUpdated?: (stepIndex: number, newStatus: PlanStepStatus) => void,
): LoopEventsResult {
  const [adviceHistory, setAdviceHistory] = useState<readonly Advice[]>(initialState.advices);
  const [isCoachingStopped, setIsCoachingStopped] = useState(initialState.isStopped);
  const [isCoachingPaused, setIsCoachingPaused] = useState(initialState.isPaused);

  const prevSessionIdRef = useRef(sessionId);

  if (prevSessionIdRef.current !== sessionId) {
    prevSessionIdRef.current = sessionId;
    setAdviceHistory(initialState.advices);
    setIsCoachingStopped(initialState.isStopped);
    setIsCoachingPaused(initialState.isPaused);
  }

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
          case "paused":
            setIsCoachingPaused(true);
            break;
          case "resumed":
            setIsCoachingPaused(false);
            break;
          case "stopped":
            setIsCoachingStopped(true);
            break;
        }
      },
    },
  );

  const latestAdvice = adviceHistory.findLast((a) => !a.isRestored) ?? null;

  return { adviceHistory, latestAdvice, isCoachingStopped, isCoachingPaused };
}
