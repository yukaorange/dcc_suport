import { invokeClaude } from "../engine";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "streaming + message structure";

// ストリーミング応答に必要なメッセージ（system/init → assistant → result/success）が
// 欠けていないかを確認する。Phase 2 のコーチングループはこの構造に依存するため、
// SDK アップデートで構造が変わった場合に早期検知できる
async function verifyMessageStructure(): Promise<VerifyResult> {
  const start = performance.now();

  const result = await invokeClaude({
    prompt: "1+1は？数字だけ答えて",
    timeoutMs: 60_000,
    maxTurns: 1,
    permissionMode: "bypassPermissions",
  });

  const durationMs = performance.now() - start;

  if (!result.isOk) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `[${result.errorCode}] ${result.message}`,
      fallback:
        "ストリーミング不可なら単発呼び出しへ切替。session_id取得不可なら毎回新規セッション",
    };
  }

  // rawMessages は unknown[] なので、観測できた type/subtype の組み合わせを収集し、
  // FAIL 時に「何が届いて何が届かなかったか」をレポートできるようにする
  const typeMap = new Map<string, Set<string>>();

  for (const msg of result.rawMessages) {
    if (typeof msg === "object" && msg !== null && "type" in msg) {
      const typed = msg as { type: string; subtype?: string };
      const subtypes = typeMap.get(typed.type) ?? new Set<string>();
      if (typed.subtype) {
        subtypes.add(typed.subtype);
      }
      typeMap.set(typed.type, subtypes);
    }
  }

  const hasInit = result.rawMessages.some(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      "type" in m &&
      (m as { type: string }).type === "system" &&
      "subtype" in m &&
      (m as { subtype: string }).subtype === "init",
  );

  const hasResultSuccess = result.rawMessages.some(
    (m) =>
      typeof m === "object" &&
      m !== null &&
      "type" in m &&
      (m as { type: string }).type === "result" &&
      "subtype" in m &&
      (m as { subtype: string }).subtype === "success",
  );

  const typeReport = [...typeMap.entries()]
    .map(([type, subtypes]) => {
      const subs = subtypes.size > 0 ? ` (${[...subtypes].join(", ")})` : "";
      return `${type}${subs}`;
    })
    .join(" | ");

  const issues: string[] = [];
  if (!hasInit) issues.push("system/init not found");
  if (!hasResultSuccess) issues.push("result/success not found");
  if (!result.sessionId) issues.push("session_id not extracted");

  if (issues.length > 0) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `Missing: ${issues.join(", ")}. Types observed: ${typeReport}`,
      fallback:
        "ストリーミング不可なら単発呼び出しへ切替。session_id取得不可なら毎回新規セッション",
    };
  }

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `sessionId=${result.sessionId}, types=[${typeReport}], result="${result.result.slice(0, 50)}"`,
  };
}

// engine.ts のソフトタイムアウト（AbortController）が実際に効くかを確認する。
// 意図的にタイムアウトを起こし、SDK が abort シグナルを尊重して速やかに停止するかを計測する。
// もしここが FAIL なら、engine.ts にハードタイムアウト（close + Promise.race）の導入が必要になる
async function verifyAbortSignal(): Promise<VerifyResult> {
  const name = "AbortSignal behavior";
  const timeoutMs = 2_000;
  const start = performance.now();

  const result = await invokeClaude({
    prompt: "1から1000までの素数をすべて列挙してください。省略せずに全て書いてください。",
    timeoutMs,
    maxTurns: 1,
    permissionMode: "bypassPermissions",
  });

  const elapsedMs = performance.now() - start;

  if (result.isOk) {
    return {
      status: "inconclusive",
      name,
      durationMs: elapsedMs,
      reason: `応答が${Math.round(elapsedMs)}msで返った（timeout=${timeoutMs}ms以内）。signal検証不可。プロンプトを変更して再テスト`,
    };
  }

  if (result.errorCode !== "TIMEOUT") {
    return {
      status: "fail",
      name,
      durationMs: elapsedMs,
      error: `Expected TIMEOUT but got ${result.errorCode}: ${result.message}`,
      fallback: "AbortSignalが機能しない場合、SDK採用を再検討",
    };
  }

  // abort 指示の送信〜SDK 内部処理〜実際の停止までラグがあるため、1秒の猶予を設けている
  if (elapsedMs > timeoutMs + 1_000) {
    return {
      status: "fail",
      name,
      durationMs: elapsedMs,
      error: `BLOCKING: SDKがAbortSignalを尊重しない。elapsed=${Math.round(elapsedMs)}ms (threshold=${timeoutMs + 1_000}ms)`,
      fallback: "SDK採用を再検討すべき",
    };
  }

  return {
    status: "pass",
    name,
    durationMs: elapsedMs,
    detail: `TIMEOUT in ${Math.round(elapsedMs)}ms (threshold=${timeoutMs + 1_000}ms). Signal respected.`,
  };
}

export async function verifyStreaming(): Promise<VerifyResult[]> {
  const results: VerifyResult[] = [];

  console.log("  [1/2] Message structure...");
  results.push(await verifyMessageStructure());

  console.log("  [2/2] AbortSignal behavior...");
  results.push(await verifyAbortSignal());

  return results;
}

if (import.meta.main) {
  const results = await verifyStreaming();
  for (const r of results) {
    printVerifyResult(r);
  }
}
