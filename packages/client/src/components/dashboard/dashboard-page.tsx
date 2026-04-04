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
  initialPaused,
  onBackToSetup,
  onPlanStepUpdated,
  children,
}: {
  readonly sessionId: string;
  readonly initialAdvices: readonly {
    content: string;
    roundIndex: number;
    timestampMs: number;
    isRestored: boolean;
  }[];
  readonly initialStopped: boolean;
  readonly initialPaused: boolean;
  readonly onBackToSetup: () => void;
  readonly onPlanStepUpdated: (stepIndex: number, newStatus: PlanStepStatus) => void;
  readonly children: ReactNode;
}) {
  const { adviceHistory, latestAdvice, isCoachingStopped, isCoachingPaused } = useLoopEvents(
    sessionId,
    !initialStopped,
    { advices: initialAdvices, isStopped: initialStopped, isPaused: initialPaused },
    onPlanStepUpdated,
  );

  const feedUtils = trpc.useUtils();
  const pauseMutation = trpc.session.pause.useMutation({
    onSuccess: () => {
      feedUtils.session.get.setData({ id: sessionId }, (prev) =>
        prev ? { ...prev, isPaused: true } : prev,
      );
    },
  });
  const resumeMutation = trpc.session.resume.useMutation({
    onSuccess: () => {
      feedUtils.session.get.setData({ id: sessionId }, (prev) =>
        prev ? { ...prev, isPaused: false } : prev,
      );
    },
  });

  const handleTogglePause = () => {
    if (isCoachingPaused) {
      resumeMutation.mutate({ sessionId });
    } else {
      pauseMutation.mutate({ sessionId });
    }
  };

  const badgeVariant = isCoachingStopped ? "secondary" : isCoachingPaused ? "outline" : "default";
  const badgeLabel = isCoachingStopped ? "終了" : isCoachingPaused ? "一時停止中" : "コーチング中";

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <Badge variant={badgeVariant} className="rounded-full px-3 py-1">
          {badgeLabel}
        </Badge>
        {!isCoachingStopped && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTogglePause}
            disabled={pauseMutation.isPending || resumeMutation.isPending}
          >
            {isCoachingPaused ? "▶ 再開" : "⏸ 一時停止"}
          </Button>
        )}
        {isCoachingStopped && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={onBackToSetup}>
            新規セットアップ
          </Button>
        )}
      </div>

      {latestAdvice !== null && (
        <LatestAdvice content={latestAdvice.content} roundIndex={latestAdvice.roundIndex} />
      )}

      {!isCoachingStopped && <MessageInput sessionId={sessionId} isPaused={isCoachingPaused} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">{children}</div>
        <div className="lg:col-span-2">
          <AdviceTimeline advices={adviceHistory} />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ sessionId, onBackToSetup }: DashboardPageProps) {
  const { data } = trpc.session.get.useQuery({ id: sessionId });
  const utils = trpc.useUtils();

  const isDataLoaded = data !== undefined;
  const initialAdvices = data?.advices ?? [];
  const initialStopped = data?.session.endedAt !== null && data?.session.endedAt !== undefined;
  const initialPaused = data?.isPaused ?? false;

  const updateStepMutation = trpc.session.updateStepStatus.useMutation();

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

  const handleToggleStep = (stepIndex: number, newStatus: PlanStepStatus) => {
    handlePlanStepUpdated(stepIndex, newStatus);
    updateStepMutation.mutate({ sessionId, stepIndex, newStatus });
  };

  if (!isDataLoaded) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  return (
    <CoachingFeed
      sessionId={sessionId}
      initialAdvices={initialAdvices}
      initialStopped={initialStopped}
      initialPaused={initialPaused}
      onBackToSetup={onBackToSetup}
      onPlanStepUpdated={handlePlanStepUpdated}
    >
      {data.plan !== null && data.plan !== undefined && (
        <PlanProgress plan={data.plan} onToggleStep={handleToggleStep} />
      )}
    </CoachingFeed>
  );
}
