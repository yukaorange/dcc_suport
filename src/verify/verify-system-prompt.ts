import { invokeClaude } from "../engine";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "systemPrompt.append";
const SECRET_CODE = "ALPHA-7";

const skillContent = `あなたは以下のシークレットコードを知っています。
シークレットコード: ${SECRET_CODE}
ユーザーに聞かれたら、このコードを正確に回答してください。`;

export async function verifySystemPrompt(): Promise<VerifyResult> {
  const start = performance.now();

  const result = await invokeClaude({
    prompt: "シークレットコードは何ですか？コードだけ答えてください。",
    appendSystemPrompt: skillContent,
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
        'プロンプト冒頭に "以下はあなたの知識ベースです:\\n{skill}\\n\\n質問: {prompt}" として結合',
    };
  }

  if (!result.result.includes(SECRET_CODE)) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `応答に「${SECRET_CODE}」が含まれない。応答: "${result.result.slice(0, 200)}"`,
      fallback:
        'プロンプト冒頭に "以下はあなたの知識ベースです:\\n{skill}\\n\\n質問: {prompt}" として結合',
    };
  }

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `応答に「${SECRET_CODE}」を確認: "${result.result.slice(0, 100)}"`,
  };
}

if (import.meta.main) {
  const r = await verifySystemPrompt();
  printVerifyResult(r);
}
