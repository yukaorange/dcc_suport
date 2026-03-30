import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { buildAgentDefinitions } from "../agents";
import { invokeClaude } from "../engine";
import { createToolPermissionGuard } from "../skills";
import { printVerifyResult, type VerifyResult } from "./types";

const VERIFY_NAME = "researcher full flow with canUseTool guard";

type FlowTrace = {
  readonly agentInvoked: boolean;
  readonly webSearchAttempted: boolean;
  readonly bashExecuted: boolean;
  readonly qualityEvalAttempted: boolean;
};

function extractTextsFromJson(json: string, pattern: RegExp, minLength: number): readonly string[] {
  const texts: string[] = [];
  for (const m of json.matchAll(pattern)) {
    if (m[1].length > minLength) {
      texts.push(m[1]);
    }
  }
  return texts;
}

function classifyMessage(
  json: string,
  insideResearcher: boolean,
): "researcher_start" | "researcher_end" | "assistant_text" | "skip" {
  if (json.includes("task_started") && json.includes("researcher")) return "researcher_start";
  if (json.includes("tool_result") && json.includes("parent_tool_use_id")) return "researcher_end";
  if (insideResearcher && json.includes('"role":"assistant"') && json.includes('"type":"text"'))
    return "assistant_text";
  return "skip";
}

function extractResearcherResponses(rawMessages: readonly unknown[]): readonly string[] {
  const responses: string[] = [];
  let insideResearcher = false;

  for (const msg of rawMessages) {
    if (typeof msg !== "object" || msg === null) continue;
    const json = JSON.stringify(msg);
    const kind = classifyMessage(json, insideResearcher);

    switch (kind) {
      case "researcher_start":
        insideResearcher = true;
        break;
      case "researcher_end":
        for (const t of extractTextsFromJson(json, /"text":"((?:[^"\\]|\\.)*)"/g, 50)) {
          responses.push(`[researcher→advisor] ${t}`);
        }
        insideResearcher = false;
        break;
      case "assistant_text":
        for (const t of extractTextsFromJson(
          json,
          /"type":"text","text":"((?:[^"\\]|\\.)*)"/g,
          50,
        )) {
          responses.push(`[researcher内部] ${t}`);
        }
        break;
      case "skip":
        break;
    }
  }
  return responses;
}

function checkToolTrace(rawMessages: readonly unknown[], name: string, extra?: string): boolean {
  for (const msg of rawMessages) {
    if (typeof msg !== "object" || msg === null) continue;
    const json = JSON.stringify(msg);
    if (!json.includes(`"name":"${name}"`)) continue;
    if (extra === undefined || json.includes(extra)) return true;
  }
  return false;
}

function checkTextPattern(rawMessages: readonly unknown[], pattern: RegExp): boolean {
  for (const msg of rawMessages) {
    if (typeof msg !== "object" || msg === null) continue;
    if (pattern.test(JSON.stringify(msg))) return true;
  }
  return false;
}

function traceResearcherFlow(rawMessages: readonly unknown[]): FlowTrace {
  return {
    agentInvoked: checkToolTrace(rawMessages, "Agent", "researcher"),
    webSearchAttempted: checkToolTrace(rawMessages, "WebSearch"),
    bashExecuted: checkToolTrace(rawMessages, "Bash", "extract-video"),
    qualityEvalAttempted: checkTextPattern(rawMessages, /[ABC]判定|充足性.*具体性|具体性.*関連性/),
  };
}

function diagnoseTrace(trace: FlowTrace): (VerifyResult & { status: "fail" }) | null {
  if (!trace.agentInvoked) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs: 0,
      error: "researcher 起動の痕跡なし。canUseTool ガードが Agent を deny している可能性",
      fallback: "skills.ts の default ケースに Agent の許可を追加する",
    };
  }
  if (!trace.webSearchAttempted) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs: 0,
      error: "WebSearch の痕跡なし。researcher が動画検索ステップをスキップした可能性",
      fallback: "researcher プロンプトの YouTube 動画リサーチフローを確認する",
    };
  }
  if (!trace.bashExecuted) {
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs: 0,
      error: "Bash（extract-video.ts）実行の痕跡なし。ガードが deny しているか、researcher が抽出をスキップした",
      fallback: "checkBashPermission のパターンマッチを確認。extract-video.ts が許可対象か検証する",
    };
  }
  return null;
}

function formatTraceFlags(trace: FlowTrace): string {
  return [
    trace.agentInvoked ? "Agent" : null,
    trace.webSearchAttempted ? "WebSearch" : null,
    trace.bashExecuted ? "Bash" : null,
    trace.qualityEvalAttempted ? "QualityEval" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

// ツール呼び出しをリアルタイムでログ出力するラッパー
function withVerifyLogging(guard: CanUseTool): CanUseTool {
  return async (toolName, input, options) => {
    const result = await guard(toolName, input, options);
    const status = result.behavior === "allow" ? "ALLOW" : "DENY";
    const detail = toolName === "Bash" ? ` command=${(input as { command?: string }).command}` : "";
    console.log(`[verify] ${toolName} → ${status}${detail}`);
    return result;
  };
}

export async function verifyAgentWithGuard(): Promise<VerifyResult> {
  const start = performance.now();

  const result = await invokeClaude({
    prompt: [
      "researcherエージェントに以下の調査を委任してください:",
      "",
      "Photoshopのレイヤーマスクの使い方についてYouTube動画を検索し、",
      "有望な動画を1本だけ選んで extract-video.ts で内容を抽出してください。",
      "抽出結果の品質を「情報の充足性」「具体性」「関連性」の観点で A/B/C 判定してください。",
      "リトライは不要です。1本の動画で判定結果と要約だけ返してください。",
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
    return {
      status: "fail",
      name: VERIFY_NAME,
      durationMs,
      error: `[${result.errorCode}] ${result.message}`,
      fallback: "engine エラー。SDK ログを確認する",
    };
  }

  // researcher の応答テキスト（品質判定結果を含む）をログ出力
  const researcherResponses = extractResearcherResponses(result.rawMessages);
  if (researcherResponses.length > 0) {
    console.log("\n=== researcher 応答（品質判定結果） ===");
    for (const resp of researcherResponses) {
      const decoded = resp.replace(/\\n/g, "\n").replace(/\\"/g, '"');
      console.log(decoded.slice(0, 500));
      console.log("---");
    }
    console.log("=== end ===\n");
  }

  const trace = traceResearcherFlow(result.rawMessages);
  const failure = diagnoseTrace(trace);
  if (failure) {
    return { ...failure, durationMs };
  }

  const traceFlags = formatTraceFlags(trace);

  if (!trace.qualityEvalAttempted) {
    return {
      status: "inconclusive",
      name: VERIFY_NAME,
      durationMs,
      reason: `品質評価の痕跡なし（検出フロー: ${traceFlags}）。応答: "${result.result.slice(0, 150)}"`,
    };
  }

  return {
    status: "pass",
    name: VERIFY_NAME,
    durationMs,
    detail: `フルフロー確認（${traceFlags}）。応答: "${result.result.slice(0, 100)}"`,
  };
}

if (import.meta.main) {
  const r = await verifyAgentWithGuard();
  printVerifyResult(r);
  if (r.status === "fail") {
    console.log("fallback:", r.fallback);
  }
}
