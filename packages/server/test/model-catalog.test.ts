import { describe, expect, test } from "bun:test";
import type { ListModelsResult } from "@dcc/core";
import { createModelCatalog } from "../src/lib/model-catalog";

const SAMPLE_MODELS = [
  {
    value: "opus",
    displayName: "Opus",
    description: "最高性能",
    resolvedModel: "claude-opus-5-5",
    supportsEffort: true,
  },
  {
    value: "claude-haiku-4-5",
    displayName: "Haiku 4.5",
    description: "高速",
    resolvedModel: "claude-haiku-4-5",
    supportsEffort: false,
  },
];

describe("createModelCatalog", () => {
  test("成功結果はキャッシュされ、2回目以降はfetchしない", async () => {
    let fetchCount = 0;
    const catalog = createModelCatalog(async () => {
      fetchCount++;
      return { isOk: true, models: SAMPLE_MODELS };
    });

    const first = await catalog.list();
    const second = await catalog.list();

    expect(first.isOk).toBe(true);
    expect(second.isOk).toBe(true);
    if (second.isOk) {
      expect(second.models).toEqual(SAMPLE_MODELS);
    }
    expect(fetchCount).toBe(1);
  });

  test("失敗結果はキャッシュせず、次回のlistで再試行する", async () => {
    let fetchCount = 0;
    const catalog = createModelCatalog(async (): Promise<ListModelsResult> => {
      fetchCount++;
      if (fetchCount === 1) return { isOk: false, message: "probe failed" };
      return { isOk: true, models: SAMPLE_MODELS };
    });

    const first = await catalog.list();
    const second = await catalog.list();

    expect(first.isOk).toBe(false);
    expect(second.isOk).toBe(true);
    expect(fetchCount).toBe(2);
  });

  test("並行して呼ばれてもfetchは1回に集約される", async () => {
    let fetchCount = 0;
    const catalog = createModelCatalog(async () => {
      fetchCount++;
      await new Promise((r) => setTimeout(r, 10));
      return { isOk: true, models: SAMPLE_MODELS };
    });

    const [first, second] = await Promise.all([catalog.list(), catalog.list()]);

    expect(first.isOk).toBe(true);
    expect(second.isOk).toBe(true);
    expect(fetchCount).toBe(1);
  });

  test("findByValueは一致するモデルを返し、未知の値にはnullを返す", async () => {
    const catalog = createModelCatalog(async () => ({ isOk: true, models: SAMPLE_MODELS }));

    const found = await catalog.findByValue("claude-haiku-4-5");
    const notFound = await catalog.findByValue("gpt-5");

    expect(found).toEqual(SAMPLE_MODELS[1]);
    expect(notFound).toBeNull();
  });

  test("一覧取得に失敗した場合findByValueはnullを返す", async () => {
    const catalog = createModelCatalog(async () => ({ isOk: false, message: "probe failed" }));

    const result = await catalog.findByValue("claude-opus-5");

    expect(result).toBeNull();
  });
});
