import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Advice = {
  readonly content: string;
  readonly roundIndex: number;
  readonly timestampMs: number;
  readonly isRestored: boolean;
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

  const separatorIndex = advices.findIndex((a) => !a.isRestored);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">アドバイス履歴 ({advices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 pr-4">
            {advices.map((advice, index) => (
              <Fragment key={`advice-${advice.roundIndex}-${advice.timestampMs}`}>
                {index === separatorIndex && separatorIndex > 0 && (
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">今回のセッション</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-xl border p-3 transition-colors hover:bg-accent/30",
                    advice.isRestored && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                      {advice.isRestored ? "前回" : `Round ${advice.roundIndex}`}
                    </span>
                    <span>{formatTime(advice.timestampMs)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                    {advice.content}
                  </p>
                </div>
              </Fragment>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
