import { useEffect, useState } from "react";
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
): LoopEventsResult {
  const [adviceHistory, setAdviceHistory] = useState<readonly Advice[]>(initialState.advices);
  const [isCoachingStopped, setIsCoachingStopped] = useState(initialState.isStopped);

  // sessionId or initialState変更時に状態を同期（SSE外部接続に伴う初期化のためuseEffect使用）
  // biome-ignore lint/correctness/useExhaustiveDependencies: sessionId変更時にリセットが必要
  useEffect(() => {
    setAdviceHistory(initialState.advices);
    setIsCoachingStopped(initialState.isStopped);
  }, [sessionId, initialState]);

  trpc.events.subscribe.useSubscription(
    { sessionId },
    {
      enabled: isEnabled,
      onData: (event) => {
        switch (event.kind) {
          case "advice":
            setAdviceHistory((prev) => [...prev, event.advice]);
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
