import type { LoopMode, PlanStepStatus } from "@dcc/core";
import type { AppRouter } from "@dcc/server/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatEffectiveModelLabel, formatModelLabel } from "@/lib/model-label";
import { useLoopEvents } from "../../hooks/use-loop-events";
import { trpc } from "../../trpc";
import { ModelSelector } from "../shared/model-selector";
import { AdviceTimeline } from "./advice-timeline";
import { LatestAdvice } from "./latest-advice";
import { MessageInput } from "./message-input";
import { PlanProgress } from "./plan-progress";

type DashboardPageProps = {
  readonly sessionId: string;
  readonly onBackToSetup: () => void;
};

type SessionData = inferRouterOutputs<AppRouter>["session"]["get"];

/**
 * SSE state を持たないラッパー。session.get のクエリキャッシュを単一ソースとして
 * 扱い、children 経由で PlanProgress を分離する（RULE-012）。
 */
function CoachingFeed({
  sessionId,
  data,
  onBackToSetup,
  onPlanStepUpdated,
  children,
}: {
  readonly sessionId: string;
  readonly data: SessionData;
  readonly onBackToSetup: () => void;
  readonly onPlanStepUpdated: (stepIndex: number, newStatus: PlanStepStatus) => void;
  readonly children: ReactNode;
}) {
  const isCoachingStopped = data.session.endedAt !== null && data.session.endedAt !== undefined;
  const mode: LoopMode = data.mode ?? "manual";

  // 「次へ進む」押下からラウンド完了までのローディング表示用 state。
  // SSE の querying で立ち、advice/silent/engine_error 等で落ちる。
  // クリック直後の即時反応のため、MessageInput からも setter を叩ける。
  const [isRoundPending, setIsRoundPending] = useState(false);
  // ツール実行中の途中経過メッセージ。null = 進捗なし（通常表示に戻す）。
  const [toolActivityMessage, setToolActivityMessage] = useState<string | null>(null);

  useLoopEvents({
    sessionId,
    isEnabled: !isCoachingStopped,
    onPlanStepUpdated,
    onRoundActivity: setIsRoundPending,
    onToolActivity: setToolActivityMessage,
  });

  const utils = trpc.useUtils();
  // invalidate による再取得はしない: GET 応答が SSE の model_detected 反映より後に届くと
  // detectedModel が古い値に巻き戻るため、成功応答から selectedModel だけを書き換える。
  // 失敗時はキャッシュ未変更（楽観更新なし）なので巻き戻し処理も不要。
  const setModelMutation = trpc.session.setModel.useMutation({
    onSuccess: (response) => {
      utils.session.get.setData({ id: sessionId }, (prev) =>
        prev ? { ...prev, selectedModel: response.selectedModel } : prev,
      );
    },
  });

  const setModeMutation = trpc.session.setMode.useMutation({
    onMutate: async ({ mode: nextMode }) => {
      await utils.session.get.cancel({ id: sessionId });
      const prev = utils.session.get.getData({ id: sessionId });
      utils.session.get.setData({ id: sessionId }, (old) =>
        old ? { ...old, mode: nextMode } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.session.get.setData({ id: sessionId }, ctx.prev);
    },
    // mutation 成功/失敗いずれの場合も最終的にサーバーから取り直して single source of truth を担保。
    // SSE mode_changed と onError 巻き戻しが競合して逆転状態が残る race を防ぐ。
    onSettled: () => {
      utils.session.get.invalidate({ id: sessionId });
    },
  });

  const latestAdvice = data.advices.findLast((a) => !a.isRestored) ?? null;

  const badgeVariant = isCoachingStopped ? "secondary" : mode === "manual" ? "outline" : "default";
  const badgeLabel = isCoachingStopped ? "終了" : mode === "manual" ? "手動" : "自動";

  // ModelSelector と同一クエリキーのため、実際のfetchは共有キャッシュに集約される
  const { data: modelListData } = trpc.model.list.useQuery(undefined, {
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });

  // 「使用中」= SDK の init が報告した実モデル（ラウンド実行後に確定）、
  // 「使用予定」= 現在の選択（デフォルト含む）が次ラウンドで解決されるモデル
  const detectedLabel =
    data.detectedModel !== null
      ? formatModelLabel(data.detectedModel, modelListData?.models)
      : null;
  const plannedLabel = formatEffectiveModelLabel(
    data.selectedModel?.value ?? null,
    modelListData?.models,
  );
  const modelBadge =
    detectedLabel !== null
      ? {
          prefix: "使用中",
          label: detectedLabel,
          title: `SDKが報告した実際の使用モデル: ${data.detectedModel}`,
        }
      : plannedLabel !== null
        ? { prefix: "使用予定", label: plannedLabel, title: "次のラウンドで使用されるモデル" }
        : null;

  const handleToggleMode = (checked: boolean) => {
    setModeMutation.mutate({ sessionId, mode: checked ? "auto" : "manual" });
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <Badge variant={badgeVariant} className="rounded-full px-3 py-1">
          {badgeLabel}
        </Badge>
        {!isCoachingStopped && (
          <div className="flex items-center gap-2">
            <Switch
              checked={mode === "auto"}
              onCheckedChange={handleToggleMode}
              disabled={setModeMutation.isPending}
              aria-label="自動ループを切替"
            />
            <span className="text-sm text-muted-foreground">
              {mode === "auto" ? "自動ループ中" : "手動モード"}
            </span>
          </div>
        )}
        {!isCoachingStopped && (
          <div className="ml-auto flex items-center gap-2">
            <ModelSelector
              value={data.selectedModel?.value ?? null}
              onChange={(modelValue) => setModelMutation.mutate({ sessionId, model: modelValue })}
              disabled={setModelMutation.isPending}
            />
            {modelBadge !== null && (
              <Badge variant="outline" className="rounded-full px-3 py-1" title={modelBadge.title}>
                {modelBadge.prefix}: {modelBadge.label}
              </Badge>
            )}
          </div>
        )}
        {isCoachingStopped && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={onBackToSetup}>
            新規セットアップ
          </Button>
        )}
      </div>

      {setModelMutation.error !== null && (
        <p className="text-sm text-destructive">
          モデルの切替に失敗しました: {setModelMutation.error.message}
        </p>
      )}

      {latestAdvice !== null && (
        <LatestAdvice content={latestAdvice.content} roundIndex={latestAdvice.roundIndex} />
      )}

      {!isCoachingStopped && (
        <MessageInput
          sessionId={sessionId}
          mode={mode}
          isRoundPending={isRoundPending}
          onRoundPendingChange={setIsRoundPending}
          toolActivityMessage={toolActivityMessage}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">{children}</div>
        <div className="lg:col-span-2">
          <AdviceTimeline advices={data.advices} />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage({ sessionId, onBackToSetup }: DashboardPageProps) {
  const { data } = trpc.session.get.useQuery({ id: sessionId });
  const utils = trpc.useUtils();
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

  if (data === undefined) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  return (
    <CoachingFeed
      sessionId={sessionId}
      data={data}
      onBackToSetup={onBackToSetup}
      onPlanStepUpdated={handlePlanStepUpdated}
    >
      {data.plan !== null && data.plan !== undefined && (
        <PlanProgress plan={data.plan} onToggleStep={handleToggleStep} />
      )}
    </CoachingFeed>
  );
}
