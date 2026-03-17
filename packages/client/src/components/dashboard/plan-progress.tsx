import type { Plan } from "@dcc/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlanProgressProps = {
  readonly plan: Plan;
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed":
      return "default";
    case "in_progress":
      return "secondary";
    default:
      return "outline";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "完了";
    case "in_progress":
      return "進行中";
    case "pending":
      return "待機中";
    default:
      return status;
  }
}

export function PlanProgress({ plan }: PlanProgressProps) {
  const completedCount = plan.steps.filter((s) => s.status === "completed").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          プラン進捗 ({completedCount}/{plan.steps.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {plan.steps.map((step) => (
            <li key={`step-${step.index}`} className="flex items-center gap-2">
              <Badge variant={statusVariant(step.status)} className="shrink-0 text-xs">
                {statusLabel(step.status)}
              </Badge>
              <span className="text-sm">{step.description}</span>
              <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                {step.application}
              </Badge>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
