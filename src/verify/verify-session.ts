import { invokeClaude } from "../engine";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "session continuity";
const SECRET_NAME = "テスト太郎";

export async function verifySession(): Promise<VerifyResult> {
  const start = performance.now();

  const first = await invokeClaude({
    prompt: `私の名前は「${SECRET_NAME}」です。覚えてください。「覚えました」とだけ答えてください。`,
    timeoutMs: 60_000,
    maxTurns: 1,
    permissionMode: "bypassPermissions",
  });

  if (!first.isOk) {
    const durationMs = performance.now() - start;
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `初回呼び出し失敗: [${first.errorCode}] ${first.message}`,
      fallback:
        "毎回フルコンテキスト送信（5秒間隔ではトークン消費が爆発するため非現実的）",
    };
  }

  if (!first.sessionId) {
    const durationMs = performance.now() - start;
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `初回でsessionIdが取得できなかった。応答: "${first.result.slice(0, 100)}"`,
      fallback:
        "毎回フルコンテキスト送信（5秒間隔ではトークン消費が爆発するため非現実的）",
    };
  }

  const second = await invokeClaude({
    prompt: "私の名前は何ですか？名前だけ答えてください。",
    sessionId: first.sessionId,
    timeoutMs: 60_000,
    maxTurns: 1,
    permissionMode: "bypassPermissions",
  });

  const durationMs = performance.now() - start;

  if (!second.isOk) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `継続呼び出し失敗: [${second.errorCode}] ${second.message}`,
      fallback:
        "毎回フルコンテキスト送信（5秒間隔ではトークン消費が爆発するため非現実的）",
    };
  }

  if (!second.result.includes(SECRET_NAME)) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `名前「${SECRET_NAME}」が応答に含まれない。応答: "${second.result.slice(0, 200)}"`,
      fallback:
        "毎回フルコンテキスト送信（5秒間隔ではトークン消費が爆発するため非現実的）",
    };
  }

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `sessionId=${first.sessionId}, 継続応答に「${SECRET_NAME}」を確認`,
  };
}

if (import.meta.main) {
  const r = await verifySession();
  printVerifyResult(r);
}
