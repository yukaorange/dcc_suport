import type { Plan } from "@dcc/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "../../trpc";
import { DisplaySelector } from "./display-selector";
import { GoalInput } from "./goal-input";
import { PlanReview } from "./plan-review";
import { type ReferenceImage, ReferenceUploader } from "./reference-uploader";

type SetupPhase = "input" | "reviewing";

type SetupPageProps = {
  readonly onCoachingStarted: (sessionId: string) => void;
};

export function SetupPage({ onCoachingStarted }: SetupPageProps) {
  const [phase, setPhase] = useState<SetupPhase>("input");
  const [displayId, setDisplayId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [referenceImages, setReferenceImages] = useState<readonly ReferenceImage[]>([]);
  const [goal, setGoal] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);

  const generateMutation = trpc.plan.generate.useMutation();
  const startMutation = trpc.setup.start.useMutation();

  const isInputValid = displayId !== "" && referenceImages.length > 0 && goal.length >= 5;

  const handleGeneratePlan = async () => {
    if (referenceImages.length === 0) return;

    const result = await generateMutation.mutateAsync({
      referenceImages: referenceImages.map((img) => ({
        base64: img.base64,
        fileName: img.fileName,
        label: img.label,
      })),
      goalDescription: goal,
    });

    setPlanId(result.planId);
    setPlan(result.plan);
    setPhase("reviewing");
  };

  const handleRegenerate = async (feedback: string) => {
    if (referenceImages.length === 0 || planId === null) return;

    const result = await generateMutation.mutateAsync({
      referenceImages: referenceImages.map((img) => ({
        base64: img.base64,
        fileName: img.fileName,
        label: img.label,
      })),
      goalDescription: goal,
      revisionFeedback: feedback,
      previousPlanId: planId,
    });

    setPlanId(result.planId);
    setPlan(result.plan);
  };

  const handleApprove = async () => {
    if (planId === null) return;

    const result = await startMutation.mutateAsync({
      displayId,
      displayName,
      planId,
    });

    onCoachingStarted(result.sessionId);
  };

  switch (phase) {
    case "input":
      return (
        <Card>
          <CardHeader>
            <CardTitle>セットアップ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DisplaySelector
              value={displayId}
              onChange={(id, name) => {
                setDisplayId(id);
                setDisplayName(name);
              }}
            />
            <ReferenceUploader images={referenceImages} onImagesChanged={setReferenceImages} />
            <GoalInput value={goal} onChange={setGoal} />

            {generateMutation.error !== null && (
              <p className="text-sm text-destructive">{generateMutation.error.message}</p>
            )}

            <Button
              onClick={handleGeneratePlan}
              disabled={!isInputValid || generateMutation.isPending}
            >
              {generateMutation.isPending ? "プラン生成中..." : "プランを生成"}
            </Button>
          </CardContent>
        </Card>
      );
    case "reviewing":
      if (plan === null) return null;
      return (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setPhase("input")}>
            ← 入力に戻る
          </Button>
          <PlanReview
            plan={plan}
            isRegenerating={generateMutation.isPending}
            onApprove={handleApprove}
            onRegenerate={handleRegenerate}
          />
          {startMutation.error !== null && (
            <p className="text-sm text-destructive">{startMutation.error.message}</p>
          )}
          {startMutation.isPending && (
            <p className="text-sm text-muted-foreground">コーチング開始中...</p>
          )}
        </div>
      );
  }
}
