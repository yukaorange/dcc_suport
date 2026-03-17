import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "../../trpc";

type DisplaySelectorProps = {
  readonly value: string;
  readonly onChange: (displayId: string, displayName: string) => void;
};

export function DisplaySelector({ value, onChange }: DisplaySelectorProps) {
  const { data, isLoading, error } = trpc.display.list.useQuery();

  if (error) return <p className="text-sm text-destructive">ディスプレイの取得に失敗しました</p>;

  const handleChange = (id: string) => {
    const name = data?.displays.find((d) => d.id === id)?.name ?? "";
    onChange(id, name);
  };

  return (
    <div className="space-y-2">
      <Label>モニターを選択</Label>
      <Select value={value} onValueChange={handleChange} disabled={isLoading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={isLoading ? "読み込み中..." : "ディスプレイを選択"} />
        </SelectTrigger>
        <SelectContent>
          {data?.displays.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
