import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LatestAdviceProps = {
  readonly content: string;
  readonly roundIndex: number;
};

export function LatestAdvice({ content, roundIndex }: LatestAdviceProps) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-lg">最新アドバイス (Round {roundIndex})</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}
