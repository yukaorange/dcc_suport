import { describe, expect, test, vi } from "vitest";
import { extractToolUses } from "../src/engine";
import type { EngineResult } from "../src/index";
import { checkSessionContinuity, invokeClaude } from "../src/index";

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query,
}));

describe("checkSessionContinuity", () => {
  test("失敗結果が渡された場合、継続不可とエラーメッセージを返す", () => {
    const failure: EngineResult = {
      isOk: false,
      errorCode: "TIMEOUT",
      message: "Query timed out after 60000ms",
    };

    const result = checkSessionContinuity(failure, true);

    expect(result.continuable).toBe(false);
    if (!result.continuable) {
      expect(result.reason).toBe("Query timed out after 60000ms");
    }
  });

  test("成功結果だがsessionIdが未定義の場合（初回）、致命的エラーメッセージを返す", () => {
    const success: EngineResult = {
      isOk: true,
      result: "some advice",
      sessionId: undefined,
      rawMessages: [],
    };

    const result = checkSessionContinuity(success, true);

    expect(result.continuable).toBe(false);
    if (!result.continuable) {
      expect(result.reason).toContain("fundamentally broken");
    }
  });

  test("成功結果だがsessionIdが未定義の場合（2回目以降）、セッション途切れメッセージを返す", () => {
    const success: EngineResult = {
      isOk: true,
      result: "some advice",
      sessionId: undefined,
      rawMessages: [],
    };

    const result = checkSessionContinuity(success, false);

    expect(result.continuable).toBe(false);
    if (!result.continuable) {
      expect(result.reason).toContain("Session continuity lost");
    }
  });

  test("成功結果でsessionIdが存在する場合、継続可能を返す", () => {
    const success: EngineResult = {
      isOk: true,
      result: "レイヤーを整理しましょう",
      sessionId: "session-abc-123",
      rawMessages: [],
    };

    const result = checkSessionContinuity(success, true);

    expect(result.continuable).toBe(true);
  });
});

describe("invokeClaude", () => {
  function mockQueryStream(messages: readonly unknown[]): void {
    query.mockReturnValue(
      (async function* () {
        yield* messages;
      })(),
    );
  }

  test("initメッセージのmodelが成功結果に含まれる", async () => {
    mockQueryStream([
      { type: "system", subtype: "init", session_id: "session-1", model: "claude-sonnet-5" },
      { type: "result", subtype: "success", result: "アドバイス本文" },
    ]);

    const result = await invokeClaude({ prompt: "テスト", timeoutMs: 5000 });

    expect(result.isOk).toBe(true);
    if (result.isOk) {
      expect(result.model).toBe("claude-sonnet-5");
      expect(result.sessionId).toBe("session-1");
    }
  });

  test("initメッセージにmodelがない場合、成功結果のmodelはundefined", async () => {
    mockQueryStream([
      { type: "system", subtype: "init", session_id: "session-2" },
      { type: "result", subtype: "success", result: "アドバイス本文" },
    ]);

    const result = await invokeClaude({ prompt: "テスト", timeoutMs: 5000 });

    expect(result.isOk).toBe(true);
    if (result.isOk) {
      expect(result.model).toBeUndefined();
    }
  });

  test("modelオプションがSDKのquery optionsに引き渡される", async () => {
    mockQueryStream([{ type: "result", subtype: "success", result: "ok" }]);

    await invokeClaude({ prompt: "テスト", timeoutMs: 5000, model: "claude-opus-5" });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ model: "claude-opus-5" }),
      }),
    );
  });
});

describe("extractToolUses", () => {
  test("name と input の間に別キーがあっても tool_use を抽出できる", () => {
    const message = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: "Bash",
            id: "toolu_123",
            input: {
              command:
                'cd /tmp && bun run packages/core/src/extract-video.ts "https://www.youtube.com/shorts/5rAsHyXT3Gw?app=desktop"',
            },
          },
        ],
      },
    };

    expect(extractToolUses(message)).toEqual([
      {
        toolName: "Bash",
        input: {
          command:
            'cd /tmp && bun run packages/core/src/extract-video.ts "https://www.youtube.com/shorts/5rAsHyXT3Gw?app=desktop"',
        },
      },
    ]);
  });

  test("input に入れ子オブジェクトがあっても壊れない", () => {
    const message = {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            name: "Write",
            input: {
              file_path: "/tmp/test.md",
              metadata: { source: "coach", round: 1 },
            },
          },
        ],
      },
    };

    expect(extractToolUses(message)).toEqual([
      {
        toolName: "Write",
        input: {
          file_path: "/tmp/test.md",
          metadata: { source: "coach", round: 1 },
        },
      },
    ]);
  });
});
