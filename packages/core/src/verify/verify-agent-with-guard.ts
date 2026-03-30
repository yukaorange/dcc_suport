import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { buildAgentDefinitions } from "../agents";
import { invokeClaude } from "../engine";
import { createToolPermissionGuard } from "../skills";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "youtube research flow (root direct)";

type FlowTrace = {
  readonly webSearchExecuted: boolean;
  readonly bashExecuted: boolean;
};

function checkToolTrace(rawMessages: readonly unknown[], name: string, extra?: string): boolean {
  for (const msg of rawMessages) {
    if (typeof msg !== "object" || msg === null) continue;
    const json = JSON.stringify(msg);
    if (!json.includes(`"name":"${name}"`)) continue;
    if (extra === undefined || json.includes(extra)) return true;
  }
  return false;
}

function traceFlow(rawMessages: readonly unknown[]): FlowTrace {
  return {
    webSearchExecuted: checkToolTrace(rawMessages, "WebSearch"),
    bashExecuted: checkToolTrace(rawMessages, "Bash", "extract-video"),
  };
}

function diagnoseTrace(trace: FlowTrace): (VerifyResult & { status: "fail" }) | null {
  if (!trace.webSearchExecuted) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs: 0,
      error: "WebSearch の痕跡なし。root が動画検索を実行しなかった",
      fallback: "prompts.ts の YouTube 動画リサーチセクションを確認する",
    };
  }
  if (!trace.bashExecuted) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs: 0,
      error: "Bash（extract-video.ts）実行の痕跡なし。root が動画要約を実行しなかった",
      fallback: "prompts.ts の Bash 実行指示、および canUseTool ガードを確認する",
    };
  }
  return null;
}

function withVerifyLogging(guard: CanUseTool): CanUseTool {
  return async (toolName, input, options) => {
    const result = await guard(toolName, input, options);
    const status = result.behavior === "allow" ? "ALLOW" : "DENY";
    const detail = toolName === "Bash" ? ` command=${(input as { command?: string }).command}` : "";
    console.log(`[verify] ${toolName} → ${status}${detail}`);
    return result;
  };
}

function dumpFlowSummary(rawMessages: readonly unknown[]): void {
  console.log(`\n=== フロー全体サマリー (${rawMessages.length} messages) ===`);
  for (const msg of rawMessages) {
    if (typeof msg !== "object" || msg === null) continue;
    const json = JSON.stringify(msg);

    if (json.includes("task_started")) {
      const desc = json.match(/"description":"([^"]*)"/)?.[1] ?? "";
      console.log(`[START] ${desc}`);
    }
    if (json.includes('"role":"assistant"') && json.includes('"type":"text"')) {
      const textMatch = json.match(/"type":"text","text":"((?:[^"\\]|\\.)*)"/);
      if (textMatch && textMatch[1].length > 20) {
        console.log(`[TEXT] ${textMatch[1].replace(/\\n/g, " ").slice(0, 200)}`);
      }
    }
  }
  console.log("=== end ===\n");
}

export async function verifyAgentWithGuard(): Promise<VerifyResult> {
  const start = performance.now();

  const result = await invokeClaude({
    prompt: [
      "Photoshopのレイヤーマスクの使い方についてYouTube動画リサーチを実施してください。",
      "WebSearchで候補を検索し、メタデータで1本選定して extract-video.ts で要約してください。",
      "スキルファイルへの書き戻しは不要です。",
    ].join("\n"),
    agents: buildAgentDefinitions(),
    tools: ["Read", "Agent", "WebSearch", "WebFetch", "Write", "Bash", "Glob"],
    allowedTools: ["Read", "Agent"],
    canUseTool: withVerifyLogging(createToolPermissionGuard()),
    model: "sonnet",
    timeoutMs: 600_000,
    maxTurns: 100,
  });

  const durationMs = performance.now() - start;

  if (!result.isOk) {
    dumpFlowSummary(result.rawMessages);
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `[${result.errorCode}] ${result.message}`,
      fallback: "engine エラー。SDK ログを確認する",
    };
  }

  const trace = traceFlow(result.rawMessages);
  const failure = diagnoseTrace(trace);
  if (failure) {
    return { ...failure, durationMs };
  }

  const flags = [
    trace.webSearchExecuted ? "WebSearch" : null,
    trace.bashExecuted ? "Bash" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `フルフロー確認（${flags}）。応答: "${result.result.slice(0, 100)}"`,
  };
}

if (import.meta.main) {
  const r = await verifyAgentWithGuard();
  printVerifyResult(r);
  if (r.status === "fail") {
    console.log("fallback:", r.fallback);
  }
}
