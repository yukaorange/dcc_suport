// モデルID・エイリアスを人が読める表示名へ解決する純関数群。
// SDK の supportedModels は value（エイリアス）と resolvedModel（実モデルID）を持ち、
// init メッセージの実モデル名は日付付きID（claude-opus-5-5-20251101 等）で届くため、
// この3者を突き合わせて表示名に変換する。

type ModelOption = {
  readonly value: string;
  readonly displayName: string;
  readonly resolvedModel: string;
};

export type { ModelOption };

const DEFAULT_MODEL_VALUE = "default";

export { DEFAULT_MODEL_VALUE };

// セレクタの選択肢ラベル。エイリアス（default/opus等）は実モデルIDを併記して
// 「それが何のモデルなのか」を自己説明的にする
export function formatModelItemLabel(model: ModelOption): string {
  if (model.resolvedModel === model.value) return model.displayName;
  return `${model.displayName}（${model.resolvedModel}）`;
}

// モデルID（initメッセージの実モデル名やエイリアス）を表示名に解決する。
// 一致が見つからなければ modelId をそのまま返す（生IDでも情報としては有効）
export function formatModelLabel(
  modelId: string,
  models: readonly ModelOption[] | undefined,
): string {
  if (models === undefined) return modelId;

  const exactByValue = models.find((m) => m.value === modelId);
  if (exactByValue !== undefined) return exactByValue.displayName;

  // "default" エントリは実体モデルと resolvedModel が重複するため、実体側の表示名を優先する
  const concreteModels = models.filter((m) => m.value !== DEFAULT_MODEL_VALUE);

  const exactByResolved = concreteModels.find((m) => m.resolvedModel === modelId);
  if (exactByResolved !== undefined) return exactByResolved.displayName;

  // 日付付きID（claude-opus-5-5-20251101 等）は解決名の前方一致で照合。最長一致を優先
  const prefixMatches = concreteModels
    .filter((m) => modelId.startsWith(m.resolvedModel))
    .sort((a, b) => b.resolvedModel.length - a.resolvedModel.length);
  return prefixMatches[0]?.displayName ?? modelId;
}

// 選択値（null = デフォルト）から「実際に使われる予定のモデル」の表示名を得る。
// モデル一覧が未取得なら null（表示しない）、一覧に無い選択値はそのまま返す
export function formatEffectiveModelLabel(
  selectedValue: string | null,
  models: readonly ModelOption[] | undefined,
): string | null {
  if (models === undefined) return null;

  const entry =
    selectedValue === null
      ? (models.find((m) => m.value === DEFAULT_MODEL_VALUE) ?? null)
      : (models.find((m) => m.value === selectedValue) ?? null);

  if (entry === null) return selectedValue;
  return formatModelLabel(entry.resolvedModel, models);
}
