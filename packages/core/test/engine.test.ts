import { describe, expect, test } from "vitest";
import type { EngineResult } from "../src/index";
import { checkSessionContinuity } from "../src/index";

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
