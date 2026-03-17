import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "../../trpc";
import { SessionDetailPage } from "./session-detail-page";

type SessionListPageProps = {
  readonly onRestore: (sessionId: string) => void;
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionListPage({ onRestore }: SessionListPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, error } = trpc.session.list.useQuery();
  const restoreMutation = trpc.session.restore.useMutation();

  if (selectedId !== null) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedId(null)}>
          ← セッション一覧に戻る
        </Button>
        <SessionDetailPage sessionId={selectedId} />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">セッションの取得に失敗しました</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  const sessions = data?.sessions ?? [];

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">まだセッションがありません</p>
        </CardContent>
      </Card>
    );
  }

  const handleRestore = async (id: string) => {
    const result = await restoreMutation.mutateAsync({ id });
    onRestore(result.sessionId);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">セッション一覧</h2>

      {restoreMutation.error !== null && (
        <p className="text-sm text-destructive">{restoreMutation.error.message}</p>
      )}

      <div className="space-y-3">
        {sessions.map((session) => {
          const isActive = session.endedAt === null;
          return (
            <Card key={session.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle
                    className="text-base cursor-pointer"
                    onClick={() => setSelectedId(session.id)}
                  >
                    {session.goal}
                  </CardTitle>
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? "進行中" : "終了"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>開始: {formatDate(session.startedAt)}</p>
                    <p>
                      ステップ: {session.completedStepCount}/{session.stepCount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(session.id)}>
                      詳細
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleRestore(session.id)}
                      disabled={restoreMutation.isPending}
                    >
                      {restoreMutation.isPending ? "復元中..." : "復元"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
