import type { Plan } from "@dcc/core";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type PlanReviewProps = {
  readonly plan: Plan;
  readonly isRegenerating: boolean;
  readonly onApprove: () => void;
  readonly onRegenerate: (feedback: string) => void;
};

export function PlanReview({ plan, isRegenerating, onApprove, onRegenerate }: PlanReviewProps) {
  const [feedback, setFeedback] = useState("");
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);

  const handleRegenerate = () => {
    if (feedback.length === 0) return;
    onRegenerate(feedback);
    setFeedback("");
    setIsEditingFeedback(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">生成されたプラン</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">目標</p>
            <p>{plan.goal}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">参考画像の分析</p>
            <p className="text-sm">{plan.referenceSummary}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">ステップ</p>
            <ol className="space-y-2">
              {plan.steps.map((step) => (
                <li key={`step-${step.index}`} className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5 shrink-0">
                    {step.index}
                  </Badge>
                  <div>
                    <p className="font-medium">{step.description}</p>
                    <Badge variant="secondary" className="mt-1">
                      {step.application}
                    </Badge>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={onApprove} disabled={isRegenerating}>
          このプランで開始
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsEditingFeedback(!isEditingFeedback)}
          disabled={isRegenerating}
        >
          修正を依頼
        </Button>
      </div>

      {isEditingFeedback && (
        <div className="space-y-2">
          <Textarea
            placeholder="修正内容を入力してください"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
          />
          <Button
            onClick={handleRegenerate}
            disabled={feedback.length === 0 || isRegenerating}
            variant="secondary"
          >
            {isRegenerating ? "再生成中..." : "再生成"}
          </Button>
        </div>
      )}
    </div>
  );
}
