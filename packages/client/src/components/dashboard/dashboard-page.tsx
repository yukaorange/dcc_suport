import type { PlanStepStatus } from "@dcc/core";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLoopEvents } from "../../hooks/use-loop-events";
import { trpc } from "../../trpc";
import { AdviceTimeline } from "./advice-timeline";
import { LatestAdvice } from "./latest-advice";
import { MessageInput } from "./message-input";
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
  onPlanStepUpdated,
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
  readonly onPlanStepUpdated: (stepIndex: number, newStatus: PlanStepStatus) => void;
  readonly children: ReactNode;
}) {
  const { adviceHistory, latestAdvice, isCoachingStopped } = useLoopEvents(
    sessionId,
    !initialStopped,
    { advices: initialAdvices, isStopped: initialStopped },
    onPlanStepUpdated,
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

      {!isCoachingStopped && <MessageInput sessionId={sessionId} />}

      <AdviceTimeline advices={adviceHistory} />
    </div>
  );
}

export function DashboardPage({ sessionId, onBackToSetup }: DashboardPageProps) {
  const { data } = trpc.session.get.useQuery({ id: sessionId });
  const utils = trpc.useUtils();

  const isDataLoaded = data !== undefined;
  const initialAdvices = data?.advices ?? [];
  const initialStopped = data?.session.endedAt !== null && data?.session.endedAt !== undefined;

  const handlePlanStepUpdated = (stepIndex: number, newStatus: PlanStepStatus) => {
    utils.session.get.setData({ id: sessionId }, (prev) => {
      if (prev?.plan === null || prev?.plan === undefined) return prev;
      return {
        ...prev,
        plan: {
          ...prev.plan,
          steps: prev.plan.steps.map((step) =>
            step.index === stepIndex ? { ...step, status: newStatus } : step,
          ),
        },
      };
    });
  };

  if (!isDataLoaded) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  return (
    <CoachingFeed
      sessionId={sessionId}
      initialAdvices={initialAdvices}
      initialStopped={initialStopped}
      onBackToSetup={onBackToSetup}
      onPlanStepUpdated={handlePlanStepUpdated}
    >
      {data.plan !== null && data.plan !== undefined && <PlanProgress plan={data.plan} />}
    </CoachingFeed>
  );
}
