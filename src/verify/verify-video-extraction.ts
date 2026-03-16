import { extractVideoContent } from "../gemini";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "video extraction (Gemini API)";

// 短めのチュートリアル動画
const TEST_YOUTUBE_URL = "https://www.youtube.com/watch?v=LoFCBi0IzqE";

export async function verifyVideoExtraction(): Promise<VerifyResult> {
  const start = performance.now();

  const result = await extractVideoContent(TEST_YOUTUBE_URL);

  const durationMs = performance.now() - start;

  if (!result.isOk) {
    if (result.errorCode === "NO_API_KEY") {
      return {
        status: "inconclusive",
        name: VERIFY_NAME,
        durationMs,
        reason: "GEMINI_API_KEY が未設定のためスキップ",
      };
    }

    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `[${result.errorCode}] ${result.message}`,
      fallback: "Gemini API の設定を確認。APIキー・クォータ・動画URLの有効性を検証",
    };
  }

  const hasContent = result.content.trim().length > 50;

  if (!hasContent) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `抽出結果が短すぎる (${result.content.length}文字)`,
      fallback: "Gemini のモデル・プロンプトを見直し。動画が非公開でないか確認",
    };
  }

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `${result.content.length}文字を抽出。先頭: "${result.content.slice(0, 80)}..."`,
  };
}

if (import.meta.main) {
  const r = await verifyVideoExtraction();
  printVerifyResult(r);
}
