import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_MODEL_VALUE, formatModelItemLabel } from "@/lib/model-label";
import { trpc } from "../../trpc";

type ModelSelectorProps = {
  // null はデフォルトモデル（CLI設定に従う）
  readonly value: string | null;
  readonly onChange: (modelValue: string | null) => void;
  readonly disabled?: boolean;
};

export function ModelSelector({ value, onChange, disabled = false }: ModelSelectorProps) {
  const { data, isLoading, error } = trpc.model.list.useQuery(undefined, {
    // モデル一覧はサーバー側でプロセス生存中キャッシュされるため、クライアントも再取得しない
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });

  if (error !== null) {
    return (
      <p className="text-sm text-muted-foreground">
        モデル一覧を取得できませんでした（デフォルトモデルを使用します）
      </p>
    );
  }

  // SDK の一覧には "default" エントリ（解決先の実モデル名付き）が含まれるのでそれを使い、
  // 無い環境でのみ素朴なフォールバック項目を出す
  const hasDefaultEntry = data?.models.some((m) => m.value === DEFAULT_MODEL_VALUE) ?? true;

  const handleChange = (itemValue: string) => {
    // "default" 選択は「モデル未指定（CLI設定に従う）」として null にマッピングする
    onChange(itemValue === DEFAULT_MODEL_VALUE ? null : itemValue);
  };

  return (
    <Select
      value={value ?? DEFAULT_MODEL_VALUE}
      onValueChange={handleChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className="w-[280px]" aria-label="使用モデルを選択">
        <SelectValue placeholder={isLoading ? "読み込み中..." : "モデルを選択"} />
      </SelectTrigger>
      <SelectContent>
        {!hasDefaultEntry && <SelectItem value={DEFAULT_MODEL_VALUE}>デフォルト</SelectItem>}
        {data?.models.map((m) => (
          <SelectItem key={m.value} value={m.value} title={m.description}>
            {formatModelItemLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
