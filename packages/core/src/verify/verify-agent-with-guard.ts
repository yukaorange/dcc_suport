import { buildAgentDefinitions } from "../agents";
import { invokeClaude } from "../engine";
import { buildCoachSystemPrompt } from "../prompts";
import { COACH_ALLOWED_TOOLS, COACH_TOOLS, createToolPermissionGuard } from "../skills";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "youtube url extract flow (root direct)";

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
      "この動画を確認して、内容をもとにアドバイスを考えてください。",
      "https://www.youtube.com/watch?v=LoFCBi0IzqE",
    ].join("\n"),
    appendSystemPrompt: buildCoachSystemPrompt({
      referenceImages: [],
      plan: null,
      skillManifest: null,
      previousAdvices: [],
    }),
    agents: buildAgentDefinitions(),
    tools: [...COACH_TOOLS],
    allowedTools: [...COACH_ALLOWED_TOOLS],
    canUseTool: createToolPermissionGuard(),
    onToolUse: (toolName, input) => {
      const detail =
        toolName === "Bash" ? ` command=${(input as { command?: string }).command}` : "";
      console.log(`[verify] ${toolName}${detail}`);
    },
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

  dumpFlowSummary(result.rawMessages);

  const trace = traceFlow(result.rawMessages);
  const failure = diagnoseTrace(trace);
  if (failure) {
    return { ...failure, durationMs };
  }

  const flags = [trace.webSearchExecuted ? "WebSearch" : null, trace.bashExecuted ? "Bash" : null]
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
