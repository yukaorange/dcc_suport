import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MIN_LENGTH = 5;

type GoalInputProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

export function GoalInput({ value, onChange }: GoalInputProps) {
  const isTooShort = value.length > 0 && value.length < MIN_LENGTH;

  return (
    <div className="space-y-2">
      <Label>学習目標</Label>
      <Textarea
        placeholder="例: 写真のレタッチ技術を学びたい（5文字以上）"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
      />
      {isTooShort && <p className="text-sm text-destructive">5文字以上で入力してください</p>}
    </div>
  );
}
