import type { Plan, PlanStepStatus } from "@dcc/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type PlanProgressProps = {
  readonly plan: Plan;
  readonly onToggleStep?: (stepIndex: number, newStatus: PlanStepStatus) => void;
};

function statusVariant(status: PlanStepStatus): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "in_progress":
      return "secondary";
    case "pending":
      return "outline";
  }
}

function statusLabel(status: PlanStepStatus): string {
  switch (status) {
    case "completed":
      return "完了";
    case "in_progress":
      return "進行中";
    case "pending":
      return "待機中";
  }
}

export function PlanProgress({ plan, onToggleStep }: PlanProgressProps) {
  const completedCount = plan.steps.filter((s) => s.status === "completed").length;
  const progressPercent = plan.steps.length > 0 ? (completedCount / plan.steps.length) * 100 : 0;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            プラン進捗 ({completedCount}/{plan.steps.length})
          </CardTitle>
          <span className="text-sm font-medium text-muted-foreground">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {plan.steps.map((step) => {
            const isCompleted = step.status === "completed";
            return (
              <li
                key={`step-${step.index}`}
                className="flex items-start gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/30"
              >
                {onToggleStep !== undefined && (
                  <Checkbox
                    checked={isCompleted}
                    onCheckedChange={() =>
                      onToggleStep(step.index, isCompleted ? "pending" : "completed")
                    }
                    className="mt-0.5 shrink-0"
                  />
                )}
                <Badge
                  variant={statusVariant(step.status)}
                  className="mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs"
                >
                  {statusLabel(step.status)}
                </Badge>
                <span className="flex-1 text-sm leading-relaxed">{step.description}</span>
                <Badge variant="outline" className="shrink-0 rounded-full px-2.5 py-0.5 text-xs">
                  {step.application}
                </Badge>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
