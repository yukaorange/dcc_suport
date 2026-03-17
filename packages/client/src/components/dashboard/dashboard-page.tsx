import type { ReactNode } from "react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLoopEvents } from "../../hooks/use-loop-events";
import { trpc } from "../../trpc";
import { AdviceTimeline } from "./advice-timeline";
import { LatestAdvice } from "./latest-advice";
import { PlanProgress } from "./plan-progress";

type DashboardPageProps = {
  readonly sessionId: string;
  readonly onBackToSetup: () => void;
};

/**
 * SSE state を持つラッパー。PlanProgress は children 経由で
 * SSE の再レンダリングから分離（RULE-012）。
 */
function CoachingFeed({
  sessionId,
  initialAdvices,
  initialStopped,
  onBackToSetup,
  children,
}: {
  readonly sessionId: string;
  readonly initialAdvices: readonly {
    content: string;
    roundIndex: number;
    timestampMs: number;
  }[];
  readonly initialStopped: boolean;
  readonly onBackToSetup: () => void;
  readonly children: ReactNode;
}) {
  // 3PL (tRPC useSubscription) に渡すオブジェクトの参照安定性が必要
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialAdvices/initialStoppedの参照安定化
  const initialState = useMemo(
    () => ({ advices: initialAdvices, isStopped: initialStopped }),
    [sessionId],
  );

  const { adviceHistory, latestAdvice, isCoachingStopped } = useLoopEvents(
    sessionId,
    !initialStopped,
    initialState,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">ダッシュボード</h2>
        <Badge variant={isCoachingStopped ? "secondary" : "default"}>
          {isCoachingStopped ? "終了" : "コーチング中"}
        </Badge>
        {isCoachingStopped && (
          <Button variant="outline" size="sm" onClick={onBackToSetup}>
            新規セットアップ
          </Button>
        )}
      </div>

      {latestAdvice !== null && (
        <LatestAdvice content={latestAdvice.content} roundIndex={latestAdvice.roundIndex} />
      )}

      {children}

      <AdviceTimeline advices={adviceHistory} />
    </div>
  );
}

export function DashboardPage({ sessionId, onBackToSetup }: DashboardPageProps) {
  const { data } = trpc.session.get.useQuery({ id: sessionId });

  const initialAdvices = data?.advices ?? [];
  const initialStopped = data?.session.endedAt !== null && data?.session.endedAt !== undefined;

  return (
    <CoachingFeed
      sessionId={sessionId}
      initialAdvices={initialAdvices}
      initialStopped={initialStopped}
      onBackToSetup={onBackToSetup}
    >
      {data?.plan !== null && data?.plan !== undefined && <PlanProgress plan={data.plan} />}
    </CoachingFeed>
  );
}
