import { describe, expect, test } from "vitest";
import { deriveSdkVersionStatus } from "../src/sdk-version";

describe("deriveSdkVersionStatus", () => {
  test("インストール済みバージョンが特定できない場合はunknown", () => {
    const status = deriveSdkVersionStatus(null, "0.3.299");
    expect(status.kind).toBe("unknown");
  });

  test("最新バージョンが取得できない場合（オフライン等）はunknown", () => {
    const status = deriveSdkVersionStatus("0.3.299", null);
    expect(status.kind).toBe("unknown");
  });

  test("patchが遅れていればoutdated", () => {
    expect(deriveSdkVersionStatus("0.3.290", "0.3.299")).toEqual({
      kind: "outdated",
      installed: "0.3.290",
      latest: "0.3.299",
    });
  });

  test("minorが遅れていればoutdated", () => {
    expect(deriveSdkVersionStatus("0.2.63", "0.3.299").kind).toBe("outdated");
  });

  test("majorが遅れていればoutdated", () => {
    expect(deriveSdkVersionStatus("0.3.299", "1.0.0").kind).toBe("outdated");
  });

  test("一致していればup_to_date", () => {
    expect(deriveSdkVersionStatus("0.3.299", "0.3.299")).toEqual({
      kind: "up_to_date",
      installed: "0.3.299",
      latest: "0.3.299",
    });
  });

  test("インストール済みの方が新しい場合もup_to_date", () => {
    expect(deriveSdkVersionStatus("0.4.0", "0.3.299").kind).toBe("up_to_date");
  });

  test("桁数の異なるバージョンは数値として比較する（辞書順ではない）", () => {
    expect(deriveSdkVersionStatus("0.3.9", "0.3.10").kind).toBe("outdated");
  });

  test("プレリリースサフィックスはコア部分だけで比較する", () => {
    expect(deriveSdkVersionStatus("0.3.299-beta.1", "0.3.299").kind).toBe("up_to_date");
  });

  test("2要素バージョンは欠けた要素を0として比較する", () => {
    expect(deriveSdkVersionStatus("1.2", "1.2.1").kind).toBe("outdated");
  });

  test("解釈できないバージョン文字列はunknown", () => {
    expect(deriveSdkVersionStatus("abc", "0.3.299").kind).toBe("unknown");
    expect(deriveSdkVersionStatus("0.3.299", "not-a-version").kind).toBe("unknown");
  });
});
