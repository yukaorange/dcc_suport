import { invokeClaude } from "../engine";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "agents (subagent definition)";

const testAgents = {
  coach: {
    description: "テスト用コーチエージェント",
    prompt: "あなたはテスト用のコーチです。短く応答してください。",
  },
};

function hasSubagentTrace(rawMessages: readonly unknown[]): boolean {
  for (const msg of rawMessages) {
    if (typeof msg !== "object" || msg === null) continue; //unkown型なのでオブジェクトだけを通すようにガード節を追加

    const json = JSON.stringify(msg);

    if (json.includes('"coach"') && json.includes("task")) return true;
    if (json.includes("Task") && json.includes("coach")) return true;
    if (json.includes("subagent")) return true;
    if ("type" in msg && (msg as { type: string }).type === "assistant" && json.includes("coach"))
      return true;
  }
  return false;
}

export async function verifyAgents(): Promise<VerifyResult> {
  const start = performance.now();

  const result = await invokeClaude({
    prompt: "coachエージェントにこの質問を委任してください: 1+1は？",
    agents: testAgents,
    allowedTools: ["Task"],
    model: "sonnet",
    timeoutMs: 120_000,
    maxTurns: 5,
    permissionMode: "bypassPermissions",
  });

  const durationMs = performance.now() - start;

  if (!result.isOk) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `[${result.errorCode}] ${result.message}`,
      fallback: "appendSystemPromptにcoach/researcher両方の役割を記述したシングルエージェント構成",
    };
  }

  if (!hasSubagentTrace(result.rawMessages)) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `サブエージェント起動の痕跡なし。応答: "${result.result.slice(0, 200)}"`,
      fallback: "appendSystemPromptにcoach/researcher両方の役割を記述したシングルエージェント構成",
    };
  }

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `サブエージェント痕跡を確認。応答: "${result.result.slice(0, 100)}"`,
  };
}

if (import.meta.main) {
  const r = await verifyAgents();
  printVerifyResult(r);
}
