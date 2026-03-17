import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "../../trpc";
import { AdviceTimeline } from "../dashboard/advice-timeline";
import { PlanProgress } from "../dashboard/plan-progress";

type SessionDetailPageProps = {
  readonly sessionId: string;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ja-JP");
}

export function SessionDetailPage({ sessionId }: SessionDetailPageProps) {
  const { data, isLoading, error } = trpc.session.get.useQuery({ id: sessionId });

  if (error) {
    return <p className="text-sm text-destructive">セッションの取得に失敗しました</p>;
  }

  if (isLoading || data === undefined) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  const { session, plan, advices } = data;
  const isActive = session.endedAt === null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{session.goal}</CardTitle>
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "進行中" : "終了"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>開始: {formatDate(session.startedAt)}</p>
          {session.endedAt !== null && <p>終了: {formatDate(session.endedAt)}</p>}
        </CardContent>
      </Card>

      {plan !== null && <PlanProgress plan={plan} />}

      <AdviceTimeline advices={advices} />
    </div>
  );
}
