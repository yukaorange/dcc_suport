import { describe, expect, test } from "vitest";
import { extractVideoContent, YOUTUBE_URL_PATTERN } from "../src/index";

describe("extractVideoContent", () => {
  test("GEMINI_API_KEYが未設定の場合、NO_API_KEYエラーを返す", async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const result = await extractVideoContent("https://www.youtube.com/watch?v=test123");
    expect(result.isOk).toBe(false);
    if (!result.isOk) {
      expect(result.errorCode).toBe("NO_API_KEY");
    }

    if (originalKey) process.env.GEMINI_API_KEY = originalKey;
  });

  test("不正なURLの場合、INVALID_URLエラーを返す", async () => {
    process.env.GEMINI_API_KEY = "dummy-key";
    const result = await extractVideoContent("https://example.com/not-youtube");
    expect(result.isOk).toBe(false);
    if (!result.isOk) {
      expect(result.errorCode).toBe("INVALID_URL");
    }
    delete process.env.GEMINI_API_KEY;
  });
});

describe("YOUTUBE_URL_PATTERN", () => {
  test("標準的なyoutube.com URLにマッチする", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  test("youtu.be短縮URLにマッチする", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  test("www なしのURLにマッチする", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://youtube.com/watch?v=abc123")).toBe(true);
  });

  test("YouTube以外のURLにマッチしない", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://example.com/watch?v=abc123")).toBe(false);
  });

  test("クエリパラメータ付きURLにマッチする", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://www.youtube.com/watch?v=abc123&list=PLxyz")).toBe(
      true,
    );
    expect(YOUTUBE_URL_PATTERN.test("https://www.youtube.com/watch?v=abc123&t=120")).toBe(true);
    expect(YOUTUBE_URL_PATTERN.test("https://youtu.be/abc123?si=XXXXXXXXXXXXX")).toBe(true);
  });

  test("URLの末尾にパスが付いた場合マッチしない", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://www.youtube.com/watch?v=abc123/extra")).toBe(false);
  });
});
