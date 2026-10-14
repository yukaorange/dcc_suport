import { describe, expect, test, vi } from "vitest";
import { listAvailableModels } from "../src/list-models";

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query,
}));

describe("listAvailableModels", () => {
  test("supportedModelsの結果をModelChoiceにマッピングして返す", async () => {
    query.mockReturnValue({
      supportedModels: vi.fn().mockResolvedValue([
        {
          value: "opus",
          displayName: "Opus",
          description: "最高性能モデル",
          resolvedModel: "claude-opus-5-5",
          supportsEffort: true,
        },
        {
          value: "claude-haiku-4-5",
          displayName: "Haiku 4.5",
          description: "高速モデル",
        },
      ]),
    });

    const result = await listAvailableModels();

    expect(result.isOk).toBe(true);
    if (result.isOk) {
      expect(result.models).toEqual([
        {
          value: "opus",
          displayName: "Opus",
          description: "最高性能モデル",
          resolvedModel: "claude-opus-5-5",
          supportsEffort: true,
        },
        {
          value: "claude-haiku-4-5",
          displayName: "Haiku 4.5",
          description: "高速モデル",
          // resolvedModel が無いレスポンスでは value にフォールバックする
          resolvedModel: "claude-haiku-4-5",
          supportsEffort: false,
        },
      ]);
    }
  });

  test("supportedModelsが失敗した場合はエラーメッセージを返す", async () => {
    query.mockReturnValue({
      supportedModels: vi.fn().mockRejectedValue(new Error("control request failed")),
    });

    const result = await listAvailableModels();

    expect(result.isOk).toBe(false);
    if (!result.isOk) {
      expect(result.message).toContain("control request failed");
    }
  });

  test("queryの起動自体が失敗した場合もエラーメッセージを返す", async () => {
    query.mockImplementation(() => {
      throw new Error("CLI not found");
    });

    const result = await listAvailableModels();

    expect(result.isOk).toBe(false);
    if (!result.isOk) {
      expect(result.message).toContain("CLI not found");
    }
  });
});
