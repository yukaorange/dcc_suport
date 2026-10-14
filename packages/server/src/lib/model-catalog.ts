import { type ListModelsResult, listAvailableModels, type ModelChoice } from "@dcc/core";

type ModelCatalog = {
  readonly list: () => Promise<ListModelsResult>;
  readonly findByValue: (value: string) => Promise<ModelChoice | null>;
};

export type { ModelCatalog };

// モデル一覧の取得は SDK の query プロセスを1本立ち上げる重い操作のため、
// 成功結果をサーバープロセスの生存期間中キャッシュする。
// 失敗はキャッシュせず、次回呼び出しで再試行する。
export function createModelCatalog(
  fetchModels: () => Promise<ListModelsResult> = listAvailableModels,
): ModelCatalog {
  let cachedModels: readonly ModelChoice[] | null = null;
  let inFlight: Promise<ListModelsResult> | null = null;

  const list = async (): Promise<ListModelsResult> => {
    if (cachedModels !== null) return { isOk: true, models: cachedModels };

    // 同時リクエストで probe が多重起動しないよう in-flight Promise を共有する
    if (inFlight === null) {
      inFlight = fetchModels().finally(() => {
        inFlight = null;
      });
    }

    const result = await inFlight;
    if (result.isOk) {
      cachedModels = result.models;
    }
    return result;
  };

  return {
    list,
    findByValue: async (value) => {
      const result = await list();
      if (!result.isOk) return null;
      return result.models.find((m) => m.value === value) ?? null;
    },
  };
}
