import { describe, expect, test } from "vitest";
import {
  formatEffectiveModelLabel,
  formatModelItemLabel,
  formatModelLabel,
} from "../src/lib/model-label";

// 実環境の supportedModels() が返す形を模したサンプル
const MODELS = [
  { value: "default", displayName: "Default (recommended)", resolvedModel: "claude-opus-5-5" },
  { value: "opus", displayName: "Opus", resolvedModel: "claude-opus-5-5" },
  { value: "sonnet", displayName: "Sonnet", resolvedModel: "claude-sonnet-5-5" },
  {
    value: "claude-haiku-4-5-20251001",
    displayName: "Haiku 4.5",
    resolvedModel: "claude-haiku-4-5-20251001",
  },
];

describe("formatModelItemLabel", () => {
  test("エイリアスには解決先の実モデルIDを併記する", () => {
    expect(formatModelItemLabel(MODELS[0])).toBe("Default (recommended)（claude-opus-5-5）");
    expect(formatModelItemLabel(MODELS[1])).toBe("Opus（claude-opus-5-5）");
  });

  test("valueと解決先が同一なら表示名のみ", () => {
    expect(formatModelItemLabel(MODELS[3])).toBe("Haiku 4.5");
  });
});

describe("formatModelLabel", () => {
  test("エイリアス完全一致で表示名に解決する", () => {
    expect(formatModelLabel("opus", MODELS)).toBe("Opus");
  });

  test("実モデルID一致ではdefaultエントリではなく実体側の表示名を返す", () => {
    expect(formatModelLabel("claude-opus-5-5", MODELS)).toBe("Opus");
  });

  test("日付付きIDは前方一致で解決する", () => {
    expect(formatModelLabel("claude-opus-5-5-20251101", MODELS)).toBe("Opus");
  });

  test("一致しないIDはそのまま返す", () => {
    expect(formatModelLabel("gpt-5", MODELS)).toBe("gpt-5");
  });

  test("一覧未取得時はIDをそのまま返す", () => {
    expect(formatModelLabel("claude-opus-5-5", undefined)).toBe("claude-opus-5-5");
  });
});

describe("formatEffectiveModelLabel", () => {
  test("デフォルト選択（null）はdefaultエントリの解決先モデル名を返す", () => {
    expect(formatEffectiveModelLabel(null, MODELS)).toBe("Opus");
  });

  test("エイリアス選択は解決先の表示名を返す", () => {
    expect(formatEffectiveModelLabel("sonnet", MODELS)).toBe("Sonnet");
  });

  test("一覧未取得時はnull（バッジ非表示）", () => {
    expect(formatEffectiveModelLabel("opus", undefined)).toBeNull();
  });

  test("一覧に無い選択値はそのまま返す", () => {
    expect(formatEffectiveModelLabel("unknown-model", MODELS)).toBe("unknown-model");
  });

  test("defaultエントリが無い一覧でnull選択ならnullを返す", () => {
    const withoutDefault = MODELS.filter((m) => m.value !== "default");
    expect(formatEffectiveModelLabel(null, withoutDefault)).toBeNull();
  });
});
