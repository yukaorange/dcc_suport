import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LatestAdviceProps = {
  readonly content: string;
  readonly roundIndex: number;
};

export function LatestAdvice({ content, roundIndex }: LatestAdviceProps) {
  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Latest Advice
          <span className="ml-2 text-sm font-normal text-muted-foreground">Round {roundIndex}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}
