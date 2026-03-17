import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Advice = {
  readonly content: string;
  readonly roundIndex: number;
  readonly timestampMs: number;
};

type AdviceTimelineProps = {
  readonly advices: readonly Advice[];
};

function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function AdviceTimeline({ advices }: AdviceTimelineProps) {
  if (advices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">アドバイス履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">まだアドバイスがありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">アドバイス履歴 ({advices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {advices.map((advice) => (
              <div key={`advice-${advice.roundIndex}-${advice.timestampMs}`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Round {advice.roundIndex}</span>
                  <span>{formatTime(advice.timestampMs)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{advice.content}</p>
                <Separator className="mt-3" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
