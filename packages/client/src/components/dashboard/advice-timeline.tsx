import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">アドバイス履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">まだアドバイスがありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">アドバイス履歴 ({advices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {advices.map((advice) => (
              <div
                key={`advice-${advice.roundIndex}-${advice.timestampMs}`}
                className="rounded-xl border p-3 transition-colors hover:bg-accent/30"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                    Round {advice.roundIndex}
                  </span>
                  <span>{formatTime(advice.timestampMs)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{advice.content}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
